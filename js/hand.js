// Pure logic for the hand entry screen: the tapped-in hand, which picker tiles are still available,
// placing melds, and turning the hand into analyzer input.
//
// A hand being entered:
//   tiles   hand tiles in the order tapped; once the hand is full, the last one is the winning tile
//   melds   [{ type: 'chi' | 'pon' | 'minkan' | 'ankan', tiles }]
//   dora, ura   indicator tiles; there are never more ura than dora
//   nuki    number of North tiles pulled as nuki-dora (3-player)
//   toggles ids of the yaku toggles that are on (see TOGGLES)
//
// A stored hand (round.hand) holds the same things under the analyzer's names:
//   { concealed, winTile, melds, doraIndicators, uraIndicators, nukiDora, toggles }
// Riichi, ron or tsumo, and the winds are not stored; they come from the round and the game.

import { parseTile, isRemovedIn3p, NORTH } from './tiles.js';
import { analyzeHand } from './analyzer.js';

// Up to 4 dora indicators, and no more ura indicators than dora.
export const MAX_DORA = 4;
export const OPEN_CALLS = ['chi', 'pon', 'kan'];
// Whether the winner in riichi still needs another ura indicator.
const needsUra = (hand) => hand.ura.length < hand.dora.length;
export const TOGGLES = ['doubleRiichi', 'ippatsu', 'haitei', 'rinshan', 'tenhou', 'chihou', 'houtei', 'chankan'];
// Yakuman a liable player can be named for, and how many yakuman each is worth.
const PAO_YAKUMAN = { daisangen: 1, daisuushii: 2, suukantsu: 1 };

export const emptyHand = () => ({ tiles: [], melds: [], dora: [], ura: [], nuki: 0, toggles: [] });

// Hand tiles needed: 14, minus 3 for each meld (a kan counts as 3 plus its replacement draw).
export const handSize = (hand) => 14 - 3 * hand.melds.length;
export const isFull = (hand) => hand.tiles.length === handSize(hand);

const allTiles = (hand) => [...hand.tiles, ...hand.melds.flatMap((meld) => meld.tiles), ...hand.dora, ...hand.ura];

// Whether these extra tiles still fit: at most 4 of each tile, 3 regular fives and 1 red five per suit
// (three red fives), and no 2m-8m in 3-player. Pulled Norths count toward the 4 Norths.
function fits(hand, extra, players) {
  const counts = new Array(34).fill(0);
  const red = [0, 0, 0];
  for (const text of [...allTiles(hand), ...extra]) {
    const tile = parseTile(text);
    counts[tile.index]++;
    if (tile.red) red[Math.floor(tile.index / 9)]++;
  }
  counts[NORTH] += hand.nuki;
  if (counts.some((count) => count > 4)) return false;
  if (red.some((count) => count > 1)) return false;
  if ([4, 13, 22].some((five, suit) => counts[five] - red[suit] > 3)) return false;
  if (players === 3 && extra.some((text) => isRemovedIn3p(parseTile(text).index))) return false;
  return true;
}

// The tiles a meld of this type makes from the tapped tile, or null if it can't.
// Chi takes the tapped tile as its lowest. A kan of 5s always includes the red five.
export function meldTiles(type, text) {
  if (parseTile(text).red) return null;
  const suit = text[1];
  const number = Number(text[0]);
  if (type === 'chi') return suit !== 'z' && number <= 7 ? [0, 1, 2].map((n) => `${number + n}${suit}`) : null;
  if (type === 'pon') return [text, text, text];
  const kan = [text, text, text, text];
  if (number === 5 && suit !== 'z') kan[0] = `0${suit}`;
  return kan;
}

const meldType = (mode) => ({ chi: 'chi', pon: 'pon', kan: 'minkan', ankan: 'ankan' }[mode]);

// Whether a tap on this picker tile does anything in this mode.
export function canPick(hand, mode, text, players, riichi) {
  if (mode === 'hand') return !isFull(hand) && fits(hand, [text], players);
  if (mode === 'dora') return hand.dora.length < MAX_DORA && fits(hand, [text], players);
  if (mode === 'ura') return riichi && needsUra(hand) && fits(hand, [text], players);
  const tiles = meldTiles(meldType(mode), text);
  return Boolean(tiles) && hasMeldRoom(hand) && fits(hand, tiles, players);
}

// Whether another meld fits: the hand must still have room once the meld takes 3 tiles of it
// (with four melds, it never does).
const hasMeldRoom = (hand) => hand.tiles.length <= handSize(hand) - 3;

// A tap on a picker tile. Returns the new mode: a meld mode stays selected until no more melds fit,
// then it goes back to Hand.
export function pick(hand, mode, text, players, riichi) {
  if (!canPick(hand, mode, text, players, riichi)) return mode;
  if (mode === 'hand') hand.tiles.push(text);
  else if (mode === 'dora' || mode === 'ura') hand[mode].push(text);
  else {
    const type = meldType(mode);
    hand.melds.push({ type, tiles: meldTiles(type, text) });
    if (!hasMeldRoom(hand)) return 'hand';
  }
  return mode;
}

// Switches a 5 inside a meld between red and regular, when the other kind is still available.
// A kan of 5s keeps its red five.
export function toggleMeldRed(hand, meldIndex, position, players) {
  const meld = hand.melds[meldIndex];
  const text = meld.tiles[position];
  if (!['0', '5'].includes(text[0]) || text[1] === 'z' || meld.type.endsWith('kan')) return;
  const swapped = `${text[0] === '0' ? '5' : '0'}${text[1]}`;
  const without = { ...hand, melds: hand.melds.map((m, i) => (i === meldIndex ? { ...m, tiles: m.tiles.filter((_, p) => p !== position) } : m)) };
  if (fits(without, [swapped], players)) meld.tiles[position] = swapped;
}

