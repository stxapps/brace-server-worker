# github.com/GoogleCloudPlatform/jobs-demos/tree/main/screenshot
FROM ghcr.io/puppeteer/puppeteer:23.2.1

# github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
ENV NPM_CONFIG_PREFIX=/home/pptruser/.npm-global
ENV PATH=$PATH:/home/pptruser/.npm-global/bin

RUN npm install --global yarn

# github.com/moby/moby/issues/36677
RUN mkdir -p /home/pptruser/brace-server-worker
WORKDIR /home/pptruser/brace-server-worker

COPY --chown=pptruser:pptruser package.json yarn.lock ./

RUN yarn

COPY --chown=pptruser:pptruser . .

ENTRYPOINT ["node", "--import=specifier-resolution-node/register", "src/index.js"]
