// Fortune's Weave Companion
// Loads the data files, then renders one of four views into #view:
// characters (gift cards), items (reverse lookup), paralogues (per-route dates)
// and classes (recommended class path per character).

'use strict';

const ROUTES = ['Cai', 'Dietrich', 'Theodora', 'Leda'];
const VIEWS = ['characters', 'items', 'paralogues', 'classes'];
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
  role: 'all',               // role filter on the classes view
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
let classData = { tiers: [], roles: [], characters: [] };
let classByName = new Map();

async function fetchJson(url) {
  // no-cache: always check with the server so data matches the deployed app.
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return res.json();
}

async function loadData() {
  [characters, shops, sources, paralogues, classData] = await Promise.all([
    fetchJson('data/characters.json'),
    fetchJson('data/shops.json'),
    fetchJson('data/sources.json'),
    fetchJson('data/paralogues.json'),
    fetchJson('data/classes.json'),
  ]);
  items = buildItemIndex(characters);
  classByName = new Map(classData.characters.map((c) => [c.name, c]));
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

// ---------- Shared view layout ----------
// Every view renders the same frame, top to bottom:
//   filter row (optional) → intro line with count → key (optional) → sections → sources

const link = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;

const SOURCES = {
  gifts: `Gifts from Game8 "Gift Giving Guide" (Oct 19, 2026), ${link('https://nightlygamingbinge.com/fire-emblem-fortunes-weave-guides-and-walkthroughs/', 'NightlyGamingBinge')}, Polygon "Best gifts for each character" by Josh Broadwell (Oct 9, 2026), GameSpot "Gifts Guide" by Dave Irwin (Sep 23, 2026), ${link('https://selphie1999gaming.com/game-guides/fire-emblem-fortunes-weave/fire-emblem-fortunes-weave-gifts-for-all-characters/', 'Selphie1999Gaming')}, ${link('https://www.keengamer.com/articles/guides/fire-emblem-fortunes-weave-best-gifts-guide/', 'KeenGamer')} and reader comments on the Polygon and Game8 guides. Shop locations from Polygon. When guides disagree, an item counts as a favorite if any guide tested it as one.`,
  paralogues: `Dates from ${link('https://www.keengamer.com/articles/guides/fire-emblem-fortunes-weave-all-paralogues-list/', 'KeenGamer')}, ${link('https://www.pockettactics.com/fire-emblem-fortunes-weave/paralogues', 'Pocket Tactics')} and ${link('https://gametyrant.com/news/how-to-get-all-paralogues-in-fire-emblem-fortunes-weave', 'GameTyrant')}. World Map tip for Theodora's paralogue from ${link('https://nerdschalk.com/fire-emblem-fortunes-weave-calendar-checklist/', 'NerdsChalk')}.`,
  classes: `Paths from ${link('https://www.keengamer.com/articles/guides/fire-emblem-fortunes-weave-best-class-for-every-character/', 'KeenGamer: Best Class for Every Character')}. Tiers and tips from ${link('https://allthings.how/fire-emblem-fortune-s-weave-class-guide-all-tiers-and-masteries/', 'AllThings.How: Class Guide')}.`,
};

function filterRow(label, options, selected, dataKey, extra = '') {
  const buttons = options.map((o) =>
    `<button type="button" data-${dataKey}="${escapeHtml(o.id)}" aria-pressed="${o.id === selected}">${escapeHtml(o.name)}</button>`,
  ).join('');
  return `
    <div class="filter-row">
      <div class="filter" role="group" aria-label="${escapeHtml(label)}">${buttons}</div>
      ${extra}
    </div>`;
}

function viewFrame({ filters = '', intro, count, key = '', body, source }) {
  return `
    ${filters}
    <div class="view-intro"><p>${intro}</p><span class="count">${escapeHtml(count)}</span></div>
    ${key ? `<div class="key">${key}</div>` : ''}
    ${body}
    <p class="source-line"><b>Sources:</b> ${source}</p>`;
}

function section(title, body, meta = '', summary = '') {
  return `
    <section class="view-section">
      <h2 class="section-title">${escapeHtml(title)}${meta ? ` <span>${escapeHtml(meta)}</span>` : ''}</h2>
      ${summary ? `<p class="section-summary">${escapeHtml(summary)}</p>` : ''}
      ${body}
    </section>`;
}

const GIFT_KEY = `
  <span><span class="chip is-favorite is-static">Item</span> Favorite: double points</span>
  <span><span class="chip is-static">Item</span> Really liked</span>
  <span><span class="chip is-static">Item<sup>3</sup></span> Confirmed by 3 guides</span>`;

const GIFT_TIPS = section('Gift tips', `
  <div class="tips">
    <div class="tip-card">
      <h3>Reactions</h3>
      <ol>
        <li>Two yellow arrows: favorite, double points</li>
        <li>"They really liked it": big gain</li>
        <li>"They liked it": moderate gain</li>
        <li>"They kind of like it": small gain</li>
        <li>"They don't like it": nothing</li>
      </ol>
    </div>
    <div class="tip-card">
      <h3>Rules of thumb</h3>
      <ul>
        <li>One gift per character per week.</li>
        <li>The first gift to someone can be anything; it unlocks meals. Use something cheap from the Lowtown tavern.</li>
        <li>On a character's birthday, almost any gift gets "really liked". Unrecruited characters won't prompt you, so check the Calendar.</li>
        <li>Grab the Gift Discount Boon of Salvation early.</li>
        <li>Dagsion shops restock at the start of each chapter.</li>
      </ul>
    </div>
    <div class="tip-card">
      <h3>Best all-rounders</h3>
      <ul>
        <li><b>Tales of Adventure</b> and <b>Strategy Manuscript</b> are favorites for a huge share of the cast.</li>
        <li><b>Eastern Tea Leaves</b> (Callianeira Port) is really liked by almost everyone.</li>
        <li><b>Volcano</b> and <b>Crimson Ghosh</b> cover most drinkers.</li>
        <li>The Items tab has the full ranking.</li>
      </ul>
    </div>
  </div>`);

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
  const classInfo = classByName.get(c.name);
  const classLine = classInfo
    ? `<p class="also-good"><b>Class path:</b> <button class="link-button" type="button" data-class-of="${escapeHtml(c.name)}">${escapeHtml(classInfo.path[classInfo.path.length - 1])}</button></p>`
    : '';

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
      ${classLine}
    </article>`;
}

function renderCharacters() {
  const q = normalize(state.query);
  const matches = (c) =>
    normalize(c.name).includes(q) ||
    [...c.favorites, ...c.reallyLiked].some((g) => normalize(g.item).includes(q)) ||
    normalize(c.alsoGood ?? '').includes(q);
  const list = q ? characters.filter(matches) : characters;

  const body = (list.length
    ? `<div class="card-grid">${list.map((c) => characterCard(c, Boolean(q))).join('')}</div>`
    : `<p class="empty">No one matches “${escapeHtml(state.query)}”.</p>`) + GIFT_TIPS;

  return viewFrame({
    intro: 'Favorite and really-liked gifts for every character. Tap a gift to see who else wants it.',
    count: q ? `${list.length} of ${characters.length} characters` : `${characters.length} characters`,
    key: GIFT_KEY,
    body,
    source: SOURCES.gifts,
  });
}

// ---------- Items view ----------

function renderItems() {
  const q = normalize(state.query);
  const matches = (it) =>
    normalize(it.name).includes(q) || [...it.favoriteOf, ...it.reallyLikedBy].some((n) => normalize(n).includes(q));
  const list = q ? items.filter(matches) : items;

  const topItems = q ? '' : section('Most wanted', `
    <div class="top-items">
      ${items.slice(0, 8).map((it) => `
        <button type="button" data-item="${escapeHtml(it.name)}">
          <strong>${escapeHtml(it.name)}</strong>
          <small>${it.favoriteOf.length} favorite · ${it.reallyLikedBy.length} really liked</small>
        </button>`).join('')}
    </div>`);

  const names = (people) =>
    `<div class="names">${people.map((n) => `<button type="button" data-character="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}</div>`;

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

  const body = (list.length
    ? topItems + section(q ? 'Matches' : 'All items', `<div class="item-list">${rows}</div>`)
    : `<p class="empty">No item matches “${escapeHtml(state.query)}”.</p>`) + GIFT_TIPS;

  return viewFrame({
    intro: 'Every gift, ranked by how many characters want it. Tap a name to see their card.',
    count: q ? `${list.length} of ${items.length} items` : `${items.length} items`,
    key: GIFT_KEY,
    body,
    source: SOURCES.gifts,
  });
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
  const byFirstWindow = (a, b) =>
    dayNumber(a.routes[state.route].windows[0].open) - dayNumber(b.routes[state.route].windows[0].open);

  const onRoute = paralogues.filter((p) => p.routes[state.route]).sort(byFirstWindow);
  const q = normalize(state.query);
  const shown = q
    ? onRoute.filter((p) => normalize(`${p.title} ${p.character} ${p.start} ${p.reward}`).includes(q))
    : onRoute;
  const missing = paralogues.filter((p) => !p.routes[state.route]).map((p) => `${p.character} (${p.title})`);

  const cards = shown.length
    ? `<div class="card-grid">${shown.map(paralogueCard).join('')}</div>`
    : `<p class="empty">No paralogue on this route matches “${escapeHtml(state.query)}”.</p>`;
  const notOnRoute = missing.length
    ? `<p class="section-summary">Not on the ${state.route} route: ${escapeHtml(missing.join(', '))}.</p>`
    : '';

  const key = `
    <span><i class="swatch window-swatch"></i>Window to accept</span>
    <span><i class="swatch deadline-swatch"></i>Battle deadline</span>
    ${state.gameDate ? '<span><i class="swatch now-swatch"></i>Your date</span>' : ''}`;

  return viewFrame({
    filters: filterRow('Route', ROUTES.map((r) => ({ id: r, name: r })), state.route, 'route', dateControls()),
    intro: 'Go to the start location during the window to accept. Clear them as soon as they open, since a chapter ending can cut a window short.',
    count: `${onRoute.length} of ${paralogues.length} paralogues`,
    key,
    body: section('Timeline', timeline(onRoute)) + section('Paralogues', cards + notOnRoute, plural(shown.length, 'paralogue')),
    source: SOURCES.paralogues,
  });
}

// ---------- Classes view ----------

function classCard(c) {
  const steps = c.path.map((step) => `<span class="step">${escapeHtml(step)}</span>`).join('<span class="arrow" aria-hidden="true">→</span>');
  return `
    <article class="card">
      <div class="card-head">${crest(c.name)}<div><h2>${escapeHtml(c.name)}</h2>
        <button class="link-button" type="button" data-character="${escapeHtml(c.name)}">See gifts</button></div></div>
      <div class="class-path" aria-label="Class path">${steps}</div>
      <p class="card-sub">${escapeHtml(c.why)}</p>
      ${c.tip ? `<p class="note">${escapeHtml(c.tip)}</p>` : ''}
    </article>`;
}

function renderClasses() {
  const q = normalize(state.query);
  const matches = (c) => normalize(`${c.name} ${c.path.join(' ')}`).includes(q);
  const shown = classData.characters.filter((c) => (state.role === 'all' || c.role === state.role) && (!q || matches(c)));

  const tiers = classData.tiers.map((t) =>
    `<span class="tier"><b>${escapeHtml(t.name)}</b> ${escapeHtml(t.unlock)}</span>`,
  ).join('');

  const groups = classData.roles
    .map((role) => ({ role, list: shown.filter((c) => c.role === role.id) }))
    .filter((g) => g.list.length)
    .map(({ role, list }) =>
      section(role.name, `<div class="card-grid">${list.map(classCard).join('')}</div>`, plural(list.length, 'character'), role.summary),
    ).join('');

  return viewFrame({
    filters: filterRow('Role', [{ id: 'all', name: 'All roles' }, ...classData.roles], state.role, 'role'),
    intro: 'Recommended class path for each character. "A / B" means either works. Treat them as suggestions; growths and your team come first.',
    count: shown.length === classData.characters.length ? `${shown.length} characters` : `${shown.length} of ${classData.characters.length} characters`,
    key: `<div class="tiers" aria-label="Class tiers">${tiers}</div>`,
    body: groups || `<p class="empty">No class path matches “${escapeHtml(state.query)}”.</p>`,
    source: SOURCES.classes,
  });
}

// ---------- Rendering and events ----------

function render() {
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
  }
  $('#search-clear').hidden = !state.query;
  const placeholders = {
    characters: 'Search a character or an item (e.g. Volcano Ghosh)',
    items: 'Search a character or an item (e.g. Volcano Ghosh)',
    paralogues: 'Search a paralogue, character or reward',
    classes: 'Search a character or a class (e.g. Swordmaster)',
  };
  $('#search').placeholder = placeholders[state.view];

  const renderers = { characters: renderCharacters, items: renderItems, paralogues: renderParalogues, classes: renderClasses };
  $('#view').innerHTML = (renderers[state.view] ?? renderCharacters)();
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
      const keepsQuery = view === 'characters' || view === 'items';
      showView(view, keepsQuery ? state.query : '');
    });
  }

  $('#view').addEventListener('change', (e) => {
    if (e.target.id === 'game-month' || e.target.id === 'game-day') updateGameDate();
  });

  $('#view').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const { item, character, route, expand, role, classOf } = button.dataset;

    if (item) {
      showView('items', item);
    } else if (character) {
      showView('characters', character);
    } else if (route) {
      state.route = route;
      storage.set('fw-route', route);
      render();
    } else if (classOf) {
      state.role = 'all';
      showView('classes', classOf);
    } else if (role) {
      state.role = role;
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
