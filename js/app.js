// The page: home, game setup, and the game screen (scoreboard, round entry, history).
// Every change re-renders the whole view from the data; there is no other UI state to keep in sync.

import { defaultRules, newGame, saveRound, deleteRound, replay, computeDeltas, dealerOf, windOf, handNumberOf } from './game.js';
import { finalStandings, formatPoints, limitName } from './scoring.js';
import { roundLabel, windName } from './names.js';
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

const SWITCHES = ['kiriageMangan', 'kazoeYakuman', 'busting', 'nagashiMangan', 'abortiveDraws'];
const t = () => TEXT[language];
const FU = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
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
    ${SWITCHES.map((key) => `<label class="check"><input type="checkbox" data-switch="${key}" ${rules[key] ? 'checked' : ''}> ${t().switches[key]}</label>`).join('')}
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
function scoreTiles(tiles) {
  return `<div class="tiles">${tiles.map((tile) => `<div class="tile${tile.highlight ? ' highlight' : ''}">
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
    })));
  } else {
    html += scoreTiles(players.map((name, seat) => ({
      corner: tileWind((seat - dealer + rules.players) % rules.players), name, score: state.scores[seat], points: live[seat].points, highlight: seat === dealer,
    })));
    html += `<p class="hint">${t().tileHint}</p>`;
  }

  if (editable && result.endsAt !== null && result.endsAt < game.rounds.length - 1) {
    html += `<p class="warning">${t().endsAtWarning(result.endsAt + 1)}</p>`;
  }
  if (editable && result.canYame && editIndex === null) {
    html += `<div class="banner"><span>${t().yameBanner}</span><button class="small" data-action="yame">${t().endGame}</button></div>`;
  }
  if (editable && (!result.over || editIndex !== null)) {
    html += formView(game, editIndex === null ? state : result.before[editIndex]);
  }
  html += historyView(game, result, editable);
  if (editable) html += gameFooter(game, result);
  return html + `<p><a href="#">${t().allGames}</a></p>`;
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
  const yakumanOptions = [[0, t().hanAndFu], ...[1, 2, 3, 4, 5, 6].map((n) => [n, t().yakuman(n)])];
  let html = `<div class="field"><span>${t().value}</span>${select('yakuman', yakumanOptions, f.yakuman)}</div>`;
  if (f.yakuman === 0) {
    const limit = limitText(limitName({ han: f.han, fu: f.fu }, rules), 0, t());
    html += `<div class="field"><span>${t().hanLabel}</span>${select('han', Array.from({ length: 13 }, (_, i) => [i + 1, t().han(i + 1)]), f.han)}
      ${f.han < 5 ? select('fu', FU.map((fu) => [fu, t().fu(fu)]), f.fu) : ''}</div>
      ${limit ? `<p class="hint">${limit}</p>` : ''}`;
  } else {
    const others = players.map((name, seat) => [seat, esc(name)]).filter(([seat]) => seat !== f.winner);
    html += `<div class="field"><span>${t().pao}</span>${select('paoSeat', [['', t().noPao], ...others], f.paoSeat ?? '')}</div>`;
    if (f.paoSeat !== null && f.yakuman > 1) {
      html += `<div class="field"><span>${t().paoFor}</span>${select('paoYakuman', Array.from({ length: f.yakuman }, (_, i) => [i + 1, t().yakuman(i + 1)]), f.paoYakuman)}</div>`;
    }
  }
  return html;
}

