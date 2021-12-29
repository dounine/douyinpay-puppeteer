const Koa = require('koa');
const Router = require('koa-router');
const fs = require("fs");
const path = require("path");
const {nowTime, login_douyin, login_douyin2, login_huoshan, myIp, clusterPuppeteer, douyin, douyin2, huoshan} = require("./pupp");
const {kuaishou} = require('./kuaishou');
const bodyParser = require('koa-bodyparser');
const static = require('koa-static-router');
const cors = require('koa2-cors');
const app = new Koa();
const router = new Router();
const fsPromise = fs.promises;
const server_port = process.env.SERVER_PORT || 3000;
const headless = process.env.HEADLESS;
const callback = process.env.CALLBACK;
const mime = require('mime-types');

(async () => {
    let h = headless !== undefined ? headless === 'true' : true
    let cluster = await clusterPuppeteer({headless: h});
    let open_douyin = async function open({cluster}) {
        cluster.queue(async ({page}) => {
            let cookieString = await fsPromise.readFile("./cookie_douyin.json");
            let cookies = JSON.parse(cookieString);
            await page.setCookie(...cookies);
            await page.setViewport({
                width: 1920,
                height: 1080
            });
            await page.goto("https://www.douyin.com/falcon/webcast_openpc/pages/douyin_recharge/index.html");
            console.log(nowTime(), "缓存页面已打开")
            await page.waitForTimeout(50 * 1000);
            console.log(nowTime(), "缓存页面已关闭")
        })
    }
    // setInterval(async function () {
    //     await open({cluster});
    // }, 60 * 1000);
    // await open({cluster});
    fs.mkdir("./qrcode", (r) => {
        console.log(nowTime(), "create qrcode dir fold ", r)
    })
    app.use(cors({
        origin: function (ctx) {
            return "*"; // 允许来自所有域名请求
        },
        allowMethods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
    }))
    app.use(static({dir: "./qrcode", router: "/file"}))
    app.use(bodyParser());
    app.use(async (ctx, next) => {
        await next();
        const rt = ctx.response.get('X-Response-Time');
        console.log(nowTime(), `${ctx.method} ${ctx.url} - ${rt}`);
    });
    app.use(async (ctx, next) => {
        const start = Date.now();
        await next();
        const ms = Date.now() - start;
        ctx.set('X-Response-Time', `${ms}ms`);
    });
    router.get("/", async (ctx, next) => {
        ctx.response.body = {
            "node": myIp()
        }
    })
    router.get('/login/save/douyin.png', async (ctx, next) => {
        const result = await login_douyin2(ctx.request.header.url);
        let mimeType = mime.lookup(path.join(__dirname, result));
        ctx.set('content-type', mimeType);
        ctx.response.body = fs.createReadStream(path.join(__dirname, result));
    })
    router.get('/login/douyin.png', async (ctx, next) => {
        const result = await login_douyin(ctx.request.header.url);
        let mimeType = mime.lookup(path.join(__dirname, result));
        ctx.set('content-type', mimeType);
        ctx.response.body = fs.createReadStream(path.join(__dirname, result));
    })
    router.get('/login/huoshan.png', async (ctx, next) => {
        const result = await login_huoshan(ctx.request.header.url);
        let mimeType = mime.lookup(path.join(__dirname, result));
        ctx.set('content-type', mimeType);
        ctx.response.body = fs.createReadStream(path.join(__dirname, result));
    })
    router.post('/cookies/douyin', async (ctx, next) => {
        const body = ctx.request.body;
        await fsPromise.writeFile("./cookie_douyin.json", JSON.stringify(body.cookies))
        ctx.response.body = {
            "code": "ok",
            "node": myIp()
        };
    })
    router.post('/cookies/huoshan', async (ctx, next) => {
        const body = ctx.request.body;
        await fsPromise.writeFile("./cookie_huoshan.json", JSON.stringify(body.cookies))
        ctx.response.body = {
            "code": "ok",
            "node": myIp()
        };
    })
    router.post('/qrcode/douyin', async (ctx, next) => {
        let body = ctx.request.body;
        let order = body.order;
        let cookie = body.cookie || "";
        let timeout = body.timeout;
        let thisCallback = body.callback;
        let h = headless !== undefined ? headless === 'true' : true
        ctx.response.body = await new Promise((httpResolve, reject) => {
            cluster.queue(async ({page}) => {
                let pageResult = new Promise(async (pageResolve, pageReject) => {
                    let result = await douyin2({
                        headless: h,
                        page, data: {
                            order,
                            cookie,
                            timeout,
                            callback: callback || thisCallback,
                        },
                        pageResolve
                    });
                    httpResolve(result)
                })
                await pageResult;
            })
        })
    });
    router.post('/qrcode/kuaishou', async (ctx, next) => {
        let body = ctx.request.body;
        let order = body.order;
        let timeout = body.timeout;
        let thisCallback = body.callback;
        let h = headless !== undefined ? headless === 'true' : true
        ctx.response.body = await new Promise((httpResolve, reject) => {
            cluster.queue(async ({page}) => {
                let pageResult = new Promise(async (pageResolve, pageReject) => {
                    let result = await kuaishou({
                        headless: h,
                        page, data: {
                            order,
                            timeout,
                            callback: callback || thisCallback,
                        },
                        pageResolve
                    });
                    httpResolve(result)
                })
                await pageResult;
            })
        })
    });
    router.post('/qrcode/huoshan', async (ctx, next) => {
        let body = ctx.request.body;
        let order = body.order;
        let timeout = body.timeout;
        let thisCallback = body.callback;
        ctx.response.body = await new Promise((httpResolve, reject) => {
            cluster.queue(async ({page}) => {
                let pageResult = new Promise(async (pageResolve, pageReject) => {
                    let result = await huoshan({
                        headless,
                        page, data: {
                            order,
                            timeout,
                            callback: callback || thisCallback,
                        },
                        pageResolve
                    });
                    httpResolve(result)
                })
                await pageResult;
            })
        })
    });
    app.use(router.routes()).use(router.allowedMethods());
    app.listen(server_port, () => {
        console.log(nowTime(), `start server for ${myIp()}:${server_port}`)
    });
})();
