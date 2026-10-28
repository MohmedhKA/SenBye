import { NotImplementedError } from '../errors.js';

export async function runSeed() {
  throw new NotImplementedError('M7');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