function formProblem(f) {
  if ((f.outcome === 'ron' || f.outcome === 'tsumo') && f.winner === null) return t().pickWinner;
  if (f.outcome === 'ron' && f.loser === null) return t().pickLoser;
  if (f.outcome === 'nagashi' && f.seat === null) return t().pickNagashi;
  if (f.outcome === 'chombo' && f.offender === null) return t().pickChombo;
  if (f.outcome === 'draw' && f.riichi.some((seat) => !f.tenpai.includes(seat))) return t().riichiMustBeTenpai;
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
  const outcomes = ['ron', 'tsumo', 'draw', ...(rules.nagashiMangan ? ['nagashi'] : []), ...(rules.abortiveDraws ? ['abortive'] : []), 'chombo'];
  const label = roundLabel(windOf(stateAt, rules), handNumberOf(stateAt, rules), stateAt.honba, language);
  let html = `<div class="card"><h3>${editIndex === null ? t().recordRound : t().editing(label)}</h3>
    <div class="seg">${outcomes.map((value) => `<button class="${f.outcome === value ? 'on' : ''}" data-action="outcome" data-value="${value}">${t().outcomes[value]}</button>`).join('')}</div>`;

  if (f.outcome === 'ron' || f.outcome === 'tsumo') {
    html += `<h3>${t().winner}</h3>${seatButtons(game, 'winner', f.winner)}`;
    if (f.outcome === 'ron') html += `<h3>${t().dealtIn}</h3>${seatButtons(game, 'loser', f.loser, { disabled: (seat) => seat === f.winner })}`;
    html += valueFields(game);
  }
  if (f.outcome === 'draw') html += `<h3>${t().tenpai}</h3>${seatButtons(game, 'tenpai', f.tenpai, { multi: true })}`;
  if (f.outcome === 'nagashi') html += `<h3>${t().nagashiBy}</h3>${seatButtons(game, 'seat', f.seat)}`;
  if (f.outcome === 'chombo') html += `<h3>${t().chomboBy}</h3>${seatButtons(game, 'offender', f.offender)}<p class="hint">${t().chomboHint}</p>`;
  if (f.outcome !== 'chombo') html += `<h3>${t().riichiThisRound}</h3>${seatButtons(game, 'riichi', f.riichi, { multi: true })}`;

  const problem = formProblem(f);
  if (problem) {
    html += `<p class="hint">${problem}</p>`;
  } else {
    const deltas = computeDeltas(entryFromForm(f, rules.players), stateAt, rules);
    html += `<div class="preview">${players.map((name, seat) =>
      `<span>${esc(name)}</span><span class="num ${signClass(deltas[seat])}">${fmtDelta(deltas[seat])}</span>`).join('')}</div>`;
  }

  html += `<div class="row">${editIndex === null ? '' : `<button data-action="cancel-edit">${t().cancel}</button>
      <button class="danger" data-action="delete-round">${armed === 'delete-round' ? t().tapToDeleteRound : t().deleteRound}</button>`}
    <button class="primary" data-action="save-round" ${problem ? 'disabled' : ''}>${editIndex === null ? t().saveRound : t().saveChanges}</button></div></div>`;
  return html;
}

// ---------- History ----------

function describe(round, game) {
  const name = (seat) => esc(game.players[seat]);
  const tx = t();
  const value = () => {
    const limit = limitText(limitName(round, game.rules), round.yakuman ?? 0, tx);
    if (round.yakuman) return limit;
    const base = round.han < 5 ? `${tx.han(round.han)} ${tx.fu(round.fu)}` : tx.han(round.han);
    return limit ? `${base} · ${limit}` : base;
  };
  let text;
  switch (round.outcome) {
    case 'ron': text = `${tx.ronFrom(name(round.winner), name(round.loser))} · ${value()}`; break;
    case 'tsumo': text = `${tx.tsumoBy(name(round.winner))} · ${value()}`; break;
    case 'draw': {
      const tenpai = round.tenpai.flatMap((isTenpai, seat) => (isTenpai ? [name(seat)] : []));
      text = tenpai.length ? tx.drawTenpai(tenpai.join(', ')) : tx.drawAllNoten;
      break;
    }
    case 'nagashi': text = tx.nagashiRow(name(round.seat)); break;
    case 'abortive': text = tx.abortiveRow; break;
    case 'chombo': text = tx.chomboRow(name(round.offender)); break;
    default: text = '';
  }
  if (round.pao) text += ` · ${tx.paoRow(name(round.pao.seat))}`;
  if (round.riichi?.length && round.outcome !== 'chombo') text += ` · ${tx.riichiRow(round.riichi.map(name).join(', '))}`;
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
        ${editable ? `<button class="small" data-action="edit-round" data-index="${index}">${t().edit}</button>` : ''}</div>
      <div class="deltas">${players.map((name, seat) =>
        `<span>${esc(name)} <b class="${signClass(round.deltas[seat])}">${fmtDelta(round.deltas[seat])}</b></span>`).join('')}</div></li>`;
  });
  return `<section><h2>${t().rounds}</h2><ul class="history">${items.reverse().join('')}</ul></section>`;
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
  if (el.dataset.draftDate !== undefined) setupDraft.date = el.value;
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
