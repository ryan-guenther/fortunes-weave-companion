// Fortune's Weave Companion
// Loads the data files, then renders one of three views into #view:
// characters (gift cards), items (reverse lookup) and paralogues (per-route dates).

'use strict';

const ROUTES = ['Cai', 'Dietrich', 'Theodora', 'Leda'];
const VIEWS = ['characters', 'items', 'paralogues'];
const REALLY_LIKED_PREVIEW = 12;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIMELINE_TICKS = ['9/1', '9/8', '9/15', '9/22', '10/1', '10/8', '10/15', '10/22', '11/1'];
const PICKABLE_MONTHS = [9, 10, 11];

const $ = (selector) => document.querySelector(selector);

// ---------- Helpers ----------

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const normalize = (text) => String(text).toLowerCase().replace(/[^a-z0-9 ]/g, '');

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Browser storage can be unavailable (private mode), so never let it throw.
const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

// In-game dates are "M/D" strings. Convert to a day number (Sep 1 = 1) for comparisons.
function dayNumber(date) {
  const [month, day] = date.split('/').map(Number);
  const daysBefore = { 9: 0, 10: 30, 11: 61 };
  return (daysBefore[month] ?? (month - 9) * 30) + day;
}

function formatDate(date) {
  const [month, day] = date.split('/').map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

// A diamond crest with the character's initials, colored by a hash of the name.
function crest(name) {
  let hue = 0;
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  const initials = name.split(' ').map((word) => word[0]).join('').slice(0, 2);
  return `
    <svg class="crest" viewBox="0 0 46 46" aria-hidden="true">
      <path d="M23 2 L44 23 L23 44 L2 23 Z" fill="hsl(${hue} 45% 42%)"/>
      <path d="M23 7 L39 23 L23 39 L7 23 Z" fill="none" stroke="hsl(${hue} 60% 82%)" stroke-width="1" stroke-dasharray="2 2"/>
      <text x="23" y="28" text-anchor="middle" font-size="${initials.length > 1 ? 13 : 16}" fill="#fff">${initials}</text>
    </svg>`;
}

// ---------- State ----------

const state = {
  view: 'characters',
  query: '',
  route: 'Cai',
  gameDate: null,            // { month, day } once both are known
  dateDraft: { month: '', day: '' }, // what the date inputs currently show
  expanded: new Set(),       // character cards showing every "really liked" item
};

function loadSavedState() {
  const view = storage.get('fw-view');
  if (VIEWS.includes(view)) state.view = view;

  const route = storage.get('fw-route');
  if (ROUTES.includes(route)) state.route = route;

  try {
    const saved = JSON.parse(storage.get('fw-game-date'));
    if (saved && PICKABLE_MONTHS.includes(saved.month) && saved.day >= 1 && saved.day <= 31) {
      state.gameDate = saved;
      state.dateDraft = { ...saved };
    }
  } catch { /* ignore bad saved data */ }
}

// ---------- Data ----------

let characters = [];
let items = [];
let shops = {};
let sources = {};
let paralogues = [];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return res.json();
}

async function loadData() {
  [characters, shops, sources, paralogues] = await Promise.all([
    fetchJson('data/characters.json'),
    fetchJson('data/shops.json'),
    fetchJson('data/sources.json'),
    fetchJson('data/paralogues.json'),
  ]);
  items = buildItemIndex(characters);
}

