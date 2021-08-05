const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Datastore } = require('@google-cloud/datastore');
const { Storage } = require('@google-cloud/storage');

const { randomString, cleanText } = require('./utils');
const {
  DATASTORE_KIND, BUCKET_NAME, N_EXTRACTS, PAGE_WIDTH, PAGE_HEIGHT,
  EXTRACT_INIT, EXTRACT_OK, EXTRACT_ERROR,
} = require('./const');

puppeteer.use(StealthPlugin());

const datastore = new Datastore();

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

let browser;

const getExtractedResultEntities = (status) => new Promise((resolve, reject) => {
  const query = datastore.createQuery(DATASTORE_KIND);
  query.filter('status', status);
  query.limit(800);
  datastore.runQuery(query, (err, entities) => {
    if (err) reject(err);
    else resolve(entities)
  });
});

const saveImage = (image) => new Promise((resolve, reject) => {

  const fname = randomString(48) + '.png';
  const blob = bucket.file(fname);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });
  blobStream.on('finish', () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    resolve(publicUrl);
  });
  blobStream.on('error', (e) => {
    reject(e);
  });
  blobStream.end(image);
});

const _extract = async (url, logKey, seq) => {

  const res = {};

  // Can't do it here! As awaiting, browser is still undefined,
  //   other async processes will still launch it.
  //if (!browser) browser = await puppeteer.launch({ headless: true });

  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  try {
    console.log(`(${logKey}-${seq}) _extract url: `, url);
    await page.goto(url, { timeout: 12000, waitUntil: 'networkidle0' });
  } catch (e) {
    if (e.name === 'TimeoutError') {
      console.log(`(${logKey}-${seq}) _extract throws TimeoutError but continue extracting`);
    } else throw e;
  }

  // TODO: Try to get title and image from twitter tags and open graph tags

  const text = await page.evaluate(() => {
    const el = [...document.getElementsByTagName('h1')][0];
    if (!el) return null;

    const text = 'innerText' in el ? 'innerText' : 'textContent';
    return el[text];
  });
  if (text !== null) {
    const cleansedText = cleanText(text);
    if (cleansedText.length >= 10) res.title = cleansedText;
  } else {
    const text = await page.evaluate(() => {
      const el = [...document.getElementsByTagName('h2')][0];
      if (!el) return null;

      const text = 'innerText' in el ? 'innerText' : 'textContent';
      return el[text];
    });
    if (text !== null) {
      const cleansedText = cleanText(text);
      if (cleansedText.length >= 10) res.title = cleansedText;
    }
  }
  if (!res.title) {
    const title = await page.title();
    res.title = cleanText(title);
  }

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
        res.image = await Promise.race([
          img.screenshot(),
          new Promise((_, reject) => setTimeout(reject, 2000))
        ]);
      } catch (e) {
        throw new Error('ImgScreenshotTimeoutError');
      }
    }
  }
  await img.dispose();
  if (!res.image) {
    try {
      res.image = await Promise.race([
        page.screenshot(),
        new Promise((_, reject) => setTimeout(reject, 2000))
      ]);
    } catch (e) {
      throw new Error('PageScreenshotTimeoutError');
    }
  }

  const favicon = await page.evaluate(() => {
    const el = [...document.head.getElementsByTagName('link')].filter(el => el.rel === 'icon' || el.rel === 'shortcut icon' || el.rel === 'ICON' || el.rel === 'SHORTCUT ICON').slice(-1)[0];
    if (!el) return null;

    return el.href;
  });
  if (favicon) res.favicon = favicon;

  await page.close();
  await context.close();
  return res;
};

const extract = async (extractedResultEntity, logKey, seq) => {

  const extractedResult = {
    url: extractedResultEntity.url,
    extractedDT: Date.now(),
  };

  try {
    const { title, image, favicon } = await _extract(extractedResult.url, logKey, seq);
    console.log(`(${logKey}-${seq}) _extract finished`);

    const imageUrl = await saveImage(image);
    console.log(`(${logKey}-${seq}) Saved image at ${imageUrl}`);

    // The value of Datastore string property can't be longer than 1500 bytes
    extractedResult.status = EXTRACT_OK;
    if (title) {
      const byteSize = Buffer.byteLength(title, 'utf8');
      if (byteSize < 1500) extractedResult.title = title;
    }
    extractedResult.image = imageUrl;
    if (favicon) {
      const byteSize = Buffer.byteLength(favicon, 'utf8');
      if (byteSize < 1500) extractedResult.favicon = favicon;
    }
  } catch (e) {
    console.log(`(${logKey}-${seq}) _extract throws ${e.name}: ${e.message}`);
    extractedResult.status = EXTRACT_ERROR;
  }

  try {
    await datastore.save({
      key: extractedResultEntity[datastore.KEY],
      data: extractedResult,
    });
    console.log(`(${logKey}-${seq}) Saved extracted result to datastore`);
  } catch (e) {
    console.log(`(${logKey}-${seq}) datastore.save throws ${e.name}: ${e.message}`);
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
    if (!browser) browser = await puppeteer.launch({ headless: true, executablePath: '/usr/bin/chromium-browser' });
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
    const byteSize = Buffer.byteLength(_errorSamples, 'utf8');
    if (byteSize < 1500) errorSamples = _errorSamples;
  }
  await datastore.save({
    key: datastore.key(['ExtractedLog', logKey]),
    data: {
      startDT, endDT, nEntities: entities.length, nSuccesses, errorSamples,
    },
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
