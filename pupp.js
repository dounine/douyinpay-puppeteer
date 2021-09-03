const puppeteer = require('puppeteer');
const fs = require("fs").promises;
const path = require('path');
const mineType = require('mime-types');
const os = require('os');
const axios = require("axios");
const {Cluster} = require('puppeteer-cluster');
// axios.defaults.retry = 4;
// axios.defaults.retryDelay = 1000;
// const headless = false;
// axios.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
//     let config = err.config;
//     if (!config || !config.retry) return Promise.reject(err);
//     config.__retryCount = config.__retryCount || 0;
//     if (config.__retryCount >= config.retry) {
//         return Promise.reject(err);
//     }
//     config.__retryCount += 1;
//     let backoff = new Promise(function (resolve) {
//         setTimeout(function () {
//             resolve();
//         }, config.retryDelay || 1);
//     });
//     return backoff.then(function () {
//         return axios(config);
//     });
// });
function now() {
    let time = new Date();
    time.setHours(time.getHours() + 8);
    return time;
}

function getIPAdress() {
    let interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        let iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
}

module.exports = {
    nowTime: function () {
        return now();
    },
    myIp: function () {
        return getIPAdress();
    },
    clusterPuppeteer: async function ({headless}) {
        return await Cluster.launch({
            puppeteer: puppeteer,
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 30,
            timeout: 60000,
            puppeteerOptions: {
                headless,
                args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            }
        });
    },
    douyin: async function ({headless, page, data, pageResolve}) {
        return new Promise(async (resolve, reject) => {
            const {order, timeout = 8000, callback} = data;
            const {orderId, id, money} = order;
            const start = now();
            let timeoutSetup = "";
            const qrcodePath = `./qrcode/${orderId}.png`;
            let success = false;
            let successTime = now().getTime();
            let timer = setTimeout(async () => {
                if (success) {
                    try {
                        await fs.unlink(qrcodePath)
                    } catch (ee) {
                        console.error(now(), ee)
                    }
                }
                if (!success) {
                    console.log(now(), `充值超时、请排查 -> ${timeoutSetup} -> ${JSON.stringify(data)}`)
                    pageResolve(false);
                    resolve({
                        "message": "timeout",
                        "setup": timeoutSetup,
                        "node": getIPAdress()
                    });
                }
            }, timeout - (now().getTime() - start.getTime()))
            await page.setRequestInterception(true);
            let intervalQuery = null;
            page.on("request", async interceptedRequest => {
                let url = interceptedRequest.url();
                if (url.includes("tp.cashier.trade_query") && intervalQuery == null && success) {
                    let data = interceptedRequest.postData();
                    let intervalCount = 0;
                    let callBackSuccess = false;
                    intervalQuery = setInterval(async () => {
                        if (intervalCount > (60 - (((successTime - start.getTime()) / 1000) | 0))) {
                            console.log(now(), "not pay", JSON.stringify(order))
                            clearInterval(intervalQuery);
                            if (success) {
                                try {
                                    await fs.unlink(qrcodePath)
                                } catch (ee) {
                                    console.error(ee)
                                }
                            }
                            if (callback) {
                                let postCallbackCount = 1;
                                let postCallback = async function () {
                                    await axios.post(callback, {
                                        "order": order,
                                        "pay": false,
                                        "node": getIPAdress()
                                    }).then(response => {
                                        console.log(now(), "超时未支付回调结果：" + JSON.stringify(response.data))
                                    }).catch(e => {
                                        if (postCallbackCount <= 2) {
                                            setTimeout(async function () {
                                                await postCallback();
                                            }, 1000 * postCallbackCount);
                                        }
                                        console.log(now(), e, `充值失败无法回调服务器、重试第 ${postCallbackCount} 次`)
                                        postCallbackCount += 1;
                                    })
                                }
                                await postCallback();
                            }
                        } else {
                            if (intervalQuery) {
                                await axios.post(
                                    "https://tp-pay.snssdk.com/gateway-cashier/tp.cashier.trade_query",
                                    data
                                )
                                    .then(async res => {
                                        if (res.data.data && res.data.data.trade_info.status === "SUCCESS" && !callBackSuccess) {
                                            callBackSuccess = true;
                                            console.log(now(), "pay success", JSON.stringify(order))
                                            clearInterval(intervalQuery);
                                            intervalQuery = null;
                                            if (success) {
                                                try {
                                                    await fs.unlink(qrcodePath)
                                                } catch (ee) {
                                                    console.error(ee)
                                                }
                                            }
                                            if (callback) {
                                                let postCallbackCount = 1;
                                                let postCallback = async function () {
                                                    await axios.post(callback, {
                                                        "order": order,
                                                        "pay": true,
                                                        "node": getIPAdress()
                                                    }).then(response => {
                                                        console.log(now(), "充值成功回调结果：" + JSON.stringify(response.data))
                                                    }).catch(e => {
                                                        if (postCallbackCount <= 2) {
                                                            setTimeout(async function () {
                                                                await postCallback();
                                                            }, 1000 * postCallbackCount);
                                                        }
                                                        console.log(now(), e, `充值成功无法回调服务器、重试第 ${postCallbackCount} 次`)
                                                        postCallbackCount += 1;
                                                    })
                                                }
                                                await postCallback();
                                            }
                                        }
                                    });
                            }
                        }
                        intervalCount += 1;
                    }, 1000);
                    pageResolve(false);
                }
                await interceptedRequest.continue();
            });
            console.log(now(), `${orderId} open page time -> ` + (now().getTime() - start.getTime()) + "ms")
            try {
                const cookieString = await fs.readFile("./cookie_douyin.json");
                const cookies = JSON.parse(cookieString);
                await page.setCookie(...cookies);
                await page.setViewport({
                    width: 800,
                    height: 1500
                });
                await page.goto("https://www.douyin.com/falcon/webcast_openpc/pages/douyin_recharge/index.html");
                console.log(now(), `open douyin time -> ` + (now().getTime() - start.getTime()) + "ms")
                {
                    timeoutSetup = "switchAccountButton";
                    //点击切换帐号
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.user-info > div.btn");
                    await element.click();
                }
                {
                    timeoutSetup = "inputAccount";
                    //输入帐号
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("aria/输入抖音号或绑定的手机号");
                    await element.type(id);
                }
                {
                    timeoutSetup = "inputAccount";
                    //点击确认
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.select-wrap > div.input-wrap > div.confirm-btn");
                    await element.click();
                }
                {
                    timeoutSetup = "waitAccountId";
                    //点击用户ID、等待ID出来
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.user-info > div.info > p");
                    await element.click();
                }
                {
                    timeoutSetup = "clickCustomMoneyInput";
                    //点击自定义金额
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.combo-list > div.customer-recharge > span.des");
                    await element.click();
                }
                {
                    timeoutSetup = "inputMoney";
                    //输入金额
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.combo-list > div.customer-recharge.active > div.money-container > div > input");
                    await element.type(money.toString());
                }
                {
                    timeoutSetup = "clickPayButton";
                    //确认支付
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div.pay-button");
                    await element.click();
                }
                {
                    timeoutSetup = "clickConfirmButton";
                    //确认为他人充值
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.check-content > div.footer-btn > div.right");
                    await element.click();
                }
                {
                    timeoutSetup = "clickWechatPay";
                    //点击微信支付
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div.pay-channel-wx");
                    await element.click();
                }
                let config = headless === false ? {
                    clip: {
                        x: 226,
                        y: 503,
                        width: 200,
                        height: 200
                    }
                } : {};
                {
                    timeoutSetup = "saveQrcode";
                    //保存二维码
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector('div.pay-method-scanpay-qrcode-image > svg');
                    await element.screenshot({
                        path: qrcodePath,
                        ...config
                    });
                }
                success = true;
                successTime = now().getTime();
                clearTimeout(timer);
                resolve({
                    "qrcode": `${process.env.SERVER_DOMAIN || ("http://localhost:" + (process.env.SERVER_PORT || 3000))}/file/${orderId}.png`,
                    "order": order,
                    "node": getIPAdress()
                })
            } catch (e) {
                console.error(now(), "充值异常请排查：" + e, order)
                // await page.close()
                resolve({
                    "message": "fail",
                    "setup": timeoutSetup,
                    "node": getIPAdress()
                })
                pageResolve(false);
            }
        })
    },
    huoshan: async function ({headless, page, data, pageResolve}) {
        return new Promise(async (resolve, reject) => {
            const {order, timeout = 8000, callback} = data;
            const {orderId, id, money} = order;
            const start = now();
            let timeoutSetup = "";
            const qrcodePath = `./qrcode/${orderId}.png`;
            let success = false;
            let successTime = now().getTime();
            let timer = setTimeout(async () => {
                if (success) {
                    try {
                        await fs.unlink(qrcodePath)
                    } catch (ee) {
                        console.error(now(), ee)
                    }
                }
                if (!success) {
                    console.log(now(), `充值超时、请排查 -> ${timeoutSetup} -> ${JSON.stringify(data)}`)
                    pageResolve(false);
                    resolve({
                        "message": "timeout",
                        "setup": timeoutSetup,
                        "node": getIPAdress()
                    });
                }
            }, timeout - (now().getTime() - start.getTime()))
            await page.setRequestInterception(true);
            let intervalQuery = null;
            page.on("request", async interceptedRequest => {
                let url = interceptedRequest.url();
                if (url.includes("tp.cashier.trade_query") && intervalQuery == null && success) {
                    let data = interceptedRequest.postData();
                    let intervalCount = 0;
                    let callBackSuccess = false;
                    intervalQuery = setInterval(async () => {
                        if (intervalCount > (60 - (((successTime - start.getTime()) / 1000) | 0))) {
                            console.log(now(), "not pay", JSON.stringify(order))
                            clearInterval(intervalQuery);
                            if (success) {
                                try {
                                    await fs.unlink(qrcodePath)
                                } catch (ee) {
                                    console.error(ee)
                                }
                            }
                            if (callback) {
                                let postCallbackCount = 1;
                                let postCallback = async function () {
                                    await axios.post(callback, {
                                        "order": order,
                                        "pay": false,
                                        "node": getIPAdress()
                                    }).then(response => {
                                        console.log(now(), "超时未支付回调结果：" + JSON.stringify(response.data))
                                    }).catch(e => {
                                        if (postCallbackCount <= 2) {
                                            setTimeout(async function () {
                                                await postCallback();
                                            }, 1000 * postCallbackCount);
                                        }
                                        console.log(now(), e, `充值失败无法回调服务器、重试第 ${postCallbackCount} 次`)
                                        postCallbackCount += 1;
                                    })
                                }
                                await postCallback();
                            }
                        } else {
                            if (intervalQuery) {
                                await axios.post(
                                    "https://tp-pay.snssdk.com/gateway-cashier/tp.cashier.trade_query",
                                    data
                                )
                                    .then(async res => {
                                        if (res.data.data && res.data.data.trade_info.status === "SUCCESS" && !callBackSuccess) {
                                            callBackSuccess = true;
                                            console.log(now(), "pay success", JSON.stringify(order))
                                            clearInterval(intervalQuery);
                                            intervalQuery = null;
                                            if (success) {
                                                try {
                                                    await fs.unlink(qrcodePath)
                                                } catch (ee) {
                                                    console.error(ee)
                                                }
                                            }
                                            if (callback) {
                                                let postCallbackCount = 1;
                                                let postCallback = async function () {
                                                    await axios.post(callback, {
                                                        "order": order,
                                                        "pay": true,
                                                        "node": getIPAdress()
                                                    }).then(response => {
                                                        console.log(now(), "充值成功回调结果：" + JSON.stringify(response.data))
                                                    }).catch(e => {
                                                        if (postCallbackCount <= 2) {
                                                            setTimeout(async function () {
                                                                await postCallback();
                                                            }, 1000 * postCallbackCount);
                                                        }
                                                        console.log(now(), e, `充值成功无法回调服务器、重试第 ${postCallbackCount} 次`)
                                                        postCallbackCount += 1;
                                                    })
                                                }
                                                await postCallback();
                                            }
                                        }
                                    });
                            }
                        }
                        intervalCount += 1;
                    }, 1000);
                    pageResolve(false);
                }
                await interceptedRequest.continue();
            });
            console.log(now(), `${orderId} open page time -> ` + (now().getTime() - start.getTime()) + "ms")
            try {
                const cookieString = await fs.readFile("./cookie_huoshan.json");
                const cookies = JSON.parse(cookieString);
                await page.setCookie(...cookies);
                await page.setViewport({
                    width: 800,
                    height: 1500
                });
                await page.goto("https://www.huoshan.com/falcon/webcast_openpc/pages/huoshan_recharge/index.html?is_new_connect=0&is_new_user=0");
                console.log(now(), `open huoshan time -> ` + (now().getTime() - start.getTime()) + "ms")
                {
                    timeoutSetup = "switchAccountButton";
                    //点击切换帐号
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.huoshan > div > div.user-info > div.btn");
                    await element.click();
                }
                {
                    timeoutSetup = "inputAccount";
                    //输入帐号
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("aria/输入火山号或绑定的手机号");
                    await element.type(id);
                }
                {
                    timeoutSetup = "inputAccount";
                    //点击确认
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.huoshan > div > div.select-wrap > div.input-wrap > div.confirm-btn");
                    await element.click();
                }
                {
                    timeoutSetup = "waitAccountId";
                    //点击用户ID、等待ID出来
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.huoshan > div > div.user-info > div.info > p");
                    await element.click();
                }
                {
                    timeoutSetup = "clickCustomMoneyInput";
                    //点击自定义金额
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.huoshan > div > div.combo-list > div.customer-recharge > span.des");
                    await element.click();
                }
                {
                    timeoutSetup = "inputMoney";
                    //输入金额
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.huoshan > div > div.combo-list > div.customer-recharge.active > div.money-container > div > input");
                    await element.type(money.toString());
                }
                {
                    timeoutSetup = "clickPayButton";
                    //确认支付
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div.pay-button");
                    await element.click();
                }
                {
                    timeoutSetup = "clickConfirmButton";
                    //确认为他人充值
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.check-content > div.footer-btn > div.right");
                    await element.click();
                }
                {
                    timeoutSetup = "clickWechatPay";
                    //点击微信支付
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div.pay-channel-wx");
                    await element.click();
                }
                let config = headless === false ? {
                    clip: {
                        x: 226,
                        y: 503,
                        width: 200,
                        height: 200
                    }
                } : {};
                {
                    timeoutSetup = "saveQrcode";
                    //保存二维码
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector('div.pay-method-scanpay-qrcode-image > svg');
                    await element.screenshot({
                        path: qrcodePath,
                        ...config
                    });
                }
                success = true;
                successTime = now().getTime();
                clearTimeout(timer);
                resolve({
                    "qrcode": `${process.env.SERVER_DOMAIN || ("http://localhost:" + (process.env.SERVER_PORT || 3000))}/file/${orderId}.png`,
                    "order": order,
                    "node": getIPAdress()
                })
            } catch (e) {
                console.error(now(), "充值异常请排查：" + e, order)
                // await page.close()
                resolve({
                    "message": "fail",
                    "setup": timeoutSetup,
                    "node": getIPAdress()
                })
                pageResolve(false);
            }
        })
    },
    login_douyin: async function (url) {
        return new Promise(async (resolve, reject) => {
            const browser = await puppeteer.launch({
                headless: true,
                devtools: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--shm-size=3gb']
            });
            const page = await browser.newPage();
            await page.goto("https://www.douyin.com/falcon/webcast_openpc/pages/douyin_recharge/index.html");
            await page.waitForTimeout(1000)
            const img = await page.waitForSelector(".qrcode-img")
            const loginPath = `./qrcode/login.png`;
            await img.screenshot({
                path: loginPath, omitBackground: true
            });
            let intervalCount = 0;
            const interval = setInterval(async () => {
                if (intervalCount > 55) {
                    console.log(now(), "超时未登录")
                    clearInterval(interval);
                    await browser.close();
                } else if (page.url().includes("is_new_connect")) {
                    console.log(now(), "登录成功")
                    clearInterval(interval);
                    const cookies = await page.cookies();
                    await fs.writeFile("./cookie_douyin.json", JSON.stringify(cookies))
                    if (url) {
                        await axios.post(url, {
                            cookies
                        }).then(response => {
                            console.log(now(), "登录成功回调结果：" + JSON.stringify(response.data))
                        })
                    }
                    await browser.close()
                }
                intervalCount += 1
            }, 1000)
            resolve("./qrcode/login.png");
        })
    },
    login_huoshan: async function (url) {
        return new Promise(async (resolve, reject) => {
            const browser = await puppeteer.launch({
                headless: true,
                devtools: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--shm-size=3gb']
            });
            const page = await browser.newPage();
            await page.goto("https://www.huoshan.com/falcon/webcast_openpc/pages/huoshan_recharge/index.html");
            await page.waitForTimeout(1000)
            const img = await page.waitForSelector(".qrcode-img")
            const loginPath = `./qrcode/login.png`;
            await img.screenshot({
                path: loginPath, omitBackground: true
            });
            let intervalCount = 0;
            const interval = setInterval(async () => {
                if (intervalCount > 55) {
                    console.log(now(), "超时未登录")
                    clearInterval(interval);
                    await browser.close();
                } else if (page.url().includes("is_new_connect")) {
                    console.log(now(), "登录成功")
                    clearInterval(interval);
                    const cookies = await page.cookies();
                    await fs.writeFile("./cookie_douyin.json", JSON.stringify(cookies))
                    if (url) {
                        await axios.post(url, {
                            cookies
                        }).then(response => {
                            console.log(now(), "登录成功回调结果：" + JSON.stringify(response.data))
                        })
                    }
                    await browser.close()
                }
                intervalCount += 1
            }, 1000)
            resolve("./qrcode/login.png");
        })
    },
    qrcode: async function (data) {
        return new Promise(async (resolve, reject) => {
            const {order, timeout = 8000, callback} = data;
            const {orderId, id, money} = order;
            const start = now();
            const browser = await puppeteer.launch({
                headless,
                devtools: false,
                args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            });
            let timeoutSetup = "";
            const qrcodePath = `./qrcode/${orderId}.png`;
            let success = false;
            let successTime = now().getTime();
            let timer = setTimeout(async () => {
                if (success) {
                    try {
                        await fs.unlink(qrcodePath)
                    } catch (ee) {
                        console.error(now(), ee)
                    }
                }
                if (!success) {
                    console.log(now(), `充值超时、请排查 -> ${timeoutSetup} -> ${JSON.stringify(data)}`)
                    await browser.close()
                    resolve({
                        "message": "timeout",
                        "setup": timeoutSetup,
                        "node": getIPAdress()
                    });
                }
            }, timeout - (now().getTime() - start.getTime()))
            const page = await browser.newPage();
            console.log(now(), `${orderId} open page time -> ` + (now().getTime() - start.getTime()) + "ms")
            await page.setViewport({
                width: 1920,
                height: 1080
            });
            try {
                const cookieString = await fs.readFile("./cookie_douyin.json");
                const cookies = JSON.parse(cookieString);
                await page.setCookie(...cookies);
                await page.goto("https://www.douyin.com/falcon/webcast_openpc/pages/douyin_recharge/index.html");
                console.log(now(), `open douyin time -> ` + (now().getTime() - start.getTime()) + "ms")
                {
                    timeoutSetup = "switchAccountButton";
                    //点击切换帐号
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.user-info > div.btn");
                    await element.click();
                }
                {
                    timeoutSetup = "inputAccount";
                    //输入帐号
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("aria/输入抖音号或绑定的手机号");
                    await element.type(id);
                }
                {
                    timeoutSetup = "inputAccount";
                    //点击确认
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.select-wrap > div.input-wrap > div.confirm-btn");
                    await element.click();
                }
                {
                    timeoutSetup = "waitAccountId";
                    //点击用户ID、等待ID出来
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.user-info > div.info > p");
                    await element.click();
                }
                {
                    timeoutSetup = "clickCustomMoneyInput";
                    //点击自定义金额
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.combo-list > div.customer-recharge > span.des");
                    await element.click();
                }
                {
                    timeoutSetup = "inputMoney";
                    //输入金额
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div.combo-list > div.customer-recharge.active > div.money-container > div > input");
                    await element.type(money.toString());
                }
                {
                    timeoutSetup = "clickPayButton";
                    //确认支付
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div.pay-button");
                    await element.click();
                }
                {
                    timeoutSetup = "clickConfirmButton";
                    //确认为他人充值
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.check-content > div.footer-btn > div.right");
                    await element.click();
                }
                {
                    timeoutSetup = "clickWechatPay";
                    //点击微信支付
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div.pay-channel-wx");
                    await element.click();
                }
                {
                    timeoutSetup = "saveQrcode";
                    //保存二维码
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector('div.pay-method-scanpay-qrcode-image > svg');
                    let config = headless === false ? {
                        clip: {
                            x: 226,
                            y: 503,
                            width: 200,
                            height: 200
                        }
                    } : {};
                    await element.screenshot({
                        path: qrcodePath,
                        ...config
                    });
                }
                let intervalCount = 0
                let interval = setInterval(async () => {
                    if (intervalCount > (60 - (((successTime - start.getTime()) / 1000) | 0))) {
                        console.log(now(), "not pay", orderId)
                        clearInterval(interval);
                        if (success) {
                            try {
                                await fs.unlink(qrcodePath)
                            } catch (ee) {
                                console.error(now(), ee)
                            }
                        }
                        await browser.close()
                        if (callback) {
                            await axios.post(callback, {
                                "order": order,
                                "pay": false,
                                "node": getIPAdress()
                            }).then(response => {
                                console.log(now(), "超时未支付回调结果：" + JSON.stringify(response.data))
                            }).catch(e => {
                                console.log(now(), "充值失败无法回调服务器")
                            })
                        }
                    } else if (page.url().includes("result?app_id")) {
                        clearInterval(interval);
                        console.log(now(), "pay success", JSON.stringify(order))
                        if (success) {
                            try {
                                await fs.unlink(qrcodePath)
                            } catch (ee) {
                                console.error(now(), ee)
                            }
                        }
                        await browser.close()
                        if (callback) {
                            let postCallbackCount = 1;
                            let postCallback = async function () {
                                await axios.post(callback, {
                                    "order": order,
                                    "pay": true,
                                    "node": getIPAdress()
                                }).then(response => {
                                    console.log(now(), "充值成功回调结果：" + JSON.stringify(response.data))
                                }).catch(e => {
                                    if (postCallbackCount <= 2) {
                                        setTimeout(async function () {
                                            await postCallback();
                                        }, 1000 * postCallbackCount);
                                    }
                                    console.log(now(), e, `充值成功无法回调服务器、重试第 ${postCallbackCount} 次`)
                                    postCallbackCount += 1;
                                })
                            }
                            await postCallback();
                        }
                    }
                    intervalCount += 1;
                }, 1000)
                success = true;
                successTime = now().getTime();
                clearTimeout(timer);
                resolve({
                    "qrcode": `${process.env.SERVER_DOMAIN || ("http://localhost:" + process.env.SERVER_PORT || 3000)}/file/${orderId}.png`,
                    "order": order,
                    "node": getIPAdress()
                })
            } catch (e) {
                console.error(now(), "充值异常请排查：" + e)
                await browser.close()
                resolve({
                    "message": "fail",
                    "setup": timeoutSetup,
                    "node": getIPAdress()
                })
            }
        })
    }
}