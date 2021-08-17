const puppeteer = require('puppeteer');
const fs = require("fs").promises;
const path = require('path');
const mineType = require('mime-types');
const os = require('os');
const axios = require("axios");
const {Cluster} = require('puppeteer-cluster');
axios.defaults.retry = 4;
axios.defaults.retryDelay = 1000;
axios.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
    let config = err.config;
    if (!config || !config.retry) return Promise.reject(err);
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= config.retry) {
        return Promise.reject(err);
    }
    config.__retryCount += 1;
    let backoff = new Promise(function (resolve) {
        setTimeout(function () {
            resolve();
        }, config.retryDelay || 1);
    });
    return backoff.then(function () {
        return axios(config);
    });
});

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
    myIp: function () {
        return getIPAdress();
    },
    clusterPuppeteer: async function () {
        return await Cluster.launch({
            puppeteer: puppeteer,
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 30,
            timeout: 60000,
            puppeteerOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            }
        });
    },
    query: async function ({page, data, pageResolve}) {
        return new Promise(async (resolve, reject) => {
            const {order, timeout = 8000, callback} = data;
            const {orderId, id, money} = order;
            const start = new Date();
            // const browser = await puppeteer.launch({
            //     headless: true,
            //     devtools: false,
            //     args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            // });
            let timeoutSetup = "";
            const qrcodePath = `./qrcode/${orderId}.png`;
            let success = false;
            let successTime = new Date().getTime();
            let timer = setTimeout(async () => {
                if (success) {
                    try {
                        await fs.unlink(qrcodePath)
                    } catch (ee) {
                        console.error(new Date(), ee)
                    }
                }
                if (!success) {
                    console.log(new Date(), `充值超时、请排查 -> ${timeoutSetup} -> ${JSON.stringify(data)}`)
                    pageResolve(false);
                    // await page.close()
                    resolve({
                        "message": "timeout",
                        "setup": timeoutSetup,
                        "node": getIPAdress()
                    });
                }
            }, timeout - (new Date().getTime() - start.getTime()))
            // const page = await browser.newPage();
            // await page.setRequestInterception(true);
            const rejectUrls = ["bg-douyin.5d11bb39.png", "https://lf1-cdn-tos.bytescm.com/obj/venus/favicon.ico"];
            const cacheUrls = ["index.0f6f463c.js", "page.4e076066.js", "sentry.3.6.35.cn.js", "secsdk.umd.js", "secsdk.umd.js", "vendor.dbbc2d7d.js", "acrawler.js"];
            // page.on("request", async interceptedRequest => {
            //     let url = interceptedRequest.url();
            //     if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg")) {
            //         await interceptedRequest.abort();
            //     } else if (rejectUrls.find(el => url.includes(el))) {
            //         await interceptedRequest.abort();
            //     } else if (cacheUrls.find(el => url.includes(el))) {
            //         let endUrl = cacheUrls.find(el => url.includes(el))
            //         await interceptedRequest.respond({
            //             contentType: "application/javascript",
            //             body: await fs.readFile("./cache/" + endUrl)
            //         });
            //     } else {
            //         await interceptedRequest.continue();
            //     }
            // });
            console.log(new Date(), `${orderId} open page time -> ` + (new Date().getTime() - start.getTime()) + "ms")
            try {
                const cookieString = await fs.readFile("./cookie.json");
                const cookies = JSON.parse(cookieString);
                await page.setCookie(...cookies);
                await page.setViewport({
                    width: 1920,
                    height: 1080
                });
                await page.goto("https://www.douyin.com/falcon/webcast_openpc/pages/douyin_recharge/index.html");
                console.log(new Date(), `open douyin time -> ` + (new Date().getTime() - start.getTime()) + "ms")
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
                    await element.screenshot({
                        path: qrcodePath, omitBackground: true
                    });
                }
                // timeoutSetup = "qrcodeToBase64";
                // const imgBuffer = await fs.readFile(path.resolve(qrcodePath));
                // const data = Buffer.from(imgBuffer).toString("base64")
                // const base64 = 'data:' + mineType.lookup(path.resolve(qrcodePath)) + ';base64,' + data;
                let intervalCount = 0
                let interval = setInterval(async () => {
                    if (intervalCount > (60 - (((successTime - start.getTime()) / 1000) | 0))) {
                        console.log(new Date(), "not pay", orderId)
                        clearInterval(interval);
                        if (success) {
                            try {
                                await fs.unlink(qrcodePath)
                            } catch (ee) {
                                console.error(ee)
                            }
                        }
                        // await page.close()
                        pageResolve(false);
                        if (callback) {
                            await axios.post(callback, {
                                "order": order,
                                "pay": false,
                                "node": getIPAdress()
                            }).then(response => {
                                console.log(new Date(), "超时未支付回调结果：" + JSON.stringify(response.data))
                            }).catch(e => {
                                console.log(new Date(), "充值失败无法回调服务器")
                            })
                        }
                    } else if (page.url().includes("result?app_id")) {
                        clearInterval(interval);
                        console.log(new Date(), "pay success", JSON.stringify(order))
                        if (success) {
                            try {
                                await fs.unlink(qrcodePath)
                            } catch (ee) {
                                console.error(ee)
                            }
                        }
                        // await page.close()
                        if (callback) {
                            await axios.post(callback, {
                                "order": order,
                                "pay": true,
                                "node": getIPAdress()
                            }).then(response => {
                                console.log(new Date(), "充值成功回调结果：" + JSON.stringify(response.data))
                            }).catch(e => {
                                console.log(new Date(), "充值成功无法回调服务器")
                            })
                        }
                        pageResolve(true);
                    }
                    intervalCount += 1;
                }, 1000)
                success = true;
                successTime = new Date().getTime();
                clearTimeout(timer);
                resolve({
                    "qrcode": `${process.env.SERVER_DOMAIN || ("http://localhost:" + (process.env.SERVER_PORT || 3000))}/file/${orderId}.png`,
                    "order": order,
                    "node": getIPAdress()
                })
            } catch (e) {
                console.error(new Date(), "充值异常请排查：" + e, order)
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
    login: async function (url) {
        return new Promise(async (resolve, reject) => {
            const browser = await puppeteer.launch({
                headless: true,
                devtools: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
                    console.log(new Date(), "超时未登录")
                    clearInterval(interval);
                    await browser.close();
                } else if (page.url().includes("is_new_connect")) {
                    console.log(new Date(), "登录成功")
                    clearInterval(interval);
                    const cookies = await page.cookies();
                    await fs.writeFile("./cookie.json", JSON.stringify(cookies))
                    await axios.post(url, {
                        cookies
                    }).then(response => {
                        console.log(new Date(), "登录成功回调结果：" + JSON.stringify(response.data))
                    })
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
            const start = new Date();
            const browser = await puppeteer.launch({
                headless: true,
                devtools: false,
                args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            });
            let timeoutSetup = "";
            const qrcodePath = `./qrcode/${orderId}.png`;
            let success = false;
            let successTime = new Date().getTime();
            let timer = setTimeout(async () => {
                if (success) {
                    try {
                        await fs.unlink(qrcodePath)
                    } catch (ee) {
                        console.error(new Date(), ee)
                    }
                }
                if (!success) {
                    console.log(new Date(), `充值超时、请排查 -> ${timeoutSetup} -> ${JSON.stringify(data)}`)
                    await browser.close()
                    resolve({
                        "message": "timeout",
                        "setup": timeoutSetup,
                        "node": getIPAdress()
                    });
                }
            }, timeout - (new Date().getTime() - start.getTime()))
            const page = await browser.newPage();
            // await page.setRequestInterception(true);
            const rejectUrls = ["bg-douyin.5d11bb39.png", "https://lf1-cdn-tos.bytescm.com/obj/venus/favicon.ico"];
            const cacheUrls = ["index.0f6f463c.js", "page.4e076066.js", "sentry.3.6.35.cn.js", "secsdk.umd.js", "secsdk.umd.js", "vendor.dbbc2d7d.js", "acrawler.js"];
            // page.on("request", async interceptedRequest => {
            //     let url = interceptedRequest.url();
            //     if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg")) {
            //         await interceptedRequest.abort();
            //     } else if (rejectUrls.find(el => url.includes(el))) {
            //         await interceptedRequest.abort();
            //     } else if (cacheUrls.find(el => url.includes(el))) {
            //         let endUrl = cacheUrls.find(el => url.includes(el))
            //         await interceptedRequest.respond({
            //             contentType: "application/javascript",
            //             body: await fs.readFile("./cache/" + endUrl)
            //         });
            //     } else {
            //         await interceptedRequest.continue();
            //     }
            // });
            console.log(new Date(), `${orderId} open page time -> ` + (new Date().getTime() - start.getTime()) + "ms")
            await page.setViewport({
                width: 1920,
                height: 1080
            });
            try {
                const cookieString = await fs.readFile("./cookie.json");
                const cookies = JSON.parse(cookieString);
                await page.setCookie(...cookies);
                await page.goto("https://www.douyin.com/falcon/webcast_openpc/pages/douyin_recharge/index.html");
                console.log(new Date(), `open douyin time -> ` + (new Date().getTime() - start.getTime()) + "ms")
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
                    await element.screenshot({
                        path: qrcodePath, omitBackground: true
                    });
                }
                // timeoutSetup = "qrcodeToBase64";
                // const imgBuffer = await fs.readFile(path.resolve(qrcodePath));
                // const data = Buffer.from(imgBuffer).toString("base64")
                // const base64 = 'data:' + mineType.lookup(path.resolve(qrcodePath)) + ';base64,' + data;
                let intervalCount = 0
                let interval = setInterval(async () => {
                    if (intervalCount > (60 - (((successTime - start.getTime()) / 1000) | 0))) {
                        console.log(new Date(), "not pay", orderId)
                        clearInterval(interval);
                        if (success) {
                            try {
                                await fs.unlink(qrcodePath)
                            } catch (ee) {
                                console.error(new Date(), ee)
                            }
                        }
                        await browser.close()
                        if (callback) {
                            await axios.post(callback, {
                                "order": order,
                                "pay": false,
                                "node": getIPAdress()
                            }).then(response => {
                                console.log(new Date(), "超时未支付回调结果：" + JSON.stringify(response.data))
                            }).catch(e => {
                                console.log(new Date(), "充值失败无法回调服务器")
                            })
                        }
                    } else if (page.url().includes("result?app_id")) {
                        clearInterval(interval);
                        console.log(new Date(), "pay success", JSON.stringify(order))
                        if (success) {
                            try {
                                await fs.unlink(qrcodePath)
                            } catch (ee) {
                                console.error(new Date(), ee)
                            }
                        }
                        await browser.close()
                        if (callback) {
                            await axios.post(callback, {
                                "order": order,
                                "pay": true,
                                "node": getIPAdress()
                            }).then(response => {
                                console.log(new Date(), "充值成功回调结果：" + JSON.stringify(response.data))
                            }).catch(e => {
                                console.log(new Date(), "充值成功无法回调服务器")
                            })
                        }
                    }
                    intervalCount += 1;
                }, 1000)
                success = true;
                successTime = new Date().getTime();
                clearTimeout(timer);
                resolve({
                    "qrcode": `${process.env.SERVER_DOMAIN || ("http://localhost:" + process.env.SERVER_PORT || 3000)}/file/${orderId}.png`,
                    "order": order,
                    "node": getIPAdress()
                })
            } catch (e) {
                console.error(new Date(), "充值异常请排查：" + e)
                await browser.close()
                resolve({
                    "message": "fail",
                    "setup": timeoutSetup,
                    "node": getIPAdress()
                })
            }
        })
        // setTimeout(async function () {
        //     const cookies = await page.cookies();
        //     await fs.writeFile("./cookie.json", JSON.stringify(cookies))
        //     await browser.close()
        // }, 1000 * 60)
    }
}