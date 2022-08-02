import { writeFile } from 'fs';

import { randomString } from './utils';

const saveExtractLog = async (
  startDate, endDate, nEntities, nSuccesses, errorSamples,
) => {
  console.log(`startDate: ${startDate}, endDate: ${endDate}, nEntities: ${nEntities}, nSuccesses: ${nSuccesses}, errorSamples: ${errorSamples}`);
};

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

const updateExtract = async (extractEntity, extractData) => {
  console.log('extractData: ', extractData);
};

const getExtractEntities = async (status) => {
  return [
    { url: 'https://www.cashon.store' },
  ];
};

const data = { saveExtractLog, saveImage, updateExtract, getExtractEntities };

export default data;
