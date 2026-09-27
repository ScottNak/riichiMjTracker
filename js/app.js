// The page: home, game setup, and the game screen (scoreboard, round entry, history).
// Every change re-renders the whole view from the data; there is no other UI state to keep in sync.

import { defaultRules, newGame, saveRound, deleteRound, replay, computeDeltas, stickDeltas, dealerOf, windOf, handNumberOf } from './game.js';
import { finalStandings, formatPoints, limitName } from './scoring.js';
import { roundLabel, shortRoundLabel, windName } from './names.js';
import { playerColor, textOn, DRAW_COLOR, CHOMBO_COLOR } from './colors.js';
import { TEXT, limitText } from './text.js';
import * as store from './store.js';

const app = document.getElementById('app');
let published = [];
let local = [];
let language = store.loadLanguage();
let saveFailed = false;
let setupDraft = null;
let form = blankForm();
let editIndex = null; // round being edited, or null when entering a new round
let armed = null;     // an action waiting for a second tap to confirm
let rulesOpen = false; // whether the rules shelf on the setup screen is expanded

const SWITCHES = ['kiriageMangan', 'kazoeYakuman', 'busting', 'nagashiMangan', 'abortiveDraws', 'agariYame', 'suddenDeath'];
const t = () => TEXT[language];
const STICK = '<svg width="54" height="10" viewBox="0 0 60 11" aria-hidden="true"><rect x="0.5" y="0.5" width="59" height="10" rx="5"/><circle cx="30" cy="5.5" r="2.8" fill="#d32f2f"/></svg>';

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Today as 'YYYY-MM-DD' in local time.
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
// 'YYYY-MM-DD' is read as a local date (new Date('2026-09-25') alone would be read as UTC and can show the day before).
const fmtDate = (date) => {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const fmtDelta = (d) => (d > 0 ? `+${d.toLocaleString()}` : d < 0 ? `−${(-d).toLocaleString()}` : '0');
const signClass = (d) => (d > 0 ? 'plus' : d < 0 ? 'minus' : '');

// The round being entered. A tapped winner with outcome still null is a win waiting for its second tap.
// menu is 'other' while the Other choices are open. Riichi toggles can be kept when the rest is cleared.
function blankForm(riichi = []) {
  return { outcome: null, menu: null, winner: null, loser: null, han: null, fu: null, yakuman: 0, paoSeat: null, paoYakuman: 1, riichi: [...riichi], tenpai: [], seat: null, offender: null, kind: null };
}

// ---------- Data ----------

function route() {
  const [name, id] = location.hash.slice(1).split('/');
  return { name: name || 'home', id };
}

function findGame(id) {
  const mine = local.find((game) => game.id === id);
  if (mine) return { game: mine, editable: true };
  const theirs = published.find((game) => game.id === id);
  return theirs ? { game: theirs, editable: false } : null;
}

function updateGame(game) {
  local = local.map((g) => (g.id === game.id ? game : g));
  persist();
}

function persist() {
  saveFailed = !store.saveLocalGames(local);
}

function roster() {
  const names = new Set([...published, ...local].flatMap((game) => game.players));
  return [...names].sort((a, b) => a.localeCompare(b));
}

// ---------- Views ----------

function render() {
  const { name, id } = route();
  const view = name === 'new' ? setupView() : name === 'game' ? gameView(id) : homeView();
  const warning = saveFailed ? `<p class="warning">${t().saveFailed}</p>` : '';
  app.innerHTML = warning + view;
  document.documentElement.lang = language === 'jp' ? 'ja' : 'en';
  document.querySelectorAll('[data-lang]').forEach((button) => button.classList.toggle('on', button.dataset.lang === language));
}

function gameList(games) {
  return `<ul class="games">${games.map((game) => `<li><a href="#game/${game.id}">${esc(fmtDate(game.date))} · ${game.players.map(esc).join(', ')}</a></li>`).join('')}</ul>`;
}

function homeView() {
  const inProgress = local.filter((game) => !replay(game).over);
  const finished = local.filter((game) => replay(game).over);
  return `
    <button class="primary wide" data-action="new-game">${t().newGame}</button>
    ${inProgress.length ? `<section><h2>${t().inProgress}</h2>${gameList(inProgress)}</section>` : ''}
    ${finished.length ? `<section><h2>${t().notExported}</h2>${gameList(finished)}
      <button class="wide" data-action="export">${t().export}</button>
      <p class="hint">${t().exportHint}</p></section>` : ''}
    <section><h2>${t().pastGames}</h2>${published.length ? gameList([...published].reverse()) : `<p class="hint">${t().none}</p>`}</section>`;
}

function freshDraft(players, length = 'south', names = [], notes = '') {
  const seats = Array.from({ length: players }, (_, seat) => names[seat] ?? '');
  return { rules: { ...defaultRules(players), length }, names: seats, notes, date: today() };
}

function seg(key, options, current) {
  return `<div class="seg">${options.map(([value, label]) =>
    `<button class="${String(value) === String(current) ? 'on' : ''}" data-action="seg" data-key="${key}" data-value="${value}">${label}</button>`).join('')}</div>`;
}

// A rule switch label, with its note in parentheses shown as a smaller second line.
function switchLabel(key, rules) {
  const [, name, note] = t().switches[key](rules.returnPoints.toLocaleString()).match(/^(.*?)\s*(?:[（(](.*)[）)])?$/);
  return `<span>${name}${note ? `<small>${note}</small>` : ''}</span>`;
}

function setupView() {
  if (!setupDraft) setupDraft = freshDraft(4);
  const { rules, names, notes } = setupDraft;
  const oka = (rules.returnPoints - rules.startPoints) * rules.players;
  return `
    <div class="title-row"><h2>${t().newGame}</h2>
      <input type="date" data-draft-date value="${setupDraft.date}" aria-label="${t().date}"></div>
    <div class="row toggles">${seg('players', t().playerOptions, rules.players)}${seg('length', t().lengthOptions, rules.length)}</div>
    <datalist id="roster">${roster().map((name) => `<option value="${esc(name)}">`).join('')}</datalist>
    <div class="setup-grid">
      <hr aria-label="${t().seats}">
      ${names.map((name, seat) => `<span>${windName(seat, language)}</span>
        <input class="wide" list="roster" data-name="${seat}" value="${esc(name)}" autocomplete="off" placeholder="${t().namePlaceholder}" aria-label="${windName(seat, language)}">`).join('')}
      <hr aria-label="${t().points}">
      <span>${t().start}</span><input type="number" inputmode="numeric" step="1000" data-rule="startPoints" value="${rules.startPoints}" aria-label="${t().start}">
      <span>${t().return}</span><input type="number" inputmode="numeric" step="1000" data-rule="returnPoints" value="${rules.returnPoints}" aria-label="${t().return}">
      <span>${t().uma}</span><div class="wide uma">${rules.uma.map((value, place) =>
        `<input type="number" inputmode="numeric" data-uma="${place}" value="${value}" aria-label="${t().umaFor(t().places[place])}">`).join('')}</div>
      <span>${t().oka}</span><span class="wide">${t().okaTo1st(oka.toLocaleString())}</span>
    </div>
    <details class="shelf" data-shelf="rules" ${rulesOpen ? 'open' : ''}><summary>${t().rules}</summary>
    ${SWITCHES.map((key) => `<label class="check"><input type="checkbox" data-switch="${key}" ${rules[key] ? 'checked' : ''}> ${switchLabel(key, rules)}</label>`).join('')}
    </details>
    <label class="field column"><span>${t().notes}</span><textarea data-draft-notes rows="2">${esc(notes)}</textarea></label>
    <p class="error" id="setup-error"></p>
    <div class="row"><button data-action="cancel-setup">${t().cancel}</button><button class="primary" data-action="start-game">${t().startGame}</button></div>`;
}

function sticksBadge(count) {
  return count > 0 ? `<span class="sticks" title="${t().sticksTitle}">${STICK} × ${count}</span>` : '';
}

// Seat wind on a score tile: 東 in Japanese, one letter (E) otherwise, so names have room.
const tileWind = (wind) => (language === 'jp' ? windName(wind, language) : windName(wind, language)[0]);

// One tile per player in a single row: wind (or place) top left, name top right, score in the middle, final points at the bottom.
// Each tile is tinted with the player's identity color.
function scoreTiles(tiles, players) {
  return `<div class="tiles">${tiles.map((tile) => `<div class="tile${tile.highlight ? ' highlight' : ''}" style="--tint:${playerColor(tile.name, players.indexOf(tile.name))}">
    <div class="tile-top"><span class="corner">${tile.corner}</span><span class="tile-name">${esc(tile.name)}</span></div>
    <div class="tile-score">${tile.score.toLocaleString()}</div>
    <div class="tile-points ${signClass(tile.points)}">${formatPoints(tile.points)}</div></div>`).join('')}</div>`;
}

function gameView(id) {
  const found = findGame(id);
  if (!found) return `<p>${t().gameNotFound}</p><p><a href="#">${t().back}</a></p>`;
  const { game, editable } = found;
  const { rules, players } = game;
  const result = replay(game);
  const { state } = result;
  const dealer = dealerOf(state, rules);
  const live = finalStandings(state.scores, state.sticks, rules);

  let html = result.over
    ? `<h2>${t().over[result.reason]}</h2>`
    : `<h2 class="round">${roundLabel(windOf(state, rules), handNumberOf(state, rules), state.honba, language)} ${sticksBadge(state.sticks)}</h2>`;

  if (result.over) {
    const order = players.map((_, seat) => seat).sort((a, b) => live[a].rank - live[b].rank);
    html += scoreTiles(order.map((seat) => ({
      corner: t().places[live[seat].rank], name: players[seat], score: live[seat].score, points: live[seat].points, highlight: live[seat].rank === 0,
    })), players);
  } else {
    html += scoreTiles(players.map((name, seat) => ({
      corner: tileWind((seat - dealer + rules.players) % rules.players), name, score: state.scores[seat], points: live[seat].points, highlight: seat === dealer,
    })), players);
  }
  html += roundTable(game, result, editable);

  if (editable && result.endsAt !== null && result.endsAt < game.rounds.length - 1) {
    html += `<p class="warning">${t().endsAtWarning(result.endsAt + 1)}</p>`;
  }
  if (editable && result.canYame && editIndex === null) {
    html += `<div class="banner"><span>${t().yameBanner}</span><button class="small" data-action="yame">${t().endGame}</button></div>`;
  }
  if (editable) html += gameFooter(game, result);
  return html + `<p><a href="#">${t().allGames}</a></p>`;
}

// ---------- Round table ----------

// The thin strip next to the round: the winner's color, gray for a draw, black for chombo.
function stripColor(round, game) {
  switch (round.outcome) {
    case 'ron':
    case 'tsumo': return playerColor(game.players[round.winner], round.winner);
    case 'nagashi': return playerColor(game.players[round.seat], round.seat);
    case 'draw':
    case 'abortive': return DRAW_COLOR;
    case 'chombo': return CHOMBO_COLOR;
    default: return null; // imported rounds without entered details
  }
}

const strip = (color) => `<td class="strip"${color ? ` style="background:${color}"` : ''}></td>`;

// Short round label, with the riichi sticks carried into the round under it.
function roundCell(stateAt, rules, attributes = '') {
  const label = shortRoundLabel(windOf(stateAt, rules), handNumberOf(stateAt, rules), stateAt.honba, language);
  const sticks = stateAt.sticks > 0 ? `<div class="sticks" title="${t().sticksTitle}">${STICK}×${stateAt.sticks}</div>` : '';
  return `<th class="rc" scope="row" ${attributes}>${label}${sticks}</th>`;
}

// The payment for the hand (honba included) in large type, or a word in its place. Under it, on one small line,
// a riichi stick if they declared riichi and the riichi stick movement when it isn't 0.
function payment(total, sticks, riichi, word = null) {
  const main = total - sticks;
  const line = riichi || sticks
    ? `<div class="stk ${signClass(sticks)}">${riichi ? STICK : ''}${sticks ? fmtDelta(sticks) : ''}</div>` : '';
  return `<div class="main ${word ? 'word' : signClass(main)}">${word ?? fmtDelta(main)}</div>${line}`;
}

function roundRow(game, round, stateAt, index, canEdit) {
  const { rules } = game;
  const sticks = stickDeltas(round, stateAt, rules);
  const riichi = round.outcome === 'chombo' ? [] : round.riichi ?? [];
  const edit = canEdit ? `data-action="edit-round" data-index="${index}"` : '';
  // A draw where everyone is tenpai, or nobody is, pays nothing; say which instead of showing 0s.
  const word = round.outcome === 'draw' && new Set(round.tenpai).size === 1 ? (round.tenpai[0] ? t().tenpai : t().noten) : null;
  return `<tr>${roundCell(stateAt, rules, edit)}${strip(stripColor(round, game))}${game.players.map((_, seat) =>
    `<td class="pc">${payment(round.deltas[seat], sticks[seat], riichi.includes(seat), word)}</td>`).join('')}</tr>`;
}

function roundTable(game, result, editable) {
  const rows = game.rounds.map((round, index) => (index === editIndex
    ? entryRows(game, result.before[index])
    : roundRow(game, round, result.before[index], index, editable && editIndex === null)));
  if (editable && editIndex === null && !result.over) rows.push(entryRows(game, result.state));
  if (rows.length === 0) return '';
  const head = game.players.map((name, seat) => {
    const color = playerColor(name, seat);
    return `<th style="background:${color};color:${textOn(color)}">${esc(name)}</th>`;
  }).join('');
  return `<table class="rounds"><thead><tr><th class="rc"></th><th class="strip"></th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

// ---------- Round entry ----------

// Outcomes where the next step is tapping players' cells. With nothing picked, tapping a cell starts a win.
const TAP_OUTCOMES = new Set([null, 'ron', 'tsumo', 'draw', 'nagashi', 'chombo']);
// Suufon renda and suucha riichi need four players.
const ABORTIVE_KINDS = { 4: ['kyuushu', 'suufon', 'suucha', 'suukaikan'], 3: ['kyuushu', 'suukaikan'] };

function tapCell(seat) {
  const f = form;
  switch (f.outcome) {
    case null:
      // First tap: the winner. Second tap: the winner again for tsumo, anyone else for ron.
      if (f.menu !== null) break;
      if (f.winner === null) f.winner = seat;
      else if (seat === f.winner) f.outcome = 'tsumo';
      else { f.outcome = 'ron'; f.loser = seat; }
      break;
    case 'ron':
    case 'tsumo':
      // A tap after the win is picked starts over with a new winner.
      f.outcome = null;
      f.winner = seat;
      f.loser = null;
      break;
    case 'draw': f.tenpai = f.tenpai.includes(seat) ? f.tenpai.filter((s) => s !== seat) : [...f.tenpai, seat]; break;
    case 'nagashi': f.seat = seat; break;
    case 'chombo': f.offender = seat; break;
    default: break;
  }
  if (f.paoSeat === f.winner) f.paoSeat = null;
}

function select(key, options, current) {
  return `<select data-form="${key}">${options.map(([value, label]) =>
    `<option value="${value}" ${String(value) === String(current) ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
}

// Typed han and fu boxes and a Yakuman button. Each tap on Yakuman adds one, cycling from 6 back to 1.
// While yakuman is on, the boxes are faded and the pao picker shows under them; typing in a box switches back.
function valueFields(game) {
  const { rules, players } = game;
  const f = form;
  const box = (key, label) => `<label class="num-field${f.yakuman ? ' faded' : ''}"><input type="text" inputmode="numeric" data-number="${key}" value="${f[key] ?? ''}">${label}</label>`;
  // Two groups that wrap as units: the boxes, and the Yakuman button with pao beside it.
  const boxes = `<span class="group">${box('han', t().hanLabel)}${f.han === null || f.han < 5 ? box('fu', t().fuLabel) : ''}</span>`;
  let yakuman = `<button class="${f.yakuman ? 'on' : ''}" data-action="yakuman">${t().yakuman(Math.max(f.yakuman, 1))}</button>`;
  if (f.yakuman > 0) {
    const others = players.map((name, seat) => [seat, esc(name)]).filter(([seat]) => seat !== f.winner);
    yakuman += `<span class="muted">${t().pao}</span>${select('paoSeat', [['', t().noPao], ...others], f.paoSeat ?? '')}`;
    if (f.paoSeat !== null && f.yakuman > 1) {
      yakuman += select('paoYakuman', Array.from({ length: f.yakuman }, (_, i) => [i + 1, t().yakuman(i + 1)]), f.paoYakuman);
    }
  }
  const limit = f.yakuman === 0 && valueProblem(f) === null ? limitText(limitName({ han: f.han, fu: f.fu }, rules), 0, t()) : null;
  return `<div class="value-row">${boxes}<span class="group">${yakuman}</span></div>${limit ? `<p class="hint center">${limit}</p>` : ''}`;
}

// Fu a hand can have: 20, 25, or 30 to 110 in tens. 1 han needs at least 30 fu.
const VALID_FU = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

// What is wrong with the typed han and fu, or null when they are fine. Fu doesn't matter at 5 han or more.
function valueProblem(f) {
  if (f.yakuman > 0) return null;
  if (!Number.isInteger(f.han) || f.han < 1) return t().needHanFu;
  if (f.han >= 5) return null;
  if (f.fu === null) return t().needHanFu;
  return VALID_FU.includes(f.fu) && !(f.han === 1 && f.fu < 30) ? null : t().badFu;
}

// What is still missing before the round can be saved, or null when it is ready.
function formProblem(f, rules) {
  switch (f.outcome) {
    case 'ron':
    case 'tsumo': return valueProblem(f);
    case 'draw': return f.riichi.some((seat) => !f.tenpai.includes(seat)) ? t().riichiMustBeTenpai : null;
    case 'abortive':
      if (f.kind === null) return t().pickAbortive;
      return f.kind === 'suucha' && f.riichi.length < rules.players ? t().suuchaNeedsRiichi : null;
    case 'nagashi': return f.seat === null ? t().tapNagashi : null;
    case 'chombo': return f.offender === null ? t().tapChombo : null;
    default:
      if (f.menu !== null) return ''; // Other is open, nothing picked in it yet
      return f.winner === null ? t().tapToWin : t().tapLoserOrTsumo;
  }
}

function entryFromForm(f, players) {
  const riichi = [...f.riichi].sort();
  switch (f.outcome) {
    case 'ron':
    case 'tsumo': {
      const pao = f.yakuman > 0 && f.paoSeat !== null ? { seat: f.paoSeat, yakuman: Math.min(f.paoYakuman, f.yakuman) } : null;
      const entry = { outcome: f.outcome, winner: f.winner, han: f.yakuman ? 0 : f.han, fu: f.yakuman || f.han >= 5 ? 0 : f.fu, yakuman: f.yakuman, pao, riichi };
      if (f.outcome === 'ron') entry.loser = f.loser;
      return entry;
    }
    case 'draw': return { outcome: 'draw', tenpai: Array.from({ length: players }, (_, seat) => f.tenpai.includes(seat)), riichi };
    case 'nagashi': return { outcome: 'nagashi', seat: f.seat, riichi };
    case 'abortive': return { outcome: 'abortive', kind: f.kind, riichi };
    default: return { outcome: 'chombo', offender: f.offender };
  }
}

function formFromEntry(entry) {
  return {
    ...blankForm(),
    outcome: entry.outcome ?? null,
    menu: ['abortive', 'nagashi', 'chombo'].includes(entry.outcome) ? 'other' : null,
    winner: entry.winner ?? null,
    loser: entry.loser ?? null,
    han: entry.han || null,
    fu: entry.fu || null,
    yakuman: entry.yakuman ?? 0,
    paoSeat: entry.pao?.seat ?? null,
    paoYakuman: entry.pao?.yakuman ?? 1,
    riichi: [...(entry.riichi ?? [])],
    tenpai: (entry.tenpai ?? []).flatMap((isTenpai, seat) => (isTenpai ? [seat] : [])),
    seat: entry.seat ?? null,
    offender: entry.offender ?? null,
    kind: entry.kind ?? null,
  };
}

// The tag on a player's entry cell for what they were picked as: [class, text], or null.
function cellTag(f, seat) {
  if (f.outcome === null && f.menu === null && f.winner === seat) return ['win', t().winner];
  if ((f.outcome === 'ron' || f.outcome === 'tsumo') && f.winner === seat) return ['win', t().outcomes[f.outcome]];
  if (f.outcome === 'ron' && f.loser === seat) return ['lose', t().dealtIn];
  if (f.outcome === 'draw' && f.tenpai.includes(seat)) return ['win', t().tenpai];
  if (f.outcome === 'nagashi' && f.seat === seat) return ['win', t().outcomes.nagashi];
  if (f.outcome === 'chombo' && f.offender === seat) return ['lose', t().outcomes.chombo];
  return null;
}

// The entry row (for the next round, or in place of the round being edited) and the controls under it.
function entryRows(game, stateAt) {
  const { rules, players } = game;
  const f = form;
  const editing = editIndex !== null;
  const problem = formProblem(f, rules);
  const entry = problem === null ? entryFromForm(f, rules.players) : null;
  const deltas = entry && computeDeltas(entry, stateAt, rules);
  const sticks = entry && stickDeltas(entry, stateAt, rules);
  const tappable = TAP_OUTCOMES.has(f.outcome);
  const noRiichi = f.outcome === 'chombo'; // chombo returns riichi sticks

  const cells = players.map((_, seat) => {
    const tag = cellTag(f, seat);
    const tap = tappable ? ` data-action="cell" data-seat="${seat}"` : '';
    return `<td class="pc entry${tappable ? ' tap' : ''}${tag ? ` ${tag[0]}` : ''}"${tap}>
      <div class="pick">${tag ? `<div class="tag">${tag[1]}</div>` : ''}${entry ? payment(deltas[seat], sticks[seat], false) : ''}</div>
      <button class="riichi-toggle${f.riichi.includes(seat) && !noRiichi ? ' on' : ''}" data-action="riichi" data-seat="${seat}" aria-label="${t().riichi}" title="${t().riichi}" ${noRiichi ? 'disabled' : ''}>${STICK}</button></td>`;
  }).join('');

  const button = (action, value, label, on) => `<button class="${on ? 'on' : ''}" data-action="${action}" data-value="${value}">${label}</button>`;
  let controls = editing ? `<p class="hint">${t().editing(shortRoundLabel(windOf(stateAt, rules), handNumberOf(stateAt, rules), stateAt.honba, language))}</p>` : '';
  // Once a winner is tapped, the round is a win, so Draw and Other are hidden until Back.
  if (f.winner === null) {
    controls += `<div class="seg">${button('mode', 'draw', t().outcomes.draw, f.outcome === 'draw')}${button('mode', 'other', t().outcomes.other, f.menu === 'other')}</div>`;
  }
  if (f.menu === 'other') {
    controls += `<div class="seg">${rules.abortiveDraws ? button('sub', 'abortive', t().outcomes.abortive, f.outcome === 'abortive') : ''}${rules.nagashiMangan ? button('sub', 'nagashi', t().outcomes.nagashi, f.outcome === 'nagashi') : ''}${button('sub', 'chombo', t().outcomes.chombo, f.outcome === 'chombo')}</div>`;
  }
  if (f.outcome === 'abortive') {
    controls += `<div class="seg">${ABORTIVE_KINDS[rules.players].map((kind) => button('kind', kind, t().abortiveKinds[kind], f.kind === kind)).join('')}</div>`;
  }
  if (f.outcome === 'draw') controls += `<p class="hint">${t().tapTenpai}</p>`;
  if (f.outcome === 'chombo') controls += `<p class="hint">${t().chomboHint}</p>`;
  if (f.outcome === 'ron' || f.outcome === 'tsumo') controls += valueFields(game);
  if (problem) controls += `<p class="hint">${problem}</p>`;

  const picked = f.outcome !== null || f.menu !== null || f.winner !== null;
  const save = `<button class="primary" data-action="save-round" ${problem !== null ? 'disabled' : ''}>${editing ? t().saveChanges : t().saveRound}</button>`;
  if (editing) {
    controls += `<div class="row"><button data-action="cancel-edit">${t().cancel}</button>
      <button class="danger" data-action="delete-round">${armed === 'delete-round' ? t().tapToDeleteRound : t().deleteRound}</button>
      ${f.winner !== null ? `<button data-action="back">${t().back}</button>` : ''}${save}</div>`;
  } else if (picked) {
    controls += `<div class="row"><button data-action="back">${t().back}</button>${save}</div>`;
  }

  return `<tr class="entry-row">${roundCell(stateAt, rules)}${strip(entry && stripColor(entry, game))}${cells}</tr>
    <tr class="controls"><td colspan="${players.length + 2}">${controls}</td></tr>`;
}

function gameFooter(game, result) {
  return `<section><label class="field column"><span>${t().notes}</span><textarea data-game-notes rows="2">${esc(game.notes)}</textarea></label>
    <div class="row">
      ${!result.over ? `<button data-action="end-game">${armed === 'end-game' ? t().tapToEnd : t().endNow}</button>` : ''}
      ${game.endedBy ? `<button data-action="resume-game">${t().resumeGame}</button>` : ''}
      <button class="danger" data-action="delete-game">${armed === 'delete-game' ? t().tapToDeleteGame : t().deleteGame}</button>
    </div></section>`;
}

// ---------- Actions ----------

const currentGame = () => local.find((game) => game.id === route().id);
const CONFIRM = new Set(['delete-round', 'end-game', 'delete-game']);

const ACTIONS = {
  'new-game': () => { setupDraft = freshDraft(4); location.hash = 'new'; },
  'cancel-setup': () => { setupDraft = null; location.hash = ''; },
  seg: ({ key, value }) => {
    if (key === 'players') {
      setupDraft = { ...freshDraft(Number(value), setupDraft.rules.length, setupDraft.names, setupDraft.notes), date: setupDraft.date };
    } else {
      setupDraft.rules.length = value;
    }
  },
  'start-game': () => {
    const names = setupDraft.names.map((name) => name.trim());
    const { rules } = setupDraft;
    let problem = null;
    if (names.some((name) => !name)) problem = t().needNames;
    else if (new Set(names).size !== names.length) problem = t().sitOnce;
    else if (rules.uma.reduce((a, b) => a + b, 0) !== 0) problem = t().umaZero;
    else if (!setupDraft.date) problem = t().needDate;
    else if (rules.returnPoints < rules.startPoints) problem = t().returnBelowStart;
    if (problem) { document.getElementById('setup-error').textContent = problem; return false; }
    const game = newGame({ players: names, rules: { ...rules, uma: [...rules.uma] }, date: setupDraft.date, notes: setupDraft.notes.trim() });
    local.push(game);
    persist();
    setupDraft = null;
    location.hash = `game/${game.id}`;
  },
  export: () => store.exportData(published, local.filter((game) => replay(game).over)),

  mode: ({ value }) => {
    if (value === 'other') form = { ...blankForm(form.riichi), menu: 'other' };
    // A player in riichi must be tenpai, so they start out marked tenpai.
    else form = { ...blankForm(form.riichi), outcome: 'draw', tenpai: [...form.riichi] };
  },
  sub: ({ value }) => { form = { ...blankForm(form.riichi), menu: form.menu, outcome: value }; },
  kind: ({ value }) => { form.kind = value; },
  cell: ({ seat }) => tapCell(Number(seat)),
  riichi: ({ seat }) => {
    const s = Number(seat);
    form.riichi = form.riichi.includes(s) ? form.riichi.filter((x) => x !== s) : [...form.riichi, s];
    if (form.outcome === 'draw' && form.riichi.includes(s) && !form.tenpai.includes(s)) form.tenpai.push(s);
  },
  back: () => { form = blankForm(form.riichi); },
  yakuman: () => {
    form.yakuman = form.yakuman >= 6 ? 1 : form.yakuman + 1;
    form.paoYakuman = Math.min(form.paoYakuman, form.yakuman);
  },
  'save-round': () => {
    const game = currentGame();
    const entry = entryFromForm(form, game.rules.players);
    updateGame(editIndex === null ? saveRound(game, entry) : saveRound(game, entry, editIndex));
    form = blankForm();
    editIndex = null;
  },
  'edit-round': ({ index }) => {
    editIndex = Number(index);
    form = formFromEntry(currentGame().rounds[editIndex]);
  },
  'cancel-edit': () => { editIndex = null; form = blankForm(); },
  'delete-round': () => {
    updateGame(deleteRound(currentGame(), editIndex));
    editIndex = null;
    form = blankForm();
  },
  yame: () => updateGame({ ...currentGame(), endedBy: 'yame' }),
  'end-game': () => updateGame({ ...currentGame(), endedBy: 'manual' }),
  'resume-game': () => updateGame({ ...currentGame(), endedBy: null }),
  'delete-game': () => {
    const { id } = route();
    local = local.filter((game) => game.id !== id);
    persist();
    location.hash = '';
  },
};

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action], [data-lang]');
  if (!el || el.disabled) return;
  if (el.dataset.lang) {
    language = el.dataset.lang;
    store.saveLanguage(language);
    render();
    return;
  }
  const { action } = el.dataset;
  if (CONFIRM.has(action) && armed !== action) {
    armed = action;
    render();
    return;
  }
  armed = null;
  if (ACTIONS[action]?.(el.dataset) !== false) render();
});

document.addEventListener('input', (event) => {
  const el = event.target;
  if (el.dataset.name !== undefined) setupDraft.names[Number(el.dataset.name)] = el.value;
  if (el.dataset.draftNotes !== undefined) setupDraft.notes = el.value;
  if (el.dataset.draftDate !== undefined) setupDraft.date = el.value;
  if (el.dataset.number !== undefined) {
    // Han and fu: digits only. Re-render so the preview follows the typing, then put the cursor back.
    const key = el.dataset.number;
    if (form.yakuman) Object.assign(form, { yakuman: 0, paoSeat: null, paoYakuman: 1 });
    const digits = el.value.replace(/\D/g, '').slice(0, 3);
    form[key] = digits === '' ? null : Number(digits);
    render();
    const again = document.querySelector(`[data-number="${key}"]`);
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  }
});

document.addEventListener('change', (event) => {
  const el = event.target;
  const { dataset } = el;
  if (dataset.rule) setupDraft.rules[dataset.rule] = Number(el.value);
  else if (dataset.uma !== undefined) setupDraft.rules.uma[Number(dataset.uma)] = Number(el.value);
  else if (dataset.switch) setupDraft.rules[dataset.switch] = el.checked;
  else if (dataset.form) form[dataset.form] = el.value === '' ? null : Number(el.value);
  else if (dataset.gameNotes !== undefined) { updateGame({ ...currentGame(), notes: el.value.trim() }); return; }
  else return;
  render();
});

// The toggle event doesn't bubble, so listen in the capture phase.
document.addEventListener('toggle', (event) => {
  if (event.target.dataset?.shelf === 'rules') rulesOpen = event.target.open;
}, true);

window.addEventListener('hashchange', () => {
  armed = null;
  editIndex = null;
  form = blankForm();
  render();
});

app.innerHTML = `<p class="hint">${t().loading}</p>`;
published = await store.loadPublishedGames();
local = store.loadLocalGames(published);
if (route().name === 'new' && !setupDraft) setupDraft = freshDraft(4);
render();
