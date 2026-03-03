# github.com/GoogleCloudPlatform/jobs-demos/tree/main/screenshot
FROM ghcr.io/puppeteer/puppeteer:24.37.5

# github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
ENV NPM_CONFIG_PREFIX=/home/pptruser/.npm-global
ENV PATH=$PATH:/home/pptruser/.npm-global/bin

# github.com/moby/moby/issues/36677
RUN mkdir -p /home/pptruser/brace-server-worker
WORKDIR /home/pptruser/brace-server-worker

COPY --chown=pptruser:pptruser package.json package-lock.json ./

RUN npm ci
COPY --chown=pptruser:pptruser . .

ENTRYPOINT ["node", "--import=specifier-resolution-node/register", "src/index.js"]
