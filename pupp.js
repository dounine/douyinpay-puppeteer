const puppeteer = require('puppeteer');
const fs = require("fs").promises;
const path = require('path');
const mineType = require('mime-types');

module.exports = {
    qrcode: async function ({orderId, id, money, timeout = 8000, callback}) {
        return new Promise(async (resolve, reject) => {
            const start = new Date();
            const browser = await puppeteer.launch({
                headless: true,
                devtools: false
            });
            let timeoutSetup = "";
            setTimeout(async () => {
                await browser.close()
                resolve({
                    "code": "fail",
                    "message": "timeout",
                    "data": {
                        "setup": timeoutSetup
                    }
                });
            }, timeout - (new Date().getTime() - start.getTime()))
            const qrcodePath = `./qrcode/${orderId}.png`;
            const [page] = await browser.pages();
            console.log(`${orderId} open page time -> ` + (new Date().getTime() - start.getTime()) + "ms")
            await page.setViewport({
                width: 1920,
                height: 1280
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
                    const element = await frame.waitForSelector("div#root > div > div.page-box.douyin > div > div:nth-child(6) > div.pay-button > span");
                    await element.click();
                }
                {
                    timeoutSetup = "clickPayButton";
                    //确认为他人充值
                    const targetPage = page;
                    const frame = targetPage.mainFrame();
                    const element = await frame.waitForSelector("div#root > div > div.check-content > div.footer-btn > div.right");
                    await element.click();
                }
                {
                    timeoutSetup = "clickPayButton";
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
                const imgBuffer = await fs.readFile(path.resolve(qrcodePath));
                const data = Buffer.from(imgBuffer).toString("base64")
                const base64 = 'data:' + mineType.lookup(path.resolve(qrcodePath)) + ';base64,' + data;
                await browser.close()
                resolve({
                    "code": "ok",
                    "data": {
                        "qrcode": base64
                    }
                })
            } catch (e) {
                console.error(e)
                await browser.close()
                resolve({
                    "code": "fail",
                    "message": "fail",
                    "data": {
                        "setup": timeoutSetup
                    }
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