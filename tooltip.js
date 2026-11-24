window.desktopTooltip.onText(text => { document.getElementById('text').textContent = text; });
window.desktopTooltip.onTheme(theme => {
  for (const [key, value] of Object.entries(theme)) document.documentElement.style.setProperty(`--${key}`, value);
});
