const fs = require("fs").promises;
const path = require('path');
const os = require('os');
const axios = require("axios");

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
    kuaishou: async function ({headless, page, data, pageResolve}) {
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
            page.on('response', async response => {
                const url = response.url();
                if (url.includes("https://www.kuaishoupay.com/pay/order/pc/trade/cashier")) {
                    let data = await response.json();
                    // console.log('cashier', data)
                    if (data.qrcode_url) {
                        success = true;
                        successTime = now().getTime();
                        clearTimeout(timer);
                        resolve({
                            "codeUrl": data.qrcode_url,
                            "order": order,
                            "code": 0,
                            "node": getIPAdress()
                        })
                    }
                }
            });
            page.on("request", async interceptedRequest => {
                let url = interceptedRequest.url();
                if (url.includes("https://www.kuaishoupay.com/pay/order/pc/trade/query") && intervalQuery == null && success) {
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
                                    "https://www.kuaishoupay.com/pay/order/pc/trade/query",
                                    data
                                )
                                    .then(async res => {
                                        // console.log('query', res.data)
                                        if (res.data && res.data.order_state !== "PROCESSING" && !callBackSuccess) {
                                            callBackSuccess = true;
                                            console.log(now(), "pay success", JSON.stringify(order))
                                            clearInterval(intervalQuery);
                                            intervalQuery = null;
                                            if (success) {
                                                try {
                                                    await fs.unlink(qrcodePath)
                                                } catch (ee) {
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
                    await interceptedRequest.continue();
                } else {
                    await interceptedRequest.continue();
                }
            });
            console.log(now(), `${orderId} open page time -> ` + (now().getTime() - start.getTime()) + "ms")
            try {
                await page.goto('https://pay.ssl.kuaishou.com/pay')

                {
                    const element = await page.waitForSelector('ul > li > .item-value > .ks-number > input')
                    await element.click();
                }
                {
                    const element = await page.waitForSelector("aria/请输入快手号/快手ID");
                    await element.type(id);
                }
                {
                    const element = await page.waitForSelector('.confirm-btn')
                    await element.click();
                }
                await page.waitForTimeout(500);
                {
                    const element = await page.waitForSelector('.money-cell > div > .recharge > .recharge-gear > .other-recharge-text')
                    await element.click();
                }
                {
                    const element = await page.waitForSelector('.input-recharge')
                    await element.type(money.toString());
                }
                {
                    const element = await page.waitForSelector('.pay-wrap > ul > li > div > .go-button')
                    await element.click();
                }
            } catch (e) {
                console.error(e)
                console.error(now(), "充值异常请排查：" + e, order)
                resolve({
                    "message": "fail",
                    "setup": "",
                    "code": -1,
                    "node": getIPAdress()
                })
                pageResolve(false);
            }
        })


    },
}