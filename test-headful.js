const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const { PAGE_WIDTH, PAGE_HEIGHT } = require('./const');

puppeteer.use(StealthPlugin());

let browser;

const _extract = async (url) => {
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  await page.setJavaScriptEnabled(false);
  await page.goto(url);
};

const main = async () => {
  if (!browser) browser = await puppeteer.launch({ headless: false, executablePath: '/usr/bin/chromium-browser' });

  let url;
  //url = 'https://www.wsj.com';
  //url = 'https://www.wsj.com/articles/senate-republicans-set-to-block-bill-tying-short-term-funding-bill-to-debt-ceiling-11632772705?mod=hp_lead_pos1';
  //url = 'https://www.theguardian.com';
  //url = 'https://www.theguardian.com/world/2021/sep/28/north-korea-fires-projectile-into-sea-of-japan-reports';
  //url = 'https://www.newstatesman.com';
  //url = 'https://www.newstatesman.com/german-election-2021/2021/09/german-election-2021-live-results-and-analysis';
  //url = 'https://www.coindesk.com';
  //url = 'https://www.coindesk.com/policy/2021/09/27/ethereum-developer-virgil-griffith-pleads-guilty-to-conspiracy-charge-in-north-korea-sanctions-case/';
  //url = 'https://ch3plus.com';
  //url = 'https://ch3plus.com/oldseries/598';
  //url = 'https://ch3plus.com/v/57692';
  //url = 'https://mgronline.com/';
  //url = 'https://mgronline.com/mutualfund/detail/9640000095930';
  //url = 'https://chrome.google.com/webstore/detail/responsive-viewer/inmopeiepgfljkpkidclfgbgbmfcennb';
  //url = 'https://www.forbes.com/sites/tableauapac/2020/06/23/cultivate-data-talent-to-enable-rapid-response/#3aed09a52530';
  //url = 'https://stateofthenation.co/?p=42031';
  url = 'https://twitter.com/Vdsxx1/status/1323716581571121156?s=09';
  await _extract(url);
};

main();
