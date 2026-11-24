const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const AdmZip = require('adm-zip');

const version = require('./package.json').build.buildVersion;
const installer = path.join(__dirname, 'out', version, 'DLInstall.exe');
const release = path.resolve(__dirname, '..', 'release');
if (!fs.existsSync(installer)) throw new Error(`Installer not found: ${installer}`);

fs.mkdirSync(release, { recursive: true });
const releaseInstaller = path.join(release, 'DLInstall.exe');
fs.copyFileSync(installer, releaseInstaller);

const archive = new AdmZip();
archive.addLocalFile(releaseInstaller);
const archivePath = path.join(release, 'disalive.zip');
const temporaryPath = `${archivePath}.tmp`;
archive.writeZip(temporaryPath);
fs.rmSync(archivePath, { force: true });
fs.renameSync(temporaryPath, archivePath);

const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
fs.writeFileSync(path.join(release, 'version.json'), JSON.stringify({
  value: version,
  sha256,
  sizeInBytes: fs.statSync(archivePath).size
}, null, 2) + '\n');
console.log(`Release ${version}: ${releaseInstaller} and ${archivePath}`);
