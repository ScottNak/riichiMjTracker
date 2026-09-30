// The Tiles tab of the hand entry screen: the tapped-in hand, melds, indicators, the tile picker,
// the yaku toggles, and what the hand scores. Its actions are in app.js with the rest.

import { PICKER_ROWS, OPEN_CALLS, activeMode, canPick, completesHand, handDisplay, handSize, isFull, canAddNuki, availableToggles, paoYakuman } from './hand.js';
import { YAKU_NAMES, yakuName } from './names.js';
import { limitName } from './scoring.js';
import { limitText } from './text.js';
import { parseTile, isRemovedIn3p } from './tiles.js';

const SUIT_FILES = { m: 'Man', p: 'Pin', s: 'Sou' };
const HONOR_FILES = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'];

function tileFile(text) {
  const [number, suit] = text;
  if (suit === 'z') return HONOR_FILES[Number(number) - 1];
  return number === '0' ? `${SUIT_FILES[suit]}5-Dora` : `${SUIT_FILES[suit]}${number}`;
}

// A tile picture. With an action, it is a button.
let readOnly = false; // set by tilesTab: a read-only hand has no buttons
function tile(text, action = '', extra = '', faded = false) {
  if (readOnly) action = '';
  const face = `<img src="tiles/${tileFile(text)}.svg" alt="${text}">`;
  const cls = faded ? 'mj faded' : 'mj';
  return action ? `<button class="${cls}" data-action="${action}" ${extra}>${face}</button>` : `<span class="${cls}">${face}</span>`;
}

