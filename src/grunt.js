import dataApi from './data';
import { EXTRACT_INIT, EXTRACT_OK } from './const';
import { randomString } from './utils';

const main = async () => {
  const startDate = new Date();
  const logKey = `${startDate.getTime()}-${randomString(4)}`;
  console.log(`(${logKey}) Worker starts on ${startDate.toISOString()}`);

  let entities = await dataApi.getExtractEntities(EXTRACT_INIT);
  console.log(`(${logKey}) Got ${entities.length} Extract entities`);

  for (const extractEntity of entities) {
    const url = extractEntity.url;
    console.log('url:', url);
    if (!url.includes('archiveofourown.org')) {
      console.log('not contain archiveofourown.org, continue');
      continue;
    }

    const result = { url, extractedDT: Date.now() };
    result.status = EXTRACT_OK;
    await dataApi.updateExtract(extractEntity, result);
    console.log('updated');
  }
}
main();
