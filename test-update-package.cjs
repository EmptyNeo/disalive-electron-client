const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const Module = require('node:module');

const release = path.resolve(__dirname, '..', 'release');
const testDirectory = path.join(__dirname, 'out', 'update-test');
fs.mkdirSync(testDirectory, { recursive: true });
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') return {
    app: { getPath: () => testDirectory, getVersion: () => require('./package.json').version },
    net: { fetch: async () => new Response(Readable.toWeb(
      fs.createReadStream(path.join(release, 'disalive.zip'))), { status: 200 }) }
  };
  return originalLoad.call(this, request, parent, isMain);
};
const updater = require('./updater.cjs');
Module._load = originalLoad;

(async () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(release, 'version.json'), 'utf8'));
  assert.equal(updater.releaseVersion(), metadata.value);
  const files = await updater.download({ ...metadata, downloadUrl: 'https://disalive.s3-website.cloud.ru/release/disalive.zip' });
  assert.equal(fs.statSync(files.installer).size, fs.statSync(path.join(release, 'DLInstall.exe')).size);
  assert.equal(fs.readFileSync(files.installer).subarray(0, 2).toString(), 'MZ');
  assert.ok(fs.statSync(files.helper).size > 0);
  const target = path.resolve(path.dirname(files.installer));
  if (!target.startsWith(path.resolve(testDirectory) + path.sep)) throw new Error('Unsafe test cleanup path');
  fs.rmSync(target, { recursive: true, force: true });
  fs.rmdirSync(testDirectory);
  console.log('Update ZIP checksum, extraction and helper verified');
})().catch(error => { console.error(error); process.exitCode = 1; });
