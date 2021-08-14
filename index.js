const Koa = require('koa');
const Router = require('koa-router');
const fs = require("fs");
const path = require("path");
const {qrcode} = require("./pupp");
const bodyParser = require('koa-bodyparser');
const static = require('koa-static-router')
const app = new Koa();
const router = new Router();
fs.mkdir("./qrcode", (r) => {
    console.log("create qrcode dir fold ", r)
})
app.use(static({dir: "./qrcode", router: "/file"}))
app.use(bodyParser());
app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.get('X-Response-Time');
    console.log(`${ctx.method} ${ctx.url} - ${JSON.stringify(ctx.request.body || {})} - ${rt}`);
});
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});
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
        callback
    })
});
app.use(router.routes());
app.listen(3000, () => {

});
