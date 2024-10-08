import Url from 'url-parse';

import { HTTP, VALID_URL, NO_URL, ASK_CONFIRM_URL, IGNORED_URL_PARAMS } from './const';

export const runAsyncWrapper = (callback) => {
  return function (req, res, next) {
    callback(req, res, next).catch(next);
  }
};

export const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const isObject = (val) => {
  return typeof val === 'object' && val !== null;
};

export const isString = val => {
  return typeof val === 'string' || val instanceof String;
};

export const randomString = (length) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const charactersLength = characters.length;

  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

export const removeTailingSlash = (url) => {
  if (url.slice(-1) === '/') return url.slice(0, -1);
  return url;
};

export const containUrlProtocol = (url) => {
  const urlObj = new Url(url, {});
  return urlObj.protocol && urlObj.protocol !== '';
};

export const ensureContainUrlProtocol = (url) => {
  if (!containUrlProtocol(url)) return HTTP + url;
  return url;
};

export const extractUrl = (url) => {
  url = ensureContainUrlProtocol(url);
  const urlObj = new Url(url, {});
  return {
    host: urlObj.host,
    origin: urlObj.origin,
    pathname: urlObj.pathname,
  };
};

export const removeUrlProtocolAndSlashes = (url) => {

  let doSlice = false, sliceIndex = 0;
  for (let i = 0; i < url.length; i++) {
    if (url[i] === ':') {
      doSlice = true;
      sliceIndex = i + 1;
      break;
    }
    if (url[i] === '.') {
      doSlice = false;
      break;
    }
    if (url[i] === '/') {
      doSlice = true;
      sliceIndex = i;
      break;
    }
  }

  if (!doSlice) return url;

  url = url.slice(sliceIndex);

  sliceIndex = 0;
  for (; sliceIndex < url.length; sliceIndex++) {
    if (url[sliceIndex] !== '/') break;
  }

  return url.slice(sliceIndex);
};

export const separateUrlAndParam = (url, paramKey) => {

  const doContain = containUrlProtocol(url);
  url = ensureContainUrlProtocol(url);

  const urlObj = new Url(url, {}, true);

  const newQuery = {}, param = {};
  for (const key in urlObj.query) {
    if (Array.isArray(paramKey)) {
      if (paramKey.includes(key)) {
        param[key] = urlObj.query[key];
      } else {
        newQuery[key] = urlObj.query[key];
      }
    } else {
      if (key === paramKey) {
        param[key] = urlObj.query[key];
      } else {
        newQuery[key] = urlObj.query[key];
      }
    }
  }

  urlObj.set('query', newQuery);

  let separatedUrl = urlObj.toString();
  if (!doContain) {
    separatedUrl = separatedUrl.substring(HTTP.length);
  }

  return { separatedUrl, param };
};

export const removeUrlQueryAndHash = (url) => {
  const qIndex = url.indexOf('?');
  if (qIndex > -1) url = url.slice(0, qIndex);

  const hIndex = url.indexOf('#');
  if (hIndex > -1) url = url.slice(0, hIndex);

  return url;
};

export const validateUrl = (url) => {

  if (!url) return NO_URL;
  if (/\s/g.test(url)) return ASK_CONFIRM_URL;

  // Buffer's only available in NodeJs, but not in web browsers.
  if (Buffer.byteLength(url, 'utf8') >= 1500) return ASK_CONFIRM_URL;

  url = ensureContainUrlProtocol(url);

  const urlObj = new Url(url, {});
  if (!urlObj.hostname.match(/^([-a-zA-Z0-9@:%_+~#=]{1,256}\.)+[a-z]{2,8}$/)) {
    return ASK_CONFIRM_URL;
  }

  return VALID_URL;
};

export const cleanUrl = (url) => {
  const { separatedUrl } = separateUrlAndParam(url, IGNORED_URL_PARAMS);
  return removeTailingSlash(separatedUrl);
};

export const cleanText = (text) => {
  return text.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
};

export const getExtractedResult = (results, urlKey) => {
  // BUG Alert
  //   Query might be important i.e. www.youtube.com/watch?v=C5zXQU5yir4
  urlKey = removeTailingSlash(removeUrlQueryAndHash(urlKey));
  if (urlKey in results) return { ...results[urlKey] };

  let customKey = urlKey + '*';
  if (customKey in results) return { ...results[customKey] };

  const phrases = urlKey.split('/');
  if (phrases.length >= 2) {
    if (phrases[phrases.length - 1].split('-').length >= 2) {
      // Contain url path that can be a title
      customKey = phrases[0] + '/**/${TITLE}';
      if (customKey in results) return { ...results[customKey] };
    }

    for (let i = phrases.length - 1; i >= 1; i--) {
      customKey = phrases.slice(0, i).join('/') + '+';
      if (customKey in results) return { ...results[customKey] };

      customKey = phrases.slice(0, i).join('/') + '*';
      if (customKey in results) return { ...results[customKey] };
    }
  }

  return null;
};

export const deriveExtractedTitle = (urlKey) => {
  urlKey = removeTailingSlash(removeUrlQueryAndHash(urlKey));

  const phrases = urlKey.split('/');
  if (phrases.length < 2) return urlKey;

  const words = phrases[phrases.length - 1].split('-');
  if (words.length < 2) return urlKey;

  const s = words.join(' ');
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
};

export const isExtractedResultComplete = (result) => {
  return result.title && result.image && result.favicon;
};

export const canTextInDb = (text) => {
  // The value of Datastore string property can't be longer than 1500 bytes
  const byteSize = Buffer.byteLength(text, 'utf8');
  return byteSize < 1500;
};

export const containRedirectWords = (text) => {
  text = text.toLowerCase();
  if (text.includes('redirect')) return true;
  if (text.includes('javascript')) return true;
  if (text === 'x.com') return true;
  return false;
};

export const shuffleArray = array => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export const isNetworkClosedError = (err) => {
  if (!isObject(err) || !isString(err.message)) return false;

  const message = err.message.toLowerCase();
  if (message.includes('navigating frame was detached')) return true;
  if (message.includes('target closed')) return true;
  if (message.includes('protocol error')) return true;
  if (message.includes('connection closed')) return true;

  return false;
};