// ctx: { form, rules, riichi, tsumo, dealer, result, paoPicker, readOnly, t, language }
// readOnly shows a stored hand and what it scores, with nothing to tap.
export function tilesTab(ctx) {
  const { form: f, rules, riichi, tsumo, dealer, result, paoPicker, t, language } = ctx;
  readOnly = Boolean(ctx.readOnly);
  const { hand } = f;
  const players = rules.players;
  const modes = ['hand', 'chi', 'pon', 'kan', 'ankan'];
  const chosen = [...modes, 'dora', ...(riichi ? ['ura'] : [])].includes(f.mode) ? f.mode : 'hand';
  const mode = activeMode(hand, chosen, riichi);
  // Once the hand scores, the controls hide until a tile is removed or Dora/Ura is tapped (f.expand).
  const open = !readOnly && (!result.ok || f.expand);

  // The hand, with the winning tile apart. Tap a tile to remove it; hold one to make it the winning tile.
  const shown = handDisplay(hand);
  const handTile = ({ text, position }) => tile(text, 'hand-remove', `data-pos="${position}" data-hold="${position}"`);
  let html = `<div class="hand-row">${shown.tiles.map(handTile).join('')}`;
  if (shown.win) html += `<span class="win-gap"></span>${handTile(shown.win)}`;
  html += '</div>';

  // Melds. A closed kan shows face down at both ends; in a chi, pon, or open kan the leftmost tile lies on its side.
  // A 5 in a chi or pon switches red with a tap.
  if (hand.melds.length) {
    const meldTiles = (meld, m) => {
      if (meld.type === 'ankan') return `<span class="mj back"></span>${tile(meld.tiles[0])}${tile(meld.tiles[1])}<span class="mj back"></span>`;
      return meld.tiles.map((text, p) => {
        const html = /[05][mps]/.test(text) && meld.type !== 'minkan' ? tile(text, 'meld-red', `data-meld="${m}" data-pos="${p}"`) : tile(text);
        return p === 0 ? `<span class="side">${html}</span>` : html;
      }).join('');
    };
    html += `<div class="hand-row">${hand.melds.map((meld, m) => `<span class="meld">${meldTiles(meld, m)}${readOnly ? '' : `<button class="x" data-action="meld-remove" data-meld="${m}" aria-label="${t.remove}">✕</button>`}</span>`).join('')}</div>`;
  }

  // Dora and ura indicators on one line: each label is the button that points the picker at its tiles.
  const indicators = (kind, label) => `<span class="ind">${readOnly ? `<span class="muted">${label}</span>` : `<button class="small${open && mode === kind ? ' on' : ''}" data-action="hand-mode" data-value="${kind}">${label}</button>`}${hand[kind].map((text, p) =>
    tile(text, 'indicator-remove', `data-kind="${kind}" data-pos="${p}"`)).join('')}</span>`;
  html += `<div class="ind-row">${indicators('dora', YAKU_NAMES.dora[language])}${riichi ? indicators('ura', YAKU_NAMES.uraDora[language]) : ''}</div>`;
  if (players === 3 && readOnly && hand.nuki > 0) html += `<div class="ind-row"><span class="muted">${YAKU_NAMES.nukiDora[language]}</span><span>${hand.nuki}</span></div>`;
  if (players === 3 && open) {
    html += `<div class="ind-row"><span class="muted">${YAKU_NAMES.nukiDora[language]}</span>
      <button class="small" data-action="nuki" data-value="-1" ${hand.nuki === 0 ? 'disabled' : ''}>−</button>
      <span>${hand.nuki}</span>
      <button class="small" data-action="nuki" data-value="1" ${canAddNuki(hand, players) ? '' : 'disabled'}>+</button></div>`;
  }

  // Mode buttons and the picker. 3-player leaves out 2m-8m.
  // In riichi, Chi, Pon, and Kan are disabled; Closed Kan stays.
  if (open) html += `<div class="seg modes">${modes.map((m) => `<button class="${m === mode ? 'on' : ''}" data-action="hand-mode" data-value="${m}" ${riichi && OPEN_CALLS.includes(m) ? 'disabled' : ''}>${t.modes[m]}</button>`).join('')}</div>`;
  if (open) html += `<div class="picker">${PICKER_ROWS.map((row) => `<div class="picker-row">${row
    .filter((text) => !(players === 3 && isRemovedIn3p(parseTile(text).index)))
    .map((text) => {
      // With one hand tile left, tiles that can't complete the hand are faded (still tappable).
      const faded = mode === 'hand' && !completesHand(hand, text, rules);
      return tile(text, 'pick', `data-tile="${text}" ${canPick(hand, mode, text, players, riichi) ? '' : 'disabled'}`, faded);
    }).join('')}</div>`).join('')}</div>`;

  // Yaku the tiles can't show. Riichi is the winner's riichi toggle from the entry row.
  const toggles = availableToggles({ riichi, tsumo, dealer, hand });
  if (open) html += `<div class="seg toggles"><button class="${riichi ? 'on' : ''}" data-action="riichi" data-seat="${f.winner}">${YAKU_NAMES.riichi[language]}</button>${toggles.map((id) =>
    `<button class="${hand.toggles.includes(id) ? 'on' : ''}" data-action="hand-toggle" data-value="${id}">${YAKU_NAMES[id][language]}</button>`).join('')}</div>`;

  // What the hand scores, or what is wrong with it.
  if (!isFull(hand)) {
    html += `<p class="hint center">${t.tapMore(handSize(hand) - hand.tiles.length)}</p>`;
  } else if (!result.ok) {
    html += `<p class="error center">${t.handErrors[result.error]}</p>`;
  } else {
    const han = (y) => (result.yakuman ? t.yakuman(y.han / 13) : t.hanCount(y.han));
    html += `<ul class="yaku">${result.yaku.map((y) => `<li><span>${yakuName(y, language)}</span><span>${han(y)}</span></li>`).join('')}</ul>`;
    const total = result.yakuman
      ? t.yakuman(result.yakuman)
      : [t.hanFu(result.han, result.fu), limitText(limitName(result, rules), 0, t)].filter(Boolean).join(' · ');
    html += `<p class="total">${total}</p>`;
    if (paoYakuman(result) > 0 && !readOnly) html += `<div class="value-row">${paoPicker}</div>`;
  }
  return html;
}
