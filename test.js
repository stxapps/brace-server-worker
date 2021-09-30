const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { writeFile } = require('fs');

const {
  randomString, extractUrl, removeUrlProtocolAndSlashes, cleanText, getExtractedResult,
  deriveExtractedTitle, isExtractedResultComplete, canTextInDb, containRedirectWords,
} = require('./utils');
const {
  N_EXTRACTS, PAGE_WIDTH, PAGE_HEIGHT,
  EXTRACT_INIT, EXTRACT_OK, EXTRACT_ERROR, DERIVED_VALUE,
} = require('./const');
const { manualResults, backupResults } = require('./results');

puppeteer.use(StealthPlugin());

let browser;

const getExtractedResultEntities = (status) => new Promise((resolve, reject) => {
  //resolve([{ url: 'https://www.coindesk.com/policy/2021/09/27/ethereum-developer-virgil-griffith-pleads-guilty-to-conspiracy-charge-in-north-korea-sanctions-case/' }, { url: 'https://chrome.google.com/webstore/detail/responsive-viewer/inmopeiepgfljkpkidclfgbgbmfcennb' }]);
  resolve([{ url: 'https://www.workaway.info' }]);
});

const saveImage = (image) => new Promise((resolve, reject) => {
  const fname = randomString(48) + '.png';
  writeFile(fname, image, { encoding: 'binary' }, (err) => {
    if (err) {
      reject(err);
      return;
    }

    const publicUrl = `${fname}`;
    resolve(publicUrl);
  });
});

const saveExtractedResult = async (extractedResultEntity, extractedResult) => {
  //console.log(extractedResult);
};

const saveExtractedLog = async (logKey, logData) => {
  console.log(logData);
};

