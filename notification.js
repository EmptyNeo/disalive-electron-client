const container = document.getElementById('notifications');
function applyTheme(theme) {
  for (const [key, value] of Object.entries(theme)) document.documentElement.style.setProperty(`--${key}`, value);
}
window.desktopNotifications.onTheme(applyTheme);
function createCard(notification) {
    const card = document.createElement('article');
    card.className = 'notification';
    card.dataset.notificationId = notification.id;
    card.tabIndex = 0;
    const avatar = notification.icon ? document.createElement('img') : document.createElement('span');
    avatar.className = notification.icon ? 'avatar' : 'avatar avatar-fallback';
    if (notification.icon) avatar.src = notification.icon;
    else avatar.textContent = 'D';
    const content = document.createElement('div');
    content.className = 'content';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = notification.title;
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = notification.body;
    content.append(title, body);
    const close = document.createElement('button');
    close.className = 'close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть уведомление');
    const closeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeIcon.setAttribute('viewBox', '0 0 24 24');
    closeIcon.setAttribute('aria-hidden', 'true');
    const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    closePath.setAttribute('d', 'M6 6l12 12M18 6 6 18');
    closeIcon.append(closePath);
    close.append(closeIcon);
    close.addEventListener('click', event => {
      event.stopPropagation();
      window.desktopNotifications.action('close', notification.id);
    });
    card.addEventListener('click', () => window.desktopNotifications.action('open', notification.id));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter') window.desktopNotifications.action('open', notification.id);
    });
    card.append(avatar, content, close);
    return card;
}
window.desktopNotifications.onNotifications(({ notifications, theme }) => {
  applyTheme(theme);
  const currentCards = new Map(Array.from(container.children, card => [card.dataset.notificationId, card]));
  const nextIds = new Set(notifications.map(notification => notification.id));
  for (const [id, card] of currentCards) {
    if (!nextIds.has(id)) card.remove();
  }
  for (const notification of notifications) {
    const card = currentCards.get(notification.id) || createCard(notification);
    container.append(card);
  }
});
