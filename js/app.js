// The page: home, game setup, and the game screen (scoreboard, round entry, history).
// Every change re-renders the whole view from the data; there is no other UI state to keep in sync.

import { defaultRules, newGame, saveRound, deleteRound, replay, computeDeltas, dealerOf, windOf, handNumberOf } from './game.js';
import { finalStandings, formatPoints, limitName } from './scoring.js';
import { roundLabel, windName } from './names.js';
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

const SWITCHES = [
  ['kiriageMangan', 'Kiriage mangan'],
  ['kazoeYakuman', 'Kazoe yakuman'],
  ['busting', 'Busting (game ends below 0)'],
  ['nagashiMangan', 'Nagashi mangan'],
  ['abortiveDraws', 'Abortive draws'],
];
const OVER_TEXT = { normal: 'Game over', bust: 'Game over: bust', yame: 'Game over: dealer ended it', manual: 'Game ended early' };
const PLACES = ['1st', '2nd', '3rd', '4th'];
const FU = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
const STICK = '<svg width="54" height="10" viewBox="0 0 60 11" aria-hidden="true"><rect x="0.5" y="0.5" width="59" height="10" rx="5"/><circle cx="30" cy="5.5" r="2.8" fill="#d32f2f"/></svg>';

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fmtDelta = (d) => (d > 0 ? `+${d.toLocaleString()}` : d < 0 ? `−${(-d).toLocaleString()}` : '0');
const signClass = (d) => (d > 0 ? 'plus' : d < 0 ? 'minus' : '');

function blankForm() {
  return { outcome: 'ron', winner: null, loser: null, han: 1, fu: 30, yakuman: 0, paoSeat: null, paoYakuman: 1, riichi: [], tenpai: [], seat: null, offender: null };
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
  const warning = saveFailed ? '<p class="warning">This browser refused to save. Keep this page open and export or note the scores.</p>' : '';
  app.innerHTML = warning + view;
  document.querySelectorAll('[data-lang]').forEach((button) => button.classList.toggle('on', button.dataset.lang === language));
}

function gameList(games) {
  return `<ul class="games">${games.map((game) => `<li><a href="#game/${game.id}">${esc(fmtDate(game.date))} · ${game.players.map(esc).join(', ')}</a></li>`).join('')}</ul>`;
}

function homeView() {
  const inProgress = local.filter((game) => !replay(game).over);
  const finished = local.filter((game) => replay(game).over);
  return `
    <button class="primary wide" data-action="new-game">New game</button>
    ${inProgress.length ? `<section><h2>In progress</h2>${gameList(inProgress)}</section>` : ''}
    ${finished.length ? `<section><h2>Not yet exported</h2>${gameList(finished)}
      <button class="wide" data-action="export">Export data.json</button>
      <p class="hint">Commit the downloaded data.json to the repo. These games stay listed here until the new file is on the site.</p></section>` : ''}
    <section><h2>Past games</h2>${published.length ? gameList([...published].reverse()) : '<p class="hint">None yet.</p>'}</section>`;
}

function freshDraft(players, length = 'south', names = [], notes = '') {
  const seats = Array.from({ length: players }, (_, seat) => names[seat] ?? '');
  return { rules: { ...defaultRules(players), length }, names: seats, notes };
}

function seg(key, options, current) {
  return `<div class="seg">${options.map(([value, label]) =>
    `<button class="${String(value) === String(current) ? 'on' : ''}" data-action="seg" data-key="${key}" data-value="${value}">${label}</button>`).join('')}</div>`;
}