const _extract = async (url, logKey, seq, isJsEnabled, extractedResult) => {

  // Can't do it here! As awaiting, browser is still undefined,
  //   other async processes will still launch it.
  //if (!browser) browser = await puppeteer.launch({ headless: true });

  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  await page.setJavaScriptEnabled(isJsEnabled);
  try {
    await page.goto(url, { timeout: 24000, waitUntil: 'networkidle0' });
  } catch (e) {
    if (e.name === 'TimeoutError') {
      console.log(`(${logKey}-${seq}) _extract throws TimeoutError but continue extracting`);
    } else throw e;
  }

  const { host, origin } = extractUrl(url);

  if (!extractedResult.title) {
    const text = await page.evaluate(() => {
      const el = [...document.head.getElementsByTagName('meta')].filter(el => {
        const values = ['twitter:title', 'og:title'];
        if (values.includes(el.getAttribute('name'))) return true;
        if (values.includes(el.getAttribute('property'))) return true;
        if (el.getAttribute('itemprop') === 'headline') return true;
        return false;
      }).slice(-1)[0];
      if (!el) return null;

      return el.getAttribute('content');
    });
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length > 0 && canTextInDb(cleansedText)) {
        extractedResult.title = cleansedText;
      }
    }
  }
  if (!extractedResult.title) {
    const text = await page.evaluate(() => {
      const el = [...document.getElementsByTagName('h1')][0];
      if (!el) return null;

      const text = 'innerText' in el ? 'innerText' : 'textContent';
      return el[text];
    });
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length >= 10 && canTextInDb(cleansedText)) {
        if (isJsEnabled || !containRedirectWords(cleansedText)) {
          extractedResult.title = cleansedText;
        }
      }
    }
  }
  if (!extractedResult.title) {
    const text = await page.evaluate(() => {
      const el = [...document.getElementsByTagName('h2')][0];
      if (!el) return null;

      const text = 'innerText' in el ? 'innerText' : 'textContent';
      return el[text];
    });
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length >= 10 && canTextInDb(cleansedText)) {
        if (isJsEnabled || !containRedirectWords(cleansedText)) {
          extractedResult.title = cleansedText;
        }
      }
    }
  }
  if (!extractedResult.title) {
    const text = await page.title();
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length > 0 && canTextInDb(cleansedText)) {
        if (isJsEnabled || !containRedirectWords(cleansedText)) {
          extractedResult.title = cleansedText;
        }
      }
    }
  }

  if (!extractedResult.image && host !== 'twitter.com') {
    let image = await page.evaluate(() => {
      const el = [...document.head.getElementsByTagName('meta')].filter(el => {
        const values = ['twitter:image', 'og:image', 'og:image:url'];
        if (values.includes(el.getAttribute('name'))) return true;
        if (values.includes(el.getAttribute('property'))) return true;
        if (el.getAttribute('itemprop') === 'image') return true;
        return false;
      }).slice(-1)[0];
      if (!el) return null;

      return el.getAttribute('content');
    });
    if (image && canTextInDb(image)) {
      if (image.startsWith('//')) image = 'http:' + image;
      if (image.startsWith('/')) image = origin + image;
      if (!image.startsWith('http')) image = origin + '/' + image;
      extractedResult.image = image;
    }
  }
  if (!extractedResult.image && isJsEnabled) {
    const img = await page.evaluateHandle(() => {
      return [...document.getElementsByTagName('img')].sort(
        (a, b) => b.width * b.height - a.width * a.height
      )[0];
    });
    if (img.asElement()) {
      const [imgWidth, imgHeight] = await img.evaluate(elem => [elem.width, elem.height]);
      const imgRatio = imgWidth / imgHeight;
      if (imgWidth > PAGE_WIDTH * 0.4 && (imgRatio >= 1.6 && imgRatio < 1.94)) {
        try {
          const imageData = await Promise.race([
            img.screenshot(),
            new Promise((_, reject) => setTimeout(reject, 4000))
          ]);

          extractedResult.image = await saveImage(imageData);
          console.log(`(${logKey}-${seq}) Saved image at ${extractedResult.image}`);
        } catch (e) {
          console.log(`(${logKey}-${seq}) Saving image throws ${e.name}: ${e.message}`);
        }
      }
    }
    await img.dispose();
  }
  if (!extractedResult.image && isJsEnabled) {
    try {
      const imageData = await Promise.race([
        page.screenshot(),
        new Promise((_, reject) => setTimeout(reject, 4000))
      ]);

      extractedResult.image = await saveImage(imageData);
      console.log(`(${logKey}-${seq}) Saved screenshot at ${extractedResult.image}`);
    } catch (e) {
      console.log(`(${logKey}-${seq}) Saving screenshot throws ${e.name}: ${e.message}`);
    }
  }

  if (!extractedResult.favicon) {
    let favicon = await page.evaluate(() => {
      const el = [...document.head.getElementsByTagName('link')].filter(el => {
        const values = ['icon', 'shortcut icon', 'ICON', 'SHORTCUT ICON'];
        if (values.includes(el.getAttribute('rel'))) return true;
        return false;
      }).slice(-1)[0];
      if (!el) return null;

      return el.getAttribute('href');
    });
    if (favicon && canTextInDb(favicon)) {
      if (favicon.startsWith('//')) favicon = 'http:' + favicon;
      if (favicon.startsWith('/')) favicon = origin + favicon;
      if (!favicon.startsWith('http')) favicon = origin + '/' + favicon;
      extractedResult.favicon = favicon;
    }
  }

  await page.close();
  await context.close();
};

