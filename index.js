const Koa = require('koa');
const Router = require('koa-router');
const fs = require("fs");
const path = require("path");
const {qrcode, login, myIp} = require("./pupp");
const bodyParser = require('koa-bodyparser');
const static = require('koa-static-router');
const cors = require('koa2-cors');
const app = new Koa();
const router = new Router();
const fsPromise = fs.promises;
const server_port = process.env.SERVER_PORT || 3000


fs.mkdir("./qrcode", (r) => {
    console.log("create qrcode dir fold ", r)
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
    console.log(`${new Date()} ${ctx.method} ${ctx.url} - ${rt}`);
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
router.get('/login.png', async (ctx, next) => {
    const result = await login(ctx.request.header.url);
    ctx.response.body = fs.createReadStream(path.join(__dirname, result));
})
router.post('/cookies', async (ctx, next) => {
    const body = ctx.request.body;
    await fsPromise.writeFile("./cookie.json", JSON.stringify(body.cookies))
    ctx.response.body = {
        "code": "ok",
        "node": myIp()
    };
})
router.post('/qrcode', async (ctx, next) => {
    let body = ctx.request.body;
    let orderId = body.orderId;
    let timeout = body.timeout;
    let id = body.id;
    let money = body.money;
    let callback = body.callback;
    ctx.response.body = await qrcode({
        orderId,
        id,
        money,
        timeout,
        callback,
    })
});
app.use(router.routes()).use(router.allowedMethods());
app.listen(server_port, () => {
    console.log(`start server for ${myIp()}:${server_port}`)
});
