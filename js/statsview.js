// The Stats page (every player in one sortable table) and a player's page (their stats and each opponent).
// Its actions and filter state are in app.js with the rest.

import { filterGames, playerStats, opponentStats } from './stats.js';
import { formatPoints } from './scoring.js';
import { playerColor, textOn } from './colors.js';

const DASH = '—';
const pct = (x) => (x === null ? DASH : `${(x * 100).toFixed(1)}%`);
const avg = (x, digits = 0) => (x === null ? DASH : x.toFixed(digits));
const whole = (x) => (x === null ? DASH : Math.round(x).toLocaleString());
const signed = (x) => (x > 0 ? `+${x.toLocaleString()}` : x < 0 ? `−${(-x).toLocaleString()}` : '0');
const signClass = (x) => (x > 0 ? 'plus' : x < 0 ? 'minus' : '');

// The table's columns: stat key, how to show it, and whether a low value sorts first.
const COLUMNS = [
  ['games', (s) => s.games],
  ['avgPlace', (s) => avg(s.avgPlace, 2), true],
  ['points', (s) => `<span class="${signClass(s.points)}">${formatPoints(s.points)}</span>`],
  ['avgPoints', (s) => (s.avgPoints === null ? DASH : `<span class="${signClass(s.avgPoints)}">${formatPoints(s.avgPoints)}</span>`)],
  ['raw', (s) => `<span class="${signClass(s.raw)}">${signed(s.raw)}</span>`],
  ['firstRate', (s) => pct(s.firstRate)],
  ['lastRate', (s) => pct(s.lastRate)],
  ['winRate', (s) => pct(s.winRate)],
  ['dealInRate', (s) => pct(s.dealInRate)],
  ['riichiRate', (s) => pct(s.riichiRate)],
  ['tsumoRate', (s) => pct(s.tsumoRate)],
  ['avgWinHonba', (s) => whole(s.avgWinHonba)],
  ['avgDealIn', (s) => whole(s.avgDealIn)],
  ['bustRate', (s) => pct(s.bustRate)],
];
export const LOW_FIRST = new Set(COLUMNS.filter((c) => c[2]).map((c) => c[0]));

// Filters shared by both pages: player count, length, and dates. The Stats page adds the minimum games.
function filterBar(filters, t, withMin) {
  const seg = (key, options, current) => `<div class="seg">${options.map(([value, label]) =>
    `<button class="small${String(value) === String(current) ? ' on' : ''}" data-action="stats-filter" data-key="${key}" data-value="${value}">${label}</button>`).join('')}</div>`;
  const date = (key, label) => `<label class="num-field">${label}<input type="date" data-stats-filter="${key}" value="${filters[key]}"></label>`;
  return `<div class="filters">
    <div class="row">${seg('players', [[4, t.modeTag[4]], [3, t.modeTag[3]]], filters.players)}${seg('length', [['all', t.stats.allLengths], ...t.lengthOptions], filters.length)}</div>
    <div class="row">${date('from', t.stats.from)}${date('to', t.stats.to)}
      ${withMin ? `<label class="num-field">${t.stats.minGames}<input type="number" inputmode="numeric" min="1" data-stats-filter="minGames" value="${filters.minGames}"></label>` : ''}</div>
  </div>`;
}

const nameCell = (name, esc) => {
  const color = playerColor(name, 0);
  return `<a class="name-chip" href="#player/${encodeURIComponent(name)}" style="background:${color};color:${textOn(color)}">${esc(name)}</a>`;
};

