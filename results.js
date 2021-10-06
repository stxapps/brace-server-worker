/*
 * In brace-server-worker, a result doesn't need to be completed
 *   because here has time to extract one by one.
 */
const manualResults = {
  'www.newstatesman.com*': {
    image: 'https://storage.googleapis.com/brace-static-files/T9FBbGYYm79APz4ta47GdUAuia5qyFByROWCYU5ZhgVQSYPp.png',
  },
  'www.newstatesman.com/**/${TITLE}': null,
  'www.coindesk.com*': {
    favicon: 'https://www.coindesk.com/favicon.ico',
  },
  'www.google.com*': {
    image: 'https://storage.googleapis.com/brace-static-files/0Oj2AtmCIV7QPeupx0x74jLF8k6LLMy0j1QuspKzS8kwoNzW.png',
  },
  'forum.stacks.org*': {
    image: 'https://storage.googleapis.com/brace-static-files/MHyrjaJnWpInBseYqbpPcYawkbIiK4iP9rmd49h158yNz0uj.png',
  },
  'twitter.com*': {
    image: 'https://storage.googleapis.com/brace-static-files/VYleenlIdpxweGqiv6xdDBLSp6GliwAUGEHSuCJNT2ZjcFqB.png',
  },
};

const backupResults = {

};

module.exports = { manualResults, backupResults };
