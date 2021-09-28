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
};

const backupResults = {

};

module.exports = { manualResults, backupResults };
