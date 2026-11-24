const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');
const AdmZip = require('adm-zip');
const { app, net } = require('electron');

const origin = 'https://disalive.ru';
const releaseOrigin = 'https://disalive.s3-website.cloud.ru';
const maxArchiveSize = 600 * 1024 * 1024;

function releaseVersion() {
  const version = app.getVersion();
  return /^\d+\.\d+\.\d+$/.test(version) ? `${version}.0` : version;
}

async function check() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(`${origin}/v1/update/check.php?platform=electron`, {
      headers: { 'X-Current-Version': releaseVersion(), 'X-Client': 'electron' },
      cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) throw new Error(`Update check HTTP ${response.status}`);
    const result = await response.json();
    if (result.success !== true || !result.data) throw new Error('Invalid update response');
    const update = result.data;
    if (!update.isUpdateAvailable) return null;
    const url = new URL(update.downloadUrl);
    if (url.origin !== releaseOrigin || url.pathname !== '/release/disalive.zip' ||
        !/^\d+\.\d+\.\d+\.\d+$/.test(update.version) ||
        !Number.isSafeInteger(update.sizeInBytes) || update.sizeInBytes < 0 ||
        (update.sizeInBytes === 0 && update.sha256 !== '') ||
        (update.sizeInBytes > 0 && !/^[a-f0-9]{64}$/i.test(update.sha256)) ||
        update.sizeInBytes > maxArchiveSize) throw new Error('Invalid update package metadata');
    return { ...update, downloadUrl: url.href };
  } finally {
    clearTimeout(timeout);
  }
}

async function download(update, onProgress) {
  const directory = await fsp.mkdtemp(path.join(app.getPath('temp'), 'disalive-update-'));
  try {
    const archivePath = path.join(directory, 'disalive.zip');
    const response = await net.fetch(update.downloadUrl, { cache: 'no-store' });
    if (!response.ok || !response.body) throw new Error(`Update download HTTP ${response.status}`);
    const hash = update.sha256 ? crypto.createHash('sha256') : null;
    const responseSize = Number(response.headers.get('content-length')) || 0;
    const expectedSize = update.sizeInBytes || responseSize;
    let received = 0;
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > maxArchiveSize) return callback(new Error('Update package is too large'));
        hash?.update(chunk);
        if (expectedSize > 0) onProgress?.(Math.min(100, Math.round(received / expectedSize * 100)));
        callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), counter, fs.createWriteStream(archivePath));
    if ((expectedSize > 0 && received !== expectedSize) ||
        (hash && hash.digest('hex').toLowerCase() !== update.sha256.toLowerCase())) {
      throw new Error('Update package checksum mismatch');
    }
    const archive = new AdmZip(archivePath);
    const installerEntry = archive.getEntry('DLInstall.exe');
    if (!installerEntry || installerEntry.isDirectory || installerEntry.header.size > maxArchiveSize) {
      throw new Error('Installer is missing from update package');
    }
    archive.extractEntryTo(installerEntry, directory, false, true);
    const helper = path.join(directory, 'update-helper.exe');
    const unpackedDirectory = __dirname.replace(/app\.asar(?=[\\/]|$)/, 'app.asar.unpacked');
    await fsp.copyFile(path.join(unpackedDirectory, 'update-helper.exe'), helper);
    return { installer: path.join(directory, 'DLInstall.exe'), helper };
  } catch (error) {
    await fsp.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function install(files) {
  const child = spawn(files.helper, [String(process.pid), files.installer, process.execPath], {
    detached: true, windowsHide: true, stdio: 'ignore'
  });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
}

module.exports = { check, download, install, releaseVersion };
