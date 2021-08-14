const puppeteer = require('puppeteer');
const fs = require("fs").promises;
const path = require('path');
const mineType = require('mime-types');
const axios = require("axios");
const config = require("./config.json");

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

module.exports = {
    qrcode: async function ({orderId, id, money, timeout = 8000, callback}) {
        return new Promise(async (resolve, reject) => {
            const start = new Date();
            const browser = await puppeteer.launch({
                headless: true,
                devtools: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            let timeoutSetup = "";
            const qrcodePath = `./qrcode/${orderId}.png`;
            setTimeout(async () => {
                await fs.unlink(qrcodePath)
                await browser.close()
                resolve({
                    "message": "timeout",
                    "setup": timeoutSetup
                });
            }, timeout - (new Date().getTime() - start.getTime()))
            const page = await browser.newPage();
            await page.setRequestInterception(true);
            const rejectUrls = ["bg-douyin.5d11bb39.png", "https://lf1-cdn-tos.bytescm.com/obj/venus/favicon.ico"];
            const cacheUrls = ["index.0f6f463c.js", "page.4e076066.js", "sentry.3.6.35.cn.js", "secsdk.umd.js", "secsdk.umd.js", "vendor.dbbc2d7d.js", "acrawler.js"];
            page.on("request", async interceptedRequest => {
                let url = interceptedRequest.url();
                if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg")) {
                    // console.log("abort", url)
                    interceptedRequest.abort();
                } else if (rejectUrls.find(el => url.includes(el))) {
                    // console.log("abort", url)
                    await interceptedRequest.abort();
                } else if (cacheUrls.find(el => url.includes(el))) {
                    // console.log("cache", url)
                    let endUrl = cacheUrls.find(el => url.includes(el))
                    await interceptedRequest.respond({
                        contentType: "application/javascript",
                        body: await fs.readFile("./cache/" + endUrl)
                    });
                } else {
                    await interceptedRequest.continue();
                }
            });
            console.log(`${orderId} open page time -> ` + (new Date().getTime() - start.getTime()) + "ms")
            await page.setViewport({
                width: 1920,
                height: 1080
            });
            try {
                const cookieString = await fs.readFile("./cookie.json");
                const cookies = JSON.parse(cookieString);
                await page.setCookie(...cookies);
                await page.goto("https://www.douyin.com/falcon/webcast_openpc/pages/douyin_recharge/index.html");
                console.log("open douyin time -> " + (new Date().getTime() - start.getTime()) + "ms")
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
                    const element = await frame.waitForSelector("html > body > div > div > div.bounce-container > div.bounce-content > div > div:nth-child(1) > div.pay > ul > li:nth-child(1) > div");
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
                timeoutSetup = "qrcodeToBase64";
                // const imgBuffer = await fs.readFile(path.resolve(qrcodePath));
                // const data = Buffer.from(imgBuffer).toString("base64")
                // const base64 = 'data:' + mineType.lookup(path.resolve(qrcodePath)) + ';base64,' + data;
                let intervalCount = 0
                let interval = setInterval(async () => {
                    if (intervalCount > 60) {
                        console.log("not pay", orderId)
                        clearInterval(interval);
                        await fs.unlink(qrcodePath).catch(e => {
                            console.log(e)
                        })
                        await browser.close()
                        if (callback) {
                            await axios.post(callback, {
                                "orderId": orderId,
                                "pay": false
                            }).then(response => {
                                console.log(response.data)
                            })
                        }
                    } else if (page.url().includes("result?app_id")) {
                        console.log("pay success", orderId)
                        await fs.unlink(qrcodePath).catch(e => {
                            console.log(e)
                        })
                        clearInterval(interval);
                        await browser.close()
                        if (callback) {
                            await axios.post(callback, {
                                "orderId": orderId,
                                "pay": true
                            }).then(response => {
                                console.log("callback result", response.data)
                            })
                        }
                    }
                    intervalCount += 1;
                }, 1000)
                resolve({
                    "qrcode": `${config[config["model"]]}/file/${orderId}.png`
                })
            } catch (e) {
                console.error(e)
                await browser.close()
                await fs.unlink(qrcodePath).catch(e => {
                    console.log(e)
                })
                resolve({
                    "message": "fail",
                    "setup": timeoutSetup
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