const status = document.getElementById('status');
const progress = document.getElementById('progress');
const choices = document.getElementById('choices');

window.updateSplash.onState(state => {
  status.textContent = state.text || '';
  progress.style.width = `${Math.max(0, Math.min(100, Number(state.progress) || 0))}%`;
  choices.hidden = !state.choices;
});
document.getElementById('install').addEventListener('click', () => {
  choices.hidden = true;
  window.updateSplash.choose('install');
});
document.getElementById('later').addEventListener('click', () => {
  choices.hidden = true;
  window.updateSplash.choose('later');
});