// Reverse index: for each item, who has it as a favorite and who really likes it.
function buildItemIndex(chars) {
  const byItem = new Map();
  const entry = (item) => {
    if (!byItem.has(item)) byItem.set(item, { name: item, favoriteOf: [], reallyLikedBy: [] });
    return byItem.get(item);
  };
  for (const c of chars) {
    for (const g of c.favorites) entry(g.item).favoriteOf.push(c.name);
    for (const g of c.reallyLiked) entry(g.item).reallyLikedBy.push(c.name);
  }
  const score = (it) => it.favoriteOf.length * 2 + it.reallyLikedBy.length;
  return [...byItem.values()].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

// ---------- Characters view ----------

function giftChip(gift, isFavorite) {
  const classes = ['chip'];
  if (isFavorite) classes.push('is-favorite');
  if (state.query && normalize(gift.item).includes(normalize(state.query))) classes.push('is-match');
  const sourceNames = gift.sources.map((code) => sources[code]?.name ?? code).join(', ');
  const count = gift.sources.length > 1 ? `<sup>${gift.sources.length}</sup>` : '';
  return `<button type="button" class="${classes.join(' ')}" data-item="${escapeHtml(gift.item)}" title="${escapeHtml(sourceNames)}">${escapeHtml(gift.item)}${count}</button>`;
}

function characterCard(c, isSearching) {
  const showAll = isSearching || state.expanded.has(c.name);
  const reallyLiked = showAll ? c.reallyLiked : c.reallyLiked.slice(0, REALLY_LIKED_PREVIEW);
  const likes = c.likes ? `<p class="card-sub">Likes ${escapeHtml(c.likes.charAt(0).toLowerCase() + c.likes.slice(1))}</p>` : '';

  let toggle = '';
  if (!isSearching && c.reallyLiked.length > REALLY_LIKED_PREVIEW) {
    const text = showAll ? 'Show fewer' : `Show all ${c.reallyLiked.length}`;
    toggle = `<button class="link-button" type="button" data-expand="${escapeHtml(c.name)}">${text}</button>`;
  }

  const hasGifts = c.favorites.length || c.reallyLiked.length;

  return `
    <article class="card">
      <div class="card-head">${crest(c.name)}<div><h2>${escapeHtml(c.name)}</h2>${likes}</div></div>
      ${c.favorites.length ? `
        <div>
          <p class="label">Favorites</p>
          <div class="chips">${c.favorites.map((g) => giftChip(g, true)).join('')}</div>
        </div>` : ''}
      ${c.reallyLiked.length ? `
        <div>
          <p class="label">Really liked</p>
          <div class="chips">${reallyLiked.map((g) => giftChip(g, false)).join('')}</div>
          ${toggle}
        </div>` : ''}
      ${hasGifts ? '' : `<p class="note">No tested gifts yet. Interests: ${escapeHtml(c.interests || 'unknown')}.</p>`}
      ${c.alsoGood ? `<p class="also-good"><b>Also good:</b> ${escapeHtml(c.alsoGood)}</p>` : ''}
      ${c.avoid ? `<div class="callout"><b>Avoid:</b> ${escapeHtml(c.avoid)}</div>` : ''}
      ${c.note ? `<p class="note">${escapeHtml(c.note)}</p>` : ''}
    </article>`;
}

function renderCharacters() {
  const q = normalize(state.query);
  const matches = (c) =>
    normalize(c.name).includes(q) ||
    [...c.favorites, ...c.reallyLiked].some((g) => normalize(g.item).includes(q)) ||
    normalize(c.alsoGood ?? '').includes(q);
  const list = q ? characters.filter(matches) : characters;

  $('#count').textContent = `${list.length} of ${characters.length} characters`;
  if (!list.length) return `<p class="empty">No one matches “${escapeHtml(state.query)}”.</p>`;
  return `<div class="card-grid">${list.map((c) => characterCard(c, Boolean(q))).join('')}</div>`;
}

// ---------- Items view ----------

function renderItems() {
  const q = normalize(state.query);
  const matches = (it) =>
    normalize(it.name).includes(q) || [...it.favoriteOf, ...it.reallyLikedBy].some((n) => normalize(n).includes(q));
  const list = q ? items.filter(matches) : items;

  $('#count').textContent = `${list.length} items, ranked by how many people want them`;
  if (!list.length) return `<p class="empty">No item matches “${escapeHtml(state.query)}”.</p>`;

  const topItems = q ? '' : `
    <p class="label">Most wanted</p>
    <div class="top-items">
      ${items.slice(0, 8).map((it) => `
        <button type="button" data-item="${escapeHtml(it.name)}">
          <strong>${escapeHtml(it.name)}</strong>
          <small>${it.favoriteOf.length} favorite · ${it.reallyLikedBy.length} really liked</small>
        </button>`).join('')}
    </div>`;

  const names = (list) =>
    `<div class="names">${list.map((n) => `<button type="button" data-character="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}</div>`;

  const rows = list.map((it) => `
    <article class="item-row">
      <div>
        <h3>${escapeHtml(it.name)}</h3>
        ${shops[it.name] ? `<p class="where">Buy: ${escapeHtml(shops[it.name])}</p>` : ''}
      </div>
      <div class="who">
        ${it.favoriteOf.length ? `<div><p class="label label-gold">⇈ Favorite of ${it.favoriteOf.length}</p>${names(it.favoriteOf)}</div>` : ''}
        ${it.reallyLikedBy.length ? `<div><p class="label">Really liked by ${it.reallyLikedBy.length}</p>${names(it.reallyLikedBy)}</div>` : ''}
      </div>
    </article>`).join('');

  return `${topItems}<div class="item-list">${rows}</div>`;
}

// ---------- Paralogues view ----------

function paralogueStatus(routeInfo) {
  if (!state.gameDate) return null;
  const today = dayNumber(`${state.gameDate.month}/${state.gameDate.day}`);

  const openWindow = routeInfo.windows.find((w) => today >= dayNumber(w.open) && today <= dayNumber(w.close));
  if (openWindow) {
    const left = dayNumber(openWindow.close) - today;
    const text = left === 0 ? 'last day to accept' : `${plural(left, 'day')} left`;
    return { kind: 'open', html: `<span class="status status-open">Open now · ${text}</span>` };
  }

  const nextWindow = routeInfo.windows.find((w) => today < dayNumber(w.open));
  if (nextWindow) {
    const wait = dayNumber(nextWindow.open) - today;
    return { kind: 'soon', html: `<span class="status status-soon">Opens in ${plural(wait, 'day')}</span>` };
  }

  if (today <= dayNumber(routeInfo.deadline)) {
    return { kind: 'soon', html: `<span class="status status-soon">Accepted? Battle by ${formatDate(routeInfo.deadline)}</span>` };
  }
  return { kind: 'passed', html: '<span class="status status-passed">Window passed</span>' };
}

function timeline(list) {
  const first = dayNumber(TIMELINE_TICKS[0]);
  const last = dayNumber(TIMELINE_TICKS[TIMELINE_TICKS.length - 1]);
  const pct = (date) => (((dayNumber(date) - first) / (last - first)) * 100).toFixed(2);

  const ticks = TIMELINE_TICKS.map((d) => `<div class="tick" style="left:${pct(d)}%"></div>`).join('');
  const todayStr = state.gameDate ? `${state.gameDate.month}/${state.gameDate.day}` : null;
  const showNow = todayStr && dayNumber(todayStr) >= first && dayNumber(todayStr) <= last;
  const nowLine = showNow ? `<div class="now" style="left:${pct(todayStr)}%" title="Your in-game date"></div>` : '';

  const rows = list.map((p) => {
    const r = p.routes[state.route];
    const windows = r.windows.map((w) =>
      `<div class="window" style="left:${pct(w.open)}%;width:calc(${pct(w.close)}% - ${pct(w.open)}% + 6px)" title="Accept ${formatDate(w.open)} to ${formatDate(w.close)}"></div>`,
    ).join('');
    return `
      <div class="timeline-row">
        <span class="row-label" title="${escapeHtml(p.title)}">${escapeHtml(p.character)}</span>
        <div class="timeline-track">
          ${ticks}${windows}
          <div class="deadline" style="left:${pct(r.deadline)}%" title="Deadline ${formatDate(r.deadline)}"></div>
          ${nowLine}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="timeline">
      <div class="timeline-inner">
        <div class="timeline-row">
          <span></span>
          <div class="timeline-axis">${TIMELINE_TICKS.map((d) => `<span style="left:${pct(d)}%">${formatDate(d)}</span>`).join('')}</div>
        </div>
        ${rows}
      </div>
      <div class="timeline-key">
        <span><i class="swatch window-swatch"></i>Window to accept</span>
        <span><i class="swatch deadline-swatch"></i>Battle deadline</span>
        ${state.gameDate ? '<span><i class="swatch now-swatch"></i>Your date</span>' : ''}
      </div>
    </div>`;
}

function paralogueCard(p) {
  const r = p.routes[state.route];
  const status = paralogueStatus(r);
  const accept = r.windows
    .map((w) => (w.open === w.close ? `${formatDate(w.open)} only` : `${formatDate(w.open)} to ${formatDate(w.close)}`))
    .join('<br>or ');

  return `
    <article class="card${status?.kind === 'passed' ? ' is-passed' : ''}">
      <div class="card-head">${crest(p.character)}<div><h2>${escapeHtml(p.title)}</h2><p class="card-sub">${escapeHtml(p.character)}'s paralogue</p></div></div>
      ${status ? status.html : ''}
      <dl class="facts">
        <dt>Accept</dt><dd>${accept}</dd>
        <dt>${r.fixedBattleDate ? 'Battle' : 'Deadline'}</dt><dd>${formatDate(r.deadline)}${r.fixedBattleDate ? ' (fixed date)' : ''}</dd>
        <dt>Start</dt><dd>${escapeHtml(p.start)}</dd>
        <dt>Reward</dt><dd>${escapeHtml(p.reward)}, 20,000G, 150 Renown</dd>
      </dl>
      ${r.warning ? `<div class="callout"><b>Watch out:</b> ${escapeHtml(r.warning)}</div>` : ''}
      ${p.note ? `<p class="note">${escapeHtml(p.note)}</p>` : ''}
    </article>`;
}

function dateControls() {
  const options = PICKABLE_MONTHS.map((m) =>
    `<option value="${m}"${Number(state.dateDraft.month) === m ? ' selected' : ''}>${MONTHS[m - 1]}</option>`,
  ).join('');
  return `
    <label class="game-date" for="game-month">Your in-game date
      <select id="game-month"><option value="">–</option>${options}</select>
      <input id="game-day" type="number" min="1" max="31" inputmode="numeric" value="${state.dateDraft.day}" aria-label="Day">
    </label>`;
}

function renderParalogues() {
  $('#count').textContent = '';
  const byFirstWindow = (a, b) =>
    dayNumber(a.routes[state.route].windows[0].open) - dayNumber(b.routes[state.route].windows[0].open);

  const onRoute = paralogues.filter((p) => p.routes[state.route]).sort(byFirstWindow);
  const q = normalize(state.query);
  const shown = q
    ? onRoute.filter((p) => normalize(`${p.title} ${p.character} ${p.start} ${p.reward}`).includes(q))
    : onRoute;
  const missing = paralogues.filter((p) => !p.routes[state.route]).map((p) => `${p.character} (${p.title})`);

  const routeButtons = ROUTES.map((r) =>
    `<button type="button" data-route="${r}" aria-pressed="${r === state.route}">${r}</button>`,
  ).join('');

  const cards = shown.length
    ? `<div class="card-grid">${shown.map(paralogueCard).join('')}</div>`
    : `<p class="empty">No paralogue on this route matches “${escapeHtml(state.query)}”.</p>`;

  return `
    <div class="route-bar">
      <div class="segmented" role="group" aria-label="Route">${routeButtons}</div>
      ${dateControls()}
    </div>
    <p class="route-note">${state.route} gets ${onRoute.length} of ${paralogues.length} Part I paralogues. Go to the start location during the window to accept. Clearing them as soon as they open is safest, since chapter ends can cut a window short.</p>
    ${timeline(onRoute)}
    ${cards}
    ${missing.length ? `<p class="not-on-route">Not on the ${state.route} route: ${escapeHtml(missing.join(', '))}.</p>` : ''}`;
}

// ---------- Rendering and events ----------

function render() {
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
  }
  const onParalogues = state.view === 'paralogues';
  $('#gift-legend').hidden = onParalogues;
  $('#gift-tips').hidden = onParalogues;
  $('#search-clear').hidden = !state.query;
  $('#search').placeholder = onParalogues
    ? 'Search a paralogue, character or reward'
    : 'Search a character or an item (e.g. Volcano Ghosh)';

  const renderers = { characters: renderCharacters, items: renderItems, paralogues: renderParalogues };
  $('#view').innerHTML = renderers[state.view]();
}

function showView(view, query) {
  state.view = view;
  state.query = query;
  $('#search').value = query;
  storage.set('fw-view', view);
  render();
  window.scrollTo({ top: 0 });
}

function updateGameDate() {
  const month = Number($('#game-month').value);
  let day = Number($('#game-day').value);
  if (month && !day) day = 1; // picking a month first shouldn't wipe it

  state.dateDraft = { month: month || '', day: month ? day : $('#game-day').value };
  state.gameDate = month && day >= 1 && day <= 31 ? { month, day } : null;

  if (state.gameDate) storage.set('fw-game-date', JSON.stringify(state.gameDate));
  else storage.remove('fw-game-date');

  const focusedId = document.activeElement?.id;
  render();
  if (focusedId) document.getElementById(focusedId)?.focus();
}

function bindEvents() {
  $('#search').addEventListener('input', (e) => {
    state.query = e.target.value;
    render();
  });

  $('#search-clear').addEventListener('click', () => {
    state.query = '';
    $('#search').value = '';
    render();
    $('#search').focus();
  });

  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      showView(view, view === 'paralogues' ? '' : state.query);
    });
  }

  $('#view').addEventListener('change', (e) => {
    if (e.target.id === 'game-month' || e.target.id === 'game-day') updateGameDate();
  });

  $('#view').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const { item, character, route, expand } = button.dataset;

    if (item) {
      showView('items', item);
    } else if (character) {
      showView('characters', character);
    } else if (route) {
      state.route = route;
      storage.set('fw-route', route);
      render();
    } else if (expand) {
      if (state.expanded.has(expand)) state.expanded.delete(expand);
      else state.expanded.add(expand);
      render();
    }
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
}

async function start() {
  loadSavedState();
  bindEvents();
  registerServiceWorker();
  try {
    await loadData();
    render();
  } catch (err) {
    $('#view').innerHTML = `<p class="empty">${escapeHtml(err.message)}. Check your connection and reload.</p>`;
  }
}

start();
