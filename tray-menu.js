document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => window.desktopTray.action(button.dataset.action));
});
window.desktopTray.onTheme(theme => {
  for (const [key, value] of Object.entries(theme)) document.documentElement.style.setProperty(`--${key}`, value);
});