function setupView() {
  if (!setupDraft) setupDraft = freshDraft(4);
  const { rules, names, notes } = setupDraft;
  const oka = (rules.returnPoints - rules.startPoints) * rules.players;
  return `
    <h2>New game</h2>
    <div class="field"><span>Players</span>${seg('players', [[4, '4-player'], [3, '3-player']], rules.players)}</div>
    <div class="field"><span>Length</span>${seg('length', [['east', 'East only'], ['south', 'East-South']], rules.length)}</div>
    <h3>Seats</h3>
    <datalist id="roster">${roster().map((name) => `<option value="${esc(name)}">`).join('')}</datalist>
    ${names.map((name, seat) => `<label class="field"><span>${windName(seat, language)}</span>
      <input list="roster" data-name="${seat}" value="${esc(name)}" autocomplete="off" placeholder="Pick or type a name"></label>`).join('')}
    <h3>Points</h3>
    <label class="field"><span>Start</span><input type="number" inputmode="numeric" step="1000" data-rule="startPoints" value="${rules.startPoints}"></label>
    <label class="field"><span>Return</span><input type="number" inputmode="numeric" step="1000" data-rule="returnPoints" value="${rules.returnPoints}"></label>
    <div class="field"><span>Uma</span><div class="uma">${rules.uma.map((value, place) =>
      `<input type="number" inputmode="numeric" data-uma="${place}" value="${value}" aria-label="Uma for ${PLACES[place]}">`).join('')}</div></div>
    <div class="field"><span>Oka</span><span>${oka.toLocaleString()} to 1st</span></div>
    <h3>Rules</h3>
    ${SWITCHES.map(([key, label]) => `<label class="check"><input type="checkbox" data-switch="${key}" ${rules[key] ? 'checked' : ''}> ${label}</label>`).join('')}
    <label class="field column"><span>Notes</span><textarea data-draft-notes rows="2">${esc(notes)}</textarea></label>
    <p class="error" id="setup-error"></p>
    <div class="row"><button data-action="cancel-setup">Cancel</button><button class="primary" data-action="start-game">Start game</button></div>`;
}

function sticksBadge(count) {
  return count > 0 ? `<span class="sticks" title="Riichi sticks on the table">${STICK} × ${count}</span>` : '';
}

// Seat wind on a score tile: 東 in Japanese, one letter (E) otherwise, so names have room.
const tileWind = (wind) => (language === 'jp' ? windName(wind, language) : windName(wind, language)[0]);

// One tile per player in a single row: wind (or place) top left, name top right, score in the middle, final points at the bottom.
function scoreTiles(tiles) {
  return `<div class="tiles">${tiles.map((tile) => `<div class="tile${tile.highlight ? ' highlight' : ''}">
    <div class="tile-top"><span class="corner">${tile.corner}</span><span class="tile-name">${esc(tile.name)}</span></div>
    <div class="tile-score">${tile.score.toLocaleString()}</div>
    <div class="tile-points ${signClass(tile.points)}">${formatPoints(tile.points)}</div></div>`).join('')}</div>`;
}

function gameView(id) {
  const found = findGame(id);
  if (!found) return '<p>Game not found.</p><p><a href="#">Back</a></p>';
  const { game, editable } = found;
  const { rules, players } = game;
  const result = replay(game);
  const { state } = result;
  const dealer = dealerOf(state, rules);
  const live = finalStandings(state.scores, state.sticks, rules);

  let html = result.over
    ? `<h2>${OVER_TEXT[result.reason]}</h2>`
    : `<h2 class="round">${roundLabel(windOf(state, rules), handNumberOf(state, rules), state.honba, language)} ${sticksBadge(state.sticks)}</h2>`;

  if (result.over) {
    const order = players.map((_, seat) => seat).sort((a, b) => live[a].rank - live[b].rank);
    html += scoreTiles(order.map((seat) => ({
      corner: PLACES[live[seat].rank], name: players[seat], score: live[seat].score, points: live[seat].points, highlight: live[seat].rank === 0,
    })));
  } else {
    html += scoreTiles(players.map((name, seat) => ({
      corner: tileWind((seat - dealer + rules.players) % rules.players), name, score: state.scores[seat], points: live[seat].points, highlight: seat === dealer,
    })));
    html += '<p class="hint">Bottom of each tile: final points if the game ended now.</p>';
  }

  if (editable && result.endsAt !== null && result.endsAt < game.rounds.length - 1) {
    html += `<p class="warning">The game should have ended after round ${result.endsAt + 1}. Fix or delete the rounds after it.</p>`;
  }
  if (editable && result.canYame && editIndex === null) {
    html += `<div class="banner"><span>The dealer may end the game here.</span><button class="small" data-action="yame">End game</button></div>`;
  }
  if (editable && (!result.over || editIndex !== null)) {
    html += formView(game, editIndex === null ? state : result.before[editIndex]);
  }
  html += historyView(game, result, editable);
  if (editable) html += gameFooter(game, result);
  return html + '<p><a href="#">← All games</a></p>';
}

