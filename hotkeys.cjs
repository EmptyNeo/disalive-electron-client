const path = require('node:path');
const { spawn } = require('node:child_process');

const modifierKeys = [16, 17, 18, 91, 92];
let monitor = null;
let buffer = '';
let pressed = new Set();
let config = { pttEnabled: false, ptt: null, sounds: [] };
let pttActive = false;
let onAction = () => {};

function validCombo(combo) {
  return combo && Number.isInteger(combo.keyCode) && combo.keyCode > 0 && combo.keyCode < 256
    ? { keyCode: combo.keyCode, ctrlKey: !!combo.ctrlKey, altKey: !!combo.altKey,
      shiftKey: !!combo.shiftKey, metaKey: !!combo.metaKey }
    : null;
}

function matches(combo) {
  return !!combo && pressed.has(combo.keyCode)
    && combo.ctrlKey === pressed.has(17)
    && combo.altKey === pressed.has(18)
    && combo.shiftKey === pressed.has(16)
    && combo.metaKey === (pressed.has(91) || pressed.has(92));
}

function releasePtt() {
  if (!pttActive) return;
  pttActive = false;
  onAction({ type: 'ptt', active: false });
}

function handleLine(line) {
  const match = /^(D|U) (\d+)$/.exec(line);
  if (!match) return;
  const key = Number(match[2]);
  const down = match[1] === 'D';
  if (down === pressed.has(key)) return;
  if (down) pressed.add(key);
  else pressed.delete(key);

  const shouldTalk = config.pttEnabled && matches(config.ptt);
  if (shouldTalk !== pttActive) {
    pttActive = shouldTalk;
    onAction({ type: 'ptt', active: shouldTalk });
  }
  if (down && !modifierKeys.includes(key)) {
    const sound = config.sounds.find(item => item.combo.keyCode === key && matches(item.combo));
    if (sound) onAction({ type: 'sound', soundId: sound.soundId });
  }
}

function start() {
  if (monitor || process.platform !== 'win32') return;
  const executable = path.join(__dirname.replace(/app\.asar(?=[\\/]|$)/, 'app.asar.unpacked'), 'hotkey-monitor.exe');
  try {
    monitor = spawn(executable, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    monitor.stdout.setEncoding('ascii');
    monitor.stdout.on('data', chunk => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, end).trim());
        buffer = buffer.slice(end + 1);
      }
    });
    monitor.stdin.on('error', error => console.error('Hotkey monitor input:', error));
    monitor.on('error', error => console.error('Hotkey monitor:', error));
    monitor.on('close', () => { monitor = null; pressed = new Set(); releasePtt(); });
  } catch (error) {
    monitor = null;
    console.error('Hotkey monitor:', error);
  }
}

function configure(payload, callback) {
  onAction = callback;
  releasePtt();
  pressed = new Set();
  config = {
    pttEnabled: payload?.pttEnabled === true,
    ptt: validCombo(payload?.ptt),
    sounds: Array.isArray(payload?.sounds) ? payload.sounds.slice(0, 100)
      .filter(item => ['string', 'number'].includes(typeof item?.soundId) && String(item.soundId).length < 100)
      .map(item => ({ soundId: item.soundId, combo: validCombo(item.combo) }))
      .filter(item => item.combo) : []
  };
  const codes = new Set(modifierKeys);
  if (config.pttEnabled && config.ptt) codes.add(config.ptt.keyCode);
  for (const sound of config.sounds) codes.add(sound.combo.keyCode);
  if (config.pttEnabled && config.ptt || config.sounds.length) {
    start();
    if (monitor?.stdin.writable) monitor.stdin.write([...codes].join(',') + '\n');
  } else if (monitor?.stdin.writable) monitor.stdin.write('\n');
}

function stop() {
  releasePtt();
  monitor?.kill();
  monitor = null;
}

module.exports = { configure, stop };
