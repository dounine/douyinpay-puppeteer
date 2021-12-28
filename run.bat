git pull
for /F %%i in ('curl "https://douyinapi.61week.com/api/ip?type=ip"') do ( set IP=%%i)
SET SERVER_PORT=30000
SET SERVER_DOMAIN=http://%IP%:30000
SET HEADLESS=false
SET CALLBACK=https://backup.61week.com/api/order/update
node index.js