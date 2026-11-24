const resourceBase = 'https://disalive.ru/resources/';
const bundledLogo = new URL('assets/LogoEmpty.svg', window.location.href).href;
const iconFiles = {
  app: bundledLogo,
  server: bundledLogo,
  chat: bundledLogo,
  friends: resourceBase + 'Friends.svg',
  discover: resourceBase + 'Discover.svg',
  profile: bundledLogo
};

document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => {
    window.desktopTitlebar.control(button.dataset.action);
  });
});

window.desktopTitlebar.onTitle(({ title, type, icon: serverIcon }) => {
  document.getElementById('title').textContent = title || 'Disalive';
  const holder = document.getElementById('icon');
  const image = document.createElement('img');
  image.alt = '';
  image.src = type === 'server' && serverIcon ? serverIcon : (iconFiles[type] || iconFiles.app);
  image.onerror = () => {
    image.onerror = null;
    image.src = iconFiles.app;
  };
  image.classList.toggle('server-icon', type === 'server' && !!serverIcon);
  holder.replaceChildren(image);
});
window.desktopTitlebar.onNavigation(({ back, forward }) => {
  document.getElementById('back').disabled = !back;
  document.getElementById('forward').disabled = !forward;
});
window.desktopTitlebar.onMaximized(value => {
  const button = document.getElementById('maximize');
  button.querySelector('.maximize-icon').hidden = value;
  button.querySelector('.restore-icon').hidden = !value;
});
window.desktopTitlebar.onTheme(theme => {
  for (const [key, value] of Object.entries(theme)) document.documentElement.style.setProperty(`--${key}`, value);
});
