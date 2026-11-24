const list = document.getElementById('sources');
const share = document.getElementById('share');
let sources = [];
let type = 'window';
let selected = null;
let roster = null;

function render() {
  const scrollTop = list.scrollTop;
  const selectedId = selected?.id;
  list.replaceChildren();
  selected = null;
  share.disabled = true;
  document.getElementById('selected-name').textContent = 'Выберите окно или экран';
  const filtered = sources.filter(source => source.type === type)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = type === 'window' ? 'Открытых приложений не найдено' : 'Экраны не найдены';
    list.append(empty);
  }
  for (const source of filtered) {
    const button = document.createElement('button');
    button.className = 'source';
    button.type = 'button';
    const image = document.createElement('img');
    image.src = source.thumbnail;
    image.alt = '';
    const label = document.createElement('span');
    label.className = 'source-label';
    if (source.icon) {
      const icon = document.createElement('img');
      icon.src = source.icon;
      icon.alt = '';
      label.append(icon);
    }
    const name = document.createElement('span');
    name.textContent = source.name;
    label.append(name);
    button.append(image, label);
    if (source.id === selectedId) {
      button.classList.add('selected');
      selected = source;
      share.disabled = false;
      document.getElementById('selected-name').textContent = source.name;
    }
    button.addEventListener('click', () => {
      list.querySelector('.source.selected')?.classList.remove('selected');
      button.classList.add('selected');
      selected = source;
      share.disabled = false;
      document.getElementById('selected-name').textContent = source.name;
    });
    button.addEventListener('dblclick', () => window.screenPicker.choose(source.id));
    list.append(button);
  }
  list.scrollTop = scrollTop;
}

document.getElementById('backdrop').addEventListener('click', event => {
  if (event.target.id === 'backdrop') window.screenPicker.cancel();
});
document.getElementById('cancel').addEventListener('click', () => window.screenPicker.cancel());
document.getElementById('refresh').addEventListener('click', () => window.screenPicker.refresh());
window.addEventListener('focus', () => window.screenPicker.refresh());
share.addEventListener('click', () => { if (selected) window.screenPicker.choose(selected.id); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.screenPicker.cancel(); });
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  type = tab.dataset.type;
  document.querySelectorAll('.tab').forEach(item => {
    item.classList.toggle('active', item === tab);
    item.setAttribute('aria-selected', String(item === tab));
  });
  render();
  window.screenPicker.refresh();
}));
window.screenPicker.onSources(payload => {
  sources = payload.sources;
  for (const [key, value] of Object.entries(payload.theme)) document.documentElement.style.setProperty(`--${key}`, value);
  const nextRoster = sources.map(source => `${source.id}\u0000${source.name}`).sort().join('\u0001');
  if (nextRoster === roster) return;
  roster = nextRoster;
  render();
});
