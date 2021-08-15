FROM dounine/puppeteer:latest
ENV NODE_ENV="pro" \
    SERVER_DOMAIN="http://localhost:4000" \
    SERVER_PORT="4000"
WORKDIR /app
ADD cache /app/cache
ADD package.json /app
RUN npm install
COPY *.json .
COPY *.js .
EXPOSE 4000
ENTRYPOINT ["/usr/bin/dumb-init"]
CMD ["node","index.js"]