// ---------- Round entry ----------

function seatButtons(game, field, selected, { multi = false, disabled = () => false } = {}) {
  return `<div class="seg">${game.players.map((name, seat) => {
    const on = multi ? selected.includes(seat) : selected === seat;
    return `<button class="${on ? 'on' : ''}" data-action="${multi ? 'toggle' : 'pick'}" data-field="${field}" data-seat="${seat}" ${disabled(seat) ? 'disabled' : ''}>${esc(name)}</button>`;
  }).join('')}</div>`;
}

function select(key, options, current) {
  return `<select data-form="${key}">${options.map(([value, label]) =>
    `<option value="${value}" ${String(value) === String(current) ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
}

function valueFields(game) {
  const { rules, players } = game;
  const f = form;
  const yakumanOptions = [[0, 'Han and fu'], [1, 'Yakuman'], ...[2, 3, 4, 5, 6].map((n) => [n, `${n}x Yakuman`])];
  let html = `<div class="field"><span>Value</span>${select('yakuman', yakumanOptions, f.yakuman)}</div>`;
  if (f.yakuman === 0) {
    const limit = limitName({ han: f.han, fu: f.fu }, rules);
    html += `<div class="field"><span>Han</span>${select('han', Array.from({ length: 13 }, (_, i) => [i + 1, `${i + 1} han`]), f.han)}
      ${f.han < 5 ? select('fu', FU.map((fu) => [fu, `${fu} fu`]), f.fu) : ''}</div>
      ${limit ? `<p class="hint">${limit}</p>` : ''}`;
  } else {
    const others = players.map((name, seat) => [seat, esc(name)]).filter(([seat]) => seat !== f.winner);
    html += `<div class="field"><span>Pao</span>${select('paoSeat', [['', 'None'], ...others], f.paoSeat ?? '')}</div>`;
    if (f.paoSeat !== null && f.yakuman > 1) {
      html += `<div class="field"><span>Pao for</span>${select('paoYakuman', Array.from({ length: f.yakuman }, (_, i) => [i + 1, `${i + 1}x Yakuman`]), f.paoYakuman)}</div>`;
    }
  }
  return html;
}

function formProblem(f) {
  if ((f.outcome === 'ron' || f.outcome === 'tsumo') && f.winner === null) return 'Pick the winner.';
  if (f.outcome === 'ron' && f.loser === null) return 'Pick who dealt in.';
  if (f.outcome === 'nagashi' && f.seat === null) return 'Pick who got nagashi mangan.';
  if (f.outcome === 'chombo' && f.offender === null) return 'Pick who made the chombo.';
  if (f.outcome === 'draw' && f.riichi.some((seat) => !f.tenpai.includes(seat))) return 'A player in riichi must be tenpai.';
  return null;
}

function entryFromForm(f, players) {
  const riichi = [...f.riichi].sort();
  switch (f.outcome) {
    case 'ron':
    case 'tsumo': {
      const pao = f.yakuman > 0 && f.paoSeat !== null ? { seat: f.paoSeat, yakuman: Math.min(f.paoYakuman, f.yakuman) } : null;
      const entry = { outcome: f.outcome, winner: f.winner, han: f.yakuman ? 0 : f.han, fu: f.yakuman ? 0 : f.fu, yakuman: f.yakuman, pao, riichi };
      if (f.outcome === 'ron') entry.loser = f.loser;
      return entry;
    }
    case 'draw': return { outcome: 'draw', tenpai: Array.from({ length: players }, (_, seat) => f.tenpai.includes(seat)), riichi };
    case 'nagashi': return { outcome: 'nagashi', seat: f.seat, riichi };
    case 'abortive': return { outcome: 'abortive', riichi };
    default: return { outcome: 'chombo', offender: f.offender };
  }
}

function formFromEntry(entry) {
  return {
    ...blankForm(),
    outcome: entry.outcome,
    winner: entry.winner ?? null,
    loser: entry.loser ?? null,
    han: entry.han || 1,
    fu: entry.fu || 30,
    yakuman: entry.yakuman ?? 0,
    paoSeat: entry.pao?.seat ?? null,
    paoYakuman: entry.pao?.yakuman ?? 1,
    riichi: [...(entry.riichi ?? [])],
    tenpai: (entry.tenpai ?? []).flatMap((isTenpai, seat) => (isTenpai ? [seat] : [])),
    seat: entry.seat ?? null,
    offender: entry.offender ?? null,
  };
}

function formView(game, stateAt) {
  const { rules, players } = game;
  const f = form;
  const outcomes = [
    ['ron', 'Ron'], ['tsumo', 'Tsumo'], ['draw', 'Draw'],
    ...(rules.nagashiMangan ? [['nagashi', 'Nagashi']] : []),
    ...(rules.abortiveDraws ? [['abortive', 'Abortive']] : []),
    ['chombo', 'Chombo'],
  ];
  const label = roundLabel(windOf(stateAt, rules), handNumberOf(stateAt, rules), stateAt.honba, language);
  let html = `<div class="card"><h3>${editIndex === null ? 'Record round' : `Editing ${label}`}</h3>
    <div class="seg">${outcomes.map(([value, text]) => `<button class="${f.outcome === value ? 'on' : ''}" data-action="outcome" data-value="${value}">${text}</button>`).join('')}</div>`;

  if (f.outcome === 'ron' || f.outcome === 'tsumo') {
    html += `<h3>Winner</h3>${seatButtons(game, 'winner', f.winner)}`;
    if (f.outcome === 'ron') html += `<h3>Dealt in</h3>${seatButtons(game, 'loser', f.loser, { disabled: (seat) => seat === f.winner })}`;
    html += valueFields(game);
  }
  if (f.outcome === 'draw') html += `<h3>Tenpai</h3>${seatButtons(game, 'tenpai', f.tenpai, { multi: true })}`;
  if (f.outcome === 'nagashi') html += `<h3>Nagashi mangan by</h3>${seatButtons(game, 'seat', f.seat)}`;
  if (f.outcome === 'chombo') html += `<h3>Chombo by</h3>${seatButtons(game, 'offender', f.offender)}<p class="hint">Riichi sticks from this round are returned.</p>`;
  if (f.outcome !== 'chombo') html += `<h3>Riichi this round</h3>${seatButtons(game, 'riichi', f.riichi, { multi: true })}`;

  const problem = formProblem(f);
  if (problem) {
    html += `<p class="hint">${problem}</p>`;
  } else {
    const deltas = computeDeltas(entryFromForm(f, rules.players), stateAt, rules);
    html += `<div class="preview">${players.map((name, seat) =>
      `<span>${esc(name)}</span><span class="num ${signClass(deltas[seat])}">${fmtDelta(deltas[seat])}</span>`).join('')}</div>`;
  }

  html += `<div class="row">${editIndex === null ? '' : `<button data-action="cancel-edit">Cancel</button>
      <button class="danger" data-action="delete-round">${armed === 'delete-round' ? 'Tap again to delete' : 'Delete round'}</button>`}
    <button class="primary" data-action="save-round" ${problem ? 'disabled' : ''}>${editIndex === null ? 'Save round' : 'Save changes'}</button></div></div>`;
  return html;
}

// ---------- History ----------

function describe(round, game) {
  const name = (seat) => esc(game.players[seat]);
  const value = () => {
    const limit = limitName(round, game.rules);
    if (round.yakuman) return limit;
    const base = round.han < 5 ? `${round.han} han ${round.fu} fu` : `${round.han} han`;
    return limit ? `${base} · ${limit}` : base;
  };
  let text;
  switch (round.outcome) {
    case 'ron': text = `${name(round.winner)} ron from ${name(round.loser)} · ${value()}`; break;
    case 'tsumo': text = `${name(round.winner)} tsumo · ${value()}`; break;
    case 'draw': {
      const tenpai = round.tenpai.flatMap((isTenpai, seat) => (isTenpai ? [name(seat)] : []));
      text = `Draw · ${tenpai.length ? `tenpai: ${tenpai.join(', ')}` : 'all noten'}`;
      break;
    }
    case 'nagashi': text = `Nagashi mangan · ${name(round.seat)}`; break;
    case 'abortive': text = 'Abortive draw'; break;
    case 'chombo': text = `Chombo · ${name(round.offender)}`; break;
    default: text = '';
  }
  if (round.pao) text += ` · pao: ${name(round.pao.seat)}`;
  if (round.riichi?.length && round.outcome !== 'chombo') text += ` · riichi: ${round.riichi.map(name).join(', ')}`;
  return text;
}

function historyView(game, result, editable) {
  if (game.rounds.length === 0) return '';
  const { rules, players } = game;
  const items = game.rounds.map((round, index) => {
    const before = result.before[index];
    const label = roundLabel(windOf(before, rules), handNumberOf(before, rules), before.honba, language);
    return `<li class="${index === editIndex ? 'editing' : ''}">
      <div class="line"><strong>${label}</strong><span class="what">${describe(round, game)}</span>
        ${editable ? `<button class="small" data-action="edit-round" data-index="${index}">Edit</button>` : ''}</div>
      <div class="deltas">${players.map((name, seat) =>
        `<span>${esc(name)} <b class="${signClass(round.deltas[seat])}">${fmtDelta(round.deltas[seat])}</b></span>`).join('')}</div></li>`;
  });
  return `<section><h2>Rounds</h2><ul class="history">${items.reverse().join('')}</ul></section>`;
}

function gameFooter(game, result) {
  return `<section><label class="field column"><span>Notes</span><textarea data-game-notes rows="2">${esc(game.notes)}</textarea></label>
    <div class="row">
      ${!result.over ? `<button data-action="end-game">${armed === 'end-game' ? 'Tap again to end now' : 'End game now'}</button>` : ''}
      ${game.endedBy ? '<button data-action="resume-game">Resume game</button>' : ''}
      <button class="danger" data-action="delete-game">${armed === 'delete-game' ? 'Tap again to delete game' : 'Delete game'}</button>
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
      setupDraft = freshDraft(Number(value), setupDraft.rules.length, setupDraft.names, setupDraft.notes);
    } else {
      setupDraft.rules.length = value;
    }
  },
  'start-game': () => {
    const names = setupDraft.names.map((name) => name.trim());
    const { rules } = setupDraft;
    let problem = null;
    if (names.some((name) => !name)) problem = 'Every seat needs a name.';
    else if (new Set(names).size !== names.length) problem = 'Each player can only sit once.';
    else if (rules.uma.reduce((a, b) => a + b, 0) !== 0) problem = 'Uma must add up to 0.';
    else if (rules.returnPoints < rules.startPoints) problem = 'Return points can’t be below start points.';
    if (problem) { document.getElementById('setup-error').textContent = problem; return false; }
    const game = newGame({ players: names, rules: { ...rules, uma: [...rules.uma] }, notes: setupDraft.notes.trim() });
    local.push(game);
    persist();
    setupDraft = null;
    location.hash = `game/${game.id}`;
  },
  export: () => store.exportData(published, local.filter((game) => replay(game).over)),

  outcome: ({ value }) => { form.outcome = value; },
  pick: ({ field, seat }) => {
    form[field] = Number(seat);
    if (field === 'winner') {
      if (form.loser === form.winner) form.loser = null;
      if (form.paoSeat === form.winner) form.paoSeat = null;
    }
  },
  toggle: ({ field, seat }) => {
    const s = Number(seat);
    form[field] = form[field].includes(s) ? form[field].filter((x) => x !== s) : [...form[field], s];
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
    window.scrollTo(0, 0);
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

window.addEventListener('hashchange', () => {
  armed = null;
  editIndex = null;
  form = blankForm();
  render();
});

published = await store.loadPublishedGames();
local = store.loadLocalGames(published);
if (route().name === 'new' && !setupDraft) setupDraft = freshDraft(4);
render();