// Removes a dora or ura indicator; the rest of its row closes the gap. Removing a dora also drops the
// last ura if there would be more ura than dora.
export function removeIndicator(hand, kind, position) {
  hand[kind].splice(position, 1);
  hand.ura.length = Math.min(hand.ura.length, hand.dora.length);
}

// Makes the hand tile at this position the winning tile (the last one), once the hand is full.
export function setWinTile(hand, position) {
  if (!isFull(hand)) return;
  const [text] = hand.tiles.splice(position, 1);
  hand.tiles.push(text);
}

// The picker mode in effect: once the hand is full, a missing dora indicator, then a missing ura indicator
// (in riichi), takes the picker over so the next tap fills it.
export function activeMode(hand, mode, riichi) {
  // A hand in riichi is closed, so calls (chi, pon, open kan) aren't available; closed kan still is.
  if (riichi && OPEN_CALLS.includes(mode)) return activeMode(hand, 'hand', riichi);
  if (!isFull(hand)) return mode;
  if (hand.dora.length === 0) return 'dora';
  if (riichi && needsUra(hand)) return 'ura';
  return mode;
}

// With one hand tile left to tap, whether this tile would complete a winning shape (yaku aside,
// since toggles and dora can still change those). Used to fade the picker tiles that can't.
export function completesHand(hand, text, rules) {
  if (hand.tiles.length !== handSize(hand) - 1) return true;
  const result = analyzeHand({
    concealed: [...hand.tiles], winTile: text, melds: hand.melds.map((meld) => ({ type: meld.type, tiles: [...meld.tiles] })),
    tsumo: false, seatWind: 1, roundWind: 0,
  }, rules);
  return result.ok || result.error === 'noYaku';
}

export const canAddNuki = (hand, players) => players === 3 && fits(hand, ['4z'], players);

// The hand tiles sorted for display, with the winning tile kept apart once the hand is full.
// Each entry carries its position in hand.tiles, so a tap can remove it.
export function handDisplay(hand) {
  const entries = hand.tiles.map((text, position) => ({ text, position }));
  const win = isFull(hand) ? entries.pop() : null;
  const key = ({ text }) => parseTile(text).index * 2 + (text[0] === '0' ? 0 : 1);
  entries.sort((a, b) => key(a) - key(b));
  return { tiles: entries, win };
}

// Toggles that can apply to this win.
export function availableToggles({ riichi, tsumo, dealer, hand }) {
  const hasKan = hand.melds.some((meld) => meld.type.endsWith('kan'));
  return TOGGLES.filter((id) => ({
    doubleRiichi: riichi, ippatsu: riichi,
    haitei: tsumo, rinshan: tsumo && hasKan, tenhou: tsumo && dealer, chihou: tsumo && !dealer,
    houtei: !tsumo, chankan: !tsumo,
  }[id]));
}

// Analyzer input for a hand, given the parts that come from the round and game.
// Toggles and ura dora that no longer apply (for example after riichi is turned off) are left out.
export function analyzerInput(hand, { riichi, tsumo, seatWind, roundWind }) {
  const toggles = availableToggles({ riichi, tsumo, dealer: seatWind === 0, hand }).filter((id) => hand.toggles.includes(id));
  const input = {
    concealed: hand.tiles.slice(0, -1),
    winTile: hand.tiles[hand.tiles.length - 1],
    melds: hand.melds.map((meld) => ({ type: meld.type, tiles: [...meld.tiles] })),
    tsumo, seatWind, roundWind,
    riichi: riichi && !toggles.includes('doubleRiichi'),
    doraIndicators: [...hand.dora],
    uraIndicators: riichi ? [...hand.ura] : [],
    nukiDora: hand.nuki,
  };
  for (const id of toggles) input[id] = true;
  return input;
}

// The analyzer's reading of the hand. Before that: 'tileCount' while tiles are missing, 'needDora' until a dora
// indicator is in, and 'needUra' until there are as many ura indicators as dora when the winner is in riichi.
export const HAND_ERRORS = ['needDora', 'needUra'];
export function analyze(hand, context, rules) {
  if (!isFull(hand)) return { ok: false, error: 'tileCount' };
  if (hand.dora.length === 0) return { ok: false, error: 'needDora' };
  if (context.riichi && needsUra(hand)) return { ok: false, error: 'needUra' };
  return analyzeHand(analyzerInput(hand, context), rules);
}

// How many of the result's yakuman a liable player can be named for (0 when none).
export const paoYakuman = (result) => (result.ok ? result.yaku.reduce((sum, y) => sum + (PAO_YAKUMAN[y.id] ?? 0), 0) : 0);

export function toStored(hand) {
  return {
    concealed: hand.tiles.slice(0, -1),
    winTile: hand.tiles[hand.tiles.length - 1],
    melds: hand.melds.map((meld) => ({ type: meld.type, tiles: [...meld.tiles] })),
    doraIndicators: [...hand.dora], uraIndicators: [...hand.ura], nukiDora: hand.nuki, toggles: [...hand.toggles],
  };
}

export function fromStored(stored) {
  return {
    tiles: [...stored.concealed, stored.winTile],
    melds: stored.melds.map((meld) => ({ type: meld.type, tiles: [...meld.tiles] })),
    dora: [...stored.doraIndicators], ura: [...stored.uraIndicators], nuki: stored.nukiDora, toggles: [...stored.toggles],
  };
}

// The picker's rows: 1-9 of each suit with the red five after, then the honors.
export const PICKER_ROWS = [
  ...['m', 'p', 's'].map((suit) => [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}${suit}`), `0${suit}`]),
  [1, 2, 3, 4, 5, 6, 7].map((n) => `${n}z`),
];
