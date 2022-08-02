import { randomString } from '../src/utils';

const genImageName = () => {
  const fname = randomString(48) + '.png';
  console.log(fname);
};

genImageName();