const extract = async (extractedResultEntity, logKey, seq) => {
  const url = extractedResultEntity.url;
  const urlKey = removeUrlProtocolAndSlashes(url);
  console.log(`(${logKey}-${seq}) Extract url: `, url);

  const extractedResult = { url, extractedDT: Date.now() };

  const manualResult = getExtractedResult(manualResults, urlKey);
  if (manualResult) {
    console.log(`(${logKey}-${seq}) Found in manualResults`);
    if (manualResult.title === DERIVED_VALUE) {
      manualResult.title = deriveExtractedTitle(urlKey);
    }

    if (manualResult.title) extractedResult.title = manualResult.title;
    if (manualResult.image) extractedResult.image = manualResult.image;
    if (manualResult.favicon) extractedResult.favicon = manualResult.favicon;
    console.log('From manualResults: ', extractedResult);
  }

  if (!isExtractedResultComplete(extractedResult)) {
    try {
      await _extract(url, logKey, seq, false, extractedResult);
      console.log(`(${logKey}-${seq}) _extract w/o Js finished`);
    } catch (e) {
      console.log(`(${logKey}-${seq}) _extract w/o Js throws ${e.name}: ${e.message}`);
    }
    console.log('From _extract w/o Js: ', extractedResult);
  }

  if (!isExtractedResultComplete(extractedResult)) {
    try {
      await _extract(url, logKey, seq, true, extractedResult);
      console.log(`(${logKey}-${seq}) _extract with Js finished`);
    } catch (e) {
      console.log(`(${logKey}-${seq}) _extract with Js throws ${e.name}: ${e.message}`);
    }
    console.log('From _extract with Js: ', extractedResult);
  }

  if (!isExtractedResultComplete(extractedResult)) {
    const backupResult = getExtractedResult(backupResults, urlKey);
    if (backupResult) {
      console.log(`(${logKey}-${seq}) Found in backupResults`);
      if (backupResult.title === DERIVED_VALUE) {
        backupResult.title = deriveExtractedTitle(urlKey);
      }

      if (backupResult.title && !extractedResult.title) {
        extractedResult.title = backupResult.title;
      }
      if (backupResult.image && !extractedResult.image) {
        extractedResult.image = backupResult.image;
      }
      if (backupResult.favicon && !extractedResult.favicon) {
        extractedResult.favicon = backupResult.favicon;
      }
      console.log('From backupResults: ', extractedResult);
    }
  }

  extractedResult.status = EXTRACT_OK;

  try {
    await saveExtractedResult(extractedResultEntity, extractedResult);
    console.log(`(${logKey}-${seq}) Saved extracted result to datastore`);
  } catch (e) {
    console.log(`(${logKey}-${seq}) Saving extracted result throws ${e.name}: ${e.message}`);
    extractedResult.status = EXTRACT_ERROR;
  }

  return extractedResult;
};

const _main = async () => {
  const startDT = new Date();
  const logKey = `${startDT.getTime()}-${randomString(4)}`;
  console.log(`(${logKey}) Worker starts on ${startDT.toISOString()}`);

  const entities = await getExtractedResultEntities(EXTRACT_INIT);
  console.log(`(${logKey}) Got ${entities.length} ExtractedResult entities`);

  if (entities.length > 0) {
    console.log(`(${logKey}) There are entities, launching Puppeteer`);
    // Embedded Chromium can't be launched with error spawn EACCES
    //   Fix by sudo apt install chromium-browser and point to it with executablePath.
    if (!browser) {
      browser = await puppeteer.launch(
        { headless: true, executablePath: '/usr/bin/chromium-browser' }
      );
    }
  }

  const results = [];
  for (let i = 0, j = entities.length; i < j; i += N_EXTRACTS) {
    const _entities = entities.slice(i, i + N_EXTRACTS);
    const _results = await Promise.all(_entities.map((_entity, k) => {
      return extract(_entity, logKey, i + k);
    }));
    results.push(..._results);
  }
  if (entities.length !== results.length) throw new Error(`(${logKey}) Length not equal btw entities: ${entities.length} and results: ${results.length}`);

  const nSuccesses = results.filter(result => result.status === EXTRACT_OK).length;
  console.log(`(${logKey}) Finished extracting ${entities.length} entities with ${nSuccesses} success.`);

  const endDT = new Date();
  let errorSamples = '';
  if (results.length > 0) {
    const _errorSamples = results.filter(result => result.status === EXTRACT_ERROR)
      .map(result => result.url).slice(0, 10).join(', ');
    if (canTextInDb(_errorSamples)) errorSamples = _errorSamples;
  }
  await saveExtractedLog(logKey, {
    startDT, endDT, nEntities: entities.length, nSuccesses, errorSamples,
  });
  console.log(`(${logKey}) Saved extracted log to datastore.`);

  console.log(`(${logKey}) Worker finishes on ${endDT.toISOString()}.`);
};

const main = async () => {
  try {
    await _main();
    process.exit(0);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

main();
