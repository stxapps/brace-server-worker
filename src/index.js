import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import dataApi from './data'; // Mock test: import dataApi from './mock-data';
import {
  N_EXTRACTS, PAGE_WIDTH, PAGE_HEIGHT, EXTRACT_INIT, EXTRACT_OK, EXTRACT_ERROR,
  DERIVED_VALUE,
} from './const';
import {
  randomString, extractUrl, removeUrlProtocolAndSlashes, cleanText, getExtractedResult,
  deriveExtractedTitle, isExtractedResultComplete, canTextInDb, containRedirectWords,
  shuffleArray,
} from './utils';
import { manualResults, backupResults } from './results';

puppeteer.use(StealthPlugin());

let browser;

const withTimeout = async (logKey, seq, func, msg, delay) => {
  let timeoutId;
  const res = await Promise.race([
    func(),
    new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        console.log(`(${logKey}-${seq}) ${msg}`);
        resolve(null);
      }, delay);
    }),
  ]);
  clearTimeout(timeoutId);
  return res;
};

const _extract = async (logKey, seq, url, isJsEnabled, result) => {

  // Can't do it here! As awaiting, browser is still undefined,
  //   other async processes will still launch it.
  //if (!browser) browser = await puppeteer.launch({ headless: true });

  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  await page.setJavaScriptEnabled(isJsEnabled);
  try {
    await page.goto(url, { timeout: 24000, waitUntil: 'networkidle0' });
  } catch (e) {
    if (e.name === 'TimeoutError') {
      console.log(`(${logKey}-${seq}) _extract throws TimeoutError but continue extracting`);
    } else throw e;
  }

  const { origin } = extractUrl(page.url());

  if (!result.title) {
    const text = await withTimeout(logKey, seq, () => {
      return page.evaluate(() => {
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
    }, 'page.evaluate(meta) for title is too long', 4000);
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length > 0 && canTextInDb(cleansedText)) {
        result.title = cleansedText;
      }
    }
  }
  if (!result.title) {
    const text = await withTimeout(logKey, seq, () => {
      return page.title();
    }, 'page.title() is too long', 4000);
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length > 0 && canTextInDb(cleansedText)) {
        if (isJsEnabled || !containRedirectWords(cleansedText)) {
          result.title = cleansedText;
        }
      }
    }
  }
  if (!result.title) {
    const text = await withTimeout(logKey, seq, () => {
      return page.evaluate(() => {
        const el = [...document.getElementsByTagName('h1')][0];
        if (!el) return null;

        const text = 'innerText' in el ? 'innerText' : 'textContent';
        return el[text];
      });
    }, 'page.evaluate(h1) is too long', 4000);
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length >= 10 && canTextInDb(cleansedText)) {
        if (isJsEnabled || !containRedirectWords(cleansedText)) {
          result.title = cleansedText;
        }
      }
    }
  }
  if (!result.title) {
    const text = await withTimeout(logKey, seq, () => {
      return page.evaluate(() => {
        const el = [...document.getElementsByTagName('h2')][0];
        if (!el) return null;

        const text = 'innerText' in el ? 'innerText' : 'textContent';
        return el[text];
      });
    }, 'page.evaluate(h2) is too long', 4000);
    if (text) {
      const cleansedText = cleanText(text);
      if (cleansedText.length >= 10 && canTextInDb(cleansedText)) {
        if (isJsEnabled || !containRedirectWords(cleansedText)) {
          result.title = cleansedText;
        }
      }
    }
  }

  if (!result.image) {
    let image = await withTimeout(logKey, seq, () => {
      return page.evaluate(() => {
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
    }, 'page.evaluate(meta) for image is too long', 4000);
    if (image && canTextInDb(image)) {
      if (image.startsWith('//')) image = 'http:' + image;
      if (image.startsWith('/')) image = origin + image;
      if (!image.startsWith('http')) image = origin + '/' + image;
      result.image = image;
    }
  }
  if (!result.image && isJsEnabled) {
    const img = await withTimeout(logKey, seq, () => {
      return page.evaluateHandle(() => {
        return [...document.getElementsByTagName('img')].sort(
          (a, b) => b.width * b.height - a.width * a.height
        )[0];
      });
    }, 'page.evaluate(img) is too long', 4000);
    if (img) {
      if (img.asElement()) {
        const imgSize = await withTimeout(logKey, seq, () => {
          return img.evaluate(elem => [elem.width, elem.height]);
        }, 'img.evaluate(width, height) is too long', 4000);
        if (imgSize) {
          const [imgWidth, imgHeight] = imgSize;
          const imgRatio = imgWidth / imgHeight;
          if (imgWidth > PAGE_WIDTH * 0.4 && (imgRatio >= 1.6 && imgRatio < 1.94)) {
            const imageData = await withTimeout(logKey, seq, () => {
              return img.screenshot();
            }, 'img.screenshot() is too long', 4000);
            if (imageData) {
              result.image = await dataApi.saveImage(imageData);
              console.log(`(${logKey}-${seq}) Saved image at ${result.image}`);
            }
          }
        }
      }
      await img.dispose();
    }
  }
  if (!result.image && isJsEnabled) {
    const imageData = await withTimeout(logKey, seq, () => {
      return page.screenshot();
    }, 'page.screenshot() is too long', 4000);
    if (imageData) {
      result.image = await dataApi.saveImage(imageData);
      console.log(`(${logKey}-${seq}) Saved screenshot at ${result.image}`);
    }
  }

  if (!result.favicon) {
    let favicon = await withTimeout(logKey, seq, () => {
      return page.evaluate(() => {
        const el = [...document.head.getElementsByTagName('link')].filter(el => {
          const values = ['icon', 'shortcut icon', 'ICON', 'SHORTCUT ICON'];
          if (values.includes(el.getAttribute('rel'))) return true;
          return false;
        }).slice(-1)[0];
        if (!el) return null;

        return el.getAttribute('href');
      });
    }, 'page.evaluate(link) for icon is too long', 4000);
    if (favicon && canTextInDb(favicon)) {
      if (favicon.startsWith('//')) favicon = 'http:' + favicon;
      if (favicon.startsWith('/')) favicon = origin + favicon;
      if (!favicon.startsWith('http')) favicon = origin + '/' + favicon;
      result.favicon = favicon;
    }
  }

  await page.close();
  await context.close();
};

const extract = async (logKey, seq, extractEntity) => {
  const url = extractEntity.url;
  const urlKey = removeUrlProtocolAndSlashes(url);
  console.log(`(${logKey}-${seq}) Extract url: `, url);

  const result = { url, extractedDT: Date.now() };

  const manualResult = getExtractedResult(manualResults, urlKey);
  if (manualResult) {
    console.log(`(${logKey}-${seq}) Found in manualResults`);
    if (manualResult.title === DERIVED_VALUE) {
      manualResult.title = deriveExtractedTitle(urlKey);
    }

    if (manualResult.title) result.title = manualResult.title;
    if (manualResult.image) result.image = manualResult.image;
    if (manualResult.favicon) result.favicon = manualResult.favicon;
  }

  if (!isExtractedResultComplete(result)) {
    try {
      await _extract(logKey, seq, url, false, result);
      console.log(`(${logKey}-${seq}) _extract w/o Js finished`);
    } catch (e) {
      console.log(`(${logKey}-${seq}) _extract w/o Js throws ${e.name}: ${e.message}`);
    }
  }

  if (!isExtractedResultComplete(result)) {
    try {
      await _extract(logKey, seq, url, true, result);
      console.log(`(${logKey}-${seq}) _extract with Js finished`);
    } catch (e) {
      console.log(`(${logKey}-${seq}) _extract with Js throws ${e.name}: ${e.message}`);
    }
  }

  if (!isExtractedResultComplete(result)) {
    const backupResult = getExtractedResult(backupResults, urlKey);
    if (backupResult) {
      console.log(`(${logKey}-${seq}) Found in backupResults`);
      if (backupResult.title === DERIVED_VALUE) {
        backupResult.title = deriveExtractedTitle(urlKey);
      }

      if (backupResult.title && !result.title) {
        result.title = backupResult.title;
      }
      if (backupResult.image && !result.image) {
        result.image = backupResult.image;
      }
      if (backupResult.favicon && !result.favicon) {
        result.favicon = backupResult.favicon;
      }
    }
  }

  result.status = EXTRACT_OK;

  try {
    await dataApi.updateExtract(extractEntity, result);
    console.log(`(${logKey}-${seq}) Saved extract result to datastore`);
  } catch (e) {
    console.log(`(${logKey}-${seq}) Saving extract result throws ${e.name}: ${e.message}`);
    result.status = EXTRACT_ERROR;
  }

  return result;
};

const _main = async () => {
  const startDate = new Date();
  const logKey = `${startDate.getTime()}-${randomString(4)}`;
  console.log(`(${logKey}) Worker starts on ${startDate.toISOString()}`);

  let entities = await dataApi.getExtractEntities(EXTRACT_INIT);
  console.log(`(${logKey}) Got ${entities.length} Extract entities`);

  if (entities.length > 0) {
    console.log(`(${logKey}) There are entities, launching Puppeteer`);
    if (!browser) browser = await puppeteer.launch({ headless: 'new' });

    // Shuffle on each round so if Puppeteer hangs on some urls,
    //   others get a chance to be extracted.
    entities = shuffleArray([...entities]);
  }

  const results = [];
  for (let i = 0, j = entities.length; i < j; i += N_EXTRACTS) {
    const _entities = entities.slice(i, i + N_EXTRACTS);
    const _results = await Promise.all(_entities.map((_entity, k) => {
      return extract(logKey, i + k, _entity);
    }));
    results.push(..._results);
  }
  if (entities.length !== results.length) throw new Error(`(${logKey}) Length not equal btw entities: ${entities.length} and results: ${results.length}`);

  const nSuccesses = results.filter(result => result.status === EXTRACT_OK).length;
  console.log(`(${logKey}) Finished extracting ${entities.length} entities with ${nSuccesses} success.`);

  const endDate = new Date();
  let errorSamples = '';
  if (results.length > 0) {
    const _errorSamples = results.filter(result => result.status === EXTRACT_ERROR)
      .map(result => result.url).slice(0, 10).join(', ');
    if (canTextInDb(_errorSamples)) errorSamples = _errorSamples;
  }
  await dataApi.saveExtractLog(
    startDate, endDate, entities.length, nSuccesses, errorSamples,
  );
  console.log(`(${logKey}) Saved extract log to datastore.`);

  console.log(`(${logKey}) Worker finishes on ${endDate.toISOString()}.`);
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
