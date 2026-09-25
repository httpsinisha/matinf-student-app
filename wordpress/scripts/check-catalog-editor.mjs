import { startWordPress } from './runtime.mjs';
const site = await startWordPress({ port: 9412, storage: '.catalog-test-runtime' });
try {
  process.env.MATINF_TEST_URL = 'http://127.0.0.1:9412';
  process.env.MATINF_TEST_STORAGE = '.catalog-test-runtime';
  await import('./check-publishing.mjs');
} finally { await site[Symbol.asyncDispose](); }
