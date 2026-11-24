const resourceBase = 'https://disalive.ru/resources/';
const iconFiles = {
  app: 'LogoEmpty.svg',
  server: 'LogoEmpty.svg',
  chat: 'LogoEmpty.svg',
  friends: 'Friends.svg',
  discover: 'Discover.svg',
  profile: 'LogoEmpty.svg'
};

document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => {
    window.desktopTitlebar.tooltip(null);
    window.desktopTitlebar.control(button.dataset.action);
  });
  button.addEventListener('mouseenter', () => {
    if (button.disabled || !button.dataset.tooltip) return;
    const bounds = button.getBoundingClientRect();
    window.desktopTitlebar.tooltip({ text: button.dataset.tooltip, x: bounds.left + bounds.width / 2 });
  });
  button.addEventListener('mouseleave', () => window.desktopTitlebar.tooltip(null));
});

window.desktopTitlebar.onTitle(({ title, type, icon: serverIcon }) => {
  document.getElementById('title').textContent = title || 'Disalive';
  const holder = document.getElementById('icon');
  const image = document.createElement('img');
  image.alt = '';
  image.src = type === 'server' && serverIcon ? serverIcon : resourceBase + (iconFiles[type] || iconFiles.app);
  image.onerror = () => {
    image.onerror = null;
    image.src = resourceBase + iconFiles.app;
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
