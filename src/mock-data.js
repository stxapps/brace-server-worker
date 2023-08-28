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
    { url: 'https://baijiahao.baidu.com/s?id=1765065998928587695&wfr=spider&for=pc&searchword=%E7%94%B5%E8%84%91%E8%BF%9E%E6%89%8B%E6%9C%BA%E7%83%AD%E7%82%B9%E6%80%8E%E4%B9%88%E8%BF%9E%E6%8E%A5' },
  ];
};

const data = { saveExtractLog, saveImage, updateExtract, getExtractEntities };

export default data;
