import { Datastore } from '@google-cloud/datastore';
import { Storage } from '@google-cloud/storage';

import { EXTRACT_LOG, EXTRACT, BRACE_STATIC_FILES } from './const';
import { randomString } from './utils';

const datastore = new Datastore();

const storage = new Storage();
const bucket = storage.bucket(BRACE_STATIC_FILES);

const saveExtractLog = (
  startDate, endDate, nEntities, nSuccesses, errorSamples,
) => {
  const logData = [
    { name: 'startDate', value: startDate },
    { name: 'endDate', value: endDate },
    { name: 'nEntities', value: nEntities },
    { name: 'nSuccesses', value: nSuccesses },
    { name: 'errorSamples', value: errorSamples, excludeFromIndexes: true },
  ];
  return datastore.save({ key: datastore.key([EXTRACT_LOG]), data: logData });
};

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

const updateExtract = (extractEntity, extractData) => {
  return datastore.save({
    key: extractEntity[datastore.KEY],
    data: deriveExtractEntity(extractData),
  });
};

const getExtractEntities = async (status) => {
  const query = datastore.createQuery(EXTRACT)
    .filter('status', '=', status)
    .limit(800);
  const [extractEntities] = await datastore.runQuery(query);
  return extractEntities;
};

const deriveExtractEntity = (extractData) => {
  const entity = [
    { name: 'url', value: extractData.url, excludeFromIndexes: true },
    { name: 'status', value: extractData.status },
  ];

  if ('title' in extractData) {
    entity.push({
      name: 'title', value: extractData.title, excludeFromIndexes: true,
    });
  }
  if ('image' in extractData) {
    entity.push({
      name: 'image', value: extractData.image, excludeFromIndexes: true,
    });
  }
  if ('favicon' in extractData) {
    entity.push({
      name: 'favicon', value: extractData.favicon, excludeFromIndexes: true,
    });
  }

  entity.push({ name: 'extractDate', value: new Date(extractData.extractedDT) });

  return entity;
};

const data = { saveExtractLog, saveImage, updateExtract, getExtractEntities };

export default data;