// ctx: { games, filters, sort: { key, desc }, t, esc, topBar }
export function statsPage({ games, filters, sort, t, esc, topBar }) {
  const matching = filterGames(games, filters);
  const all = playerStats(matching);
  const shown = all.filter((s) => s.games >= filters.minGames);
  const value = (s) => (sort.key === 'name' ? s.name : s[sort.key]);
  shown.sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    if (x === null || y === null) return (x === null) - (y === null); // no value goes last
    const order = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return (sort.desc ? -order : order) || a.name.localeCompare(b.name);
  });
  const hidden = all.length - shown.length;

  const header = (key, label) => `<th data-action="sort" data-key="${key}" class="${sort.key === key ? 'sorted' : ''}">${label}${sort.key === key ? (sort.desc ? ' ▼' : ' ▲') : ''}</th>`;
  const table = shown.length === 0 ? `<p class="hint">${t.stats.noGames}</p>`
    : `<div class="table-scroll"><table class="stats"><thead><tr>${header('name', t.stats.player)}${COLUMNS.map(([key]) => header(key, t.stats.short[key] ?? t.stats.columns[key])).join('')}</tr></thead>
      <tbody>${shown.map((s) => `<tr><th scope="row">${nameCell(s.name, esc)}</th>${COLUMNS.map(([, show]) => `<td>${show(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `${topBar('#', t.stats.title)}${filterBar(filters, t, true)}${table}
    <p class="hint">${t.stats.gameCount(matching.length)}${hidden > 0 ? ` ${t.stats.hiddenPlayers(hidden, filters.minGames)}` : ''}</p>
    <p class="hint">${t.stats.tapHint}</p>`;
}

// ctx: { games, filters, name, t, esc, fmtDate, topBar }
export function playerPage({ games, filters, name, t, esc, fmtDate, topBar }) {
  const matching = filterGames(games, filters);
  const s = playerStats(matching).find((p) => p.name === name);
  const color = playerColor(name, 0);
  let html = `${topBar('#stats', `<span class="name-chip big" style="background:${color};color:${textOn(color)}">${esc(name)}</span>`)}${filterBar(filters, t, false)}`;
  if (!s) return `${html}<p class="hint">${t.stats.noGames}</p>`;

  const c = t.stats.columns;
  const item = (label, content) => `<div><span>${label}</span><strong>${content}</strong></div>`;
  const points = (x) => `<span class="${signClass(x)}">${formatPoints(x)}</span>`;
  html += `<h3>${t.stats.results}</h3><div class="stat-grid">
    ${item(c.games, s.games)}${item(c.avgPlace, avg(s.avgPlace, 2))}
    ${s.places.map((count, rank) => item(t.places[rank], `${count} <small>${pct(count / s.games)}</small>`)).join('')}
    ${item(c.points, points(s.points))}${item(c.avgPoints, points(s.avgPoints))}
    ${item(c.raw, `<span class="${signClass(s.raw)}">${signed(s.raw)}</span>`)}${item(c.bustRate, pct(s.bustRate))}
  </div>
  <h3>${t.stats.hands}</h3><div class="stat-grid">
    ${item(c.hands, s.hands)}${item(c.winRate, pct(s.winRate))}${item(c.tsumoRate, pct(s.tsumoRate))}
    ${item(c.dealInRate, pct(s.dealInRate))}${item(c.riichiRate, pct(s.riichiRate))}${item(c.chombo, s.chombo)}
  </div>
  <h3>${t.stats.values}</h3><div class="stat-grid">
    ${item(c.avgWinHand, whole(s.avgWinHand))}${item(c.avgWinHonba, whole(s.avgWinHonba))}${item(c.avgWinAll, whole(s.avgWinAll))}
    ${item(c.avgDealIn, whole(s.avgDealIn))}
    ${item(c.best, s.best ? `${s.best.points.toLocaleString()} <small><a href="#game/${s.best.gameId}">${esc(fmtDate(s.best.date))}</a></small>` : DASH)}
  </div>`;

  const o = t.stats.opponents;
  const deals = (count, total) => (count ? `${count} <small>${total.toLocaleString()}</small>` : '0');
  html += `<h3>${o.title}</h3><div class="table-scroll"><table class="stats"><thead><tr>
    <th>${t.stats.player}</th><th>${o.together}</th><th>${o.above}</th><th>${o.fedThem}</th><th>${o.theyFed}</th><th>${o.net}</th></tr></thead><tbody>
    ${opponentStats(matching, name).map((v) => `<tr><th scope="row">${nameCell(v.name, esc)}</th><td>${v.together}</td><td>${pct(v.above / v.together)}</td>
      <td>${deals(v.fedThem, v.fedThemPoints)}</td><td>${deals(v.theyFed, v.theyFedPoints)}</td>
      <td><span class="${signClass(v.net)}">${signed(v.net)}</span></td></tr>`).join('')}
    </tbody></table></div><p class="hint">${o.hint}</p>`;
  return html;
}
