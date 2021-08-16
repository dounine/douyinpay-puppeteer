FROM dounine/puppeteer:latest
ENV NODE_ENV="pro" \
    SERVER_DOMAIN="http://localhost:3000" \
    SERVER_PORT="3000"
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN echo 'Asia/Shanghai' > /etc/timezone
WORKDIR /app
ADD cache /app/cache
ADD package.json /app
RUN npm install
COPY *.json /app/
COPY *.js /app/
EXPOSE 3000
ENTRYPOINT ["/usr/bin/dumb-init"]
CMD ["node","index.js"]