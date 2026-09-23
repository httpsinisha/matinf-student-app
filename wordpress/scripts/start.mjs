import { startWordPress } from './runtime.mjs';

const site = await startWordPress();
console.log('\nMATINF WordPress: http://127.0.0.1:9400');
console.log('Admin: http://127.0.0.1:9400/wp-admin/');
console.log('Local login is stored in wordpress/.runtime/local-admin.json (not committed).');
console.log('Public API: http://127.0.0.1:9400/wp-json/matinf/v1/health');
async function shutdown() {
  await site[Symbol.asyncDispose]();
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
