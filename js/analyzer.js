// Hand analyzer: turns a winning hand into yaku, fu, and han.
// It tries every way to read the hand and keeps the highest-scoring one.
//
// Input:
//   concealed    tiles in hand, NOT including the winning tile (e.g. tiles('123m456p...'))
//   winTile      the winning tile
//   melds        [{ type: 'chi' | 'pon' | 'minkan' | 'ankan', tiles: [...] }]
//   tsumo        true for tsumo, false for ron
//   seatWind     0-3 (East, South, West, North); the dealer's seat wind is East
//   roundWind    0-3
//   riichi, doubleRiichi, ippatsu, haitei, houtei, rinshan, chankan, tenhou, chihou   booleans
//   doraIndicators, uraIndicators   tiles
//   nukiDora     number of North tiles pulled as nuki-dora (3-player only)
//
// Output: { ok: true, yaku: [{ name, han }], han, fu, yakuman } or { ok: false, error }.
// For a yakuman hand, yaku lists the yakuman with han 13 per yakuman (26 for a double), and han and fu are 0.

import {
  parseTile, isHonor, isTerminal, isTerminalOrHonor, isDragon, isWind, suitOf,
  honorName, doraFromIndicator, isRemovedIn3p, EAST, NORTH, HATSU,
} from './tiles.js';
import { basePoints } from './scoring.js';

const GREEN_TILES = new Set([19, 20, 21, 23, 25, HATSU]); // 2s 3s 4s 6s 8s Hatsu
const KOKUSHI_TILES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

export function analyzeHand(input, rules) {
  const hand = normalize(input);
  const error = validate(hand, rules);
  if (error) return { ok: false, error };

  const readings = findReadings(hand);
  if (readings.length === 0) return { ok: false, error: 'Not a complete hand' };

  let best = null;
  for (const reading of readings) {
    const result = scoreReading(reading, hand, rules);
    if (result && (!best || isBetter(result, best, rules))) best = result;
  }
  if (!best) return { ok: false, error: 'No yaku' };
  return { ok: true, yaku: best.yaku, han: best.han, fu: best.fu, yakuman: best.yakuman };
}

// ---------- Input ----------

function normalize(input) {
  const concealed = input.concealed.map(parseTile);
  const win = parseTile(input.winTile);
  const melds = (input.melds ?? []).map((meld) => {
    const parsed = meld.tiles.map(parseTile);
    return { type: meld.type, tiles: parsed, index: Math.min(...parsed.map((t) => t.index)) };
  });
  const flags = {};
  for (const flag of ['tsumo', 'riichi', 'doubleRiichi', 'ippatsu', 'haitei', 'houtei', 'rinshan', 'chankan', 'tenhou', 'chihou']) {
    flags[flag] = Boolean(input[flag]);
  }
  return {
    concealed,
    win,
    melds,
    ...flags,
    seatWind: EAST + (input.seatWind ?? 0),
    roundWind: EAST + (input.roundWind ?? 0),
    isDealer: (input.seatWind ?? 0) === 0,
    isClosed: melds.every((meld) => meld.type === 'ankan'),
    doraIndicators: (input.doraIndicators ?? []).map(parseTile),
    uraIndicators: (input.uraIndicators ?? []).map(parseTile),
    nukiDora: input.nukiDora ?? 0,
  };
}

function validate(hand, rules) {
  if (hand.concealed.length !== 13 - 3 * hand.melds.length) {
    return `Expected ${13 - 3 * hand.melds.length} tiles in hand plus the winning tile`;
  }
  for (const meld of hand.melds) {
    const error = validateMeld(meld);
    if (error) return error;
  }

  const allTiles = [
    ...hand.concealed, hand.win, ...hand.melds.flatMap((meld) => meld.tiles),
    ...hand.doraIndicators, ...hand.uraIndicators,
  ];
  const counts = new Array(34).fill(0);
  const redCounts = [0, 0, 0];
  for (const tile of allTiles) {
    counts[tile.index]++;
    if (tile.red) redCounts[suitOf(tile.index)]++;
  }
  counts[NORTH] += hand.nukiDora;
  if (counts.some((count) => count > 4)) return 'More than 4 of the same tile';
  if (redCounts.some((count) => count > 1)) return 'More than 1 red five of the same suit';
  if (rules.players === 3 && counts.some((count, index) => count > 0 && isRemovedIn3p(index))) {
    return '2m-8m are not used in 3-player';
  }
  if (rules.players === 4 && hand.nukiDora > 0) return 'Nuki-dora is only used in 3-player';
  if (hand.seatWind === NORTH && rules.players === 3) return 'There is no North seat in 3-player';

  if (hand.riichi && hand.doubleRiichi) return 'Choose riichi or double riichi, not both';
  const inRiichi = hand.riichi || hand.doubleRiichi;
  if (inRiichi && !hand.isClosed) return 'Riichi needs a closed hand';
  if (hand.ippatsu && !inRiichi) return 'Ippatsu needs riichi';
  if (hand.uraIndicators.length > 0 && !inRiichi) return 'Ura dora needs riichi';
  if (hand.haitei && !hand.tsumo) return 'Haitei needs tsumo';
  if (hand.houtei && hand.tsumo) return 'Houtei needs ron';
  if (hand.rinshan && !hand.tsumo) return 'Rinshan needs tsumo';
  if (hand.rinshan && !hand.melds.some((meld) => meld.type.endsWith('kan'))) return 'Rinshan needs a kan';
  if (hand.chankan && hand.tsumo) return 'Chankan needs ron';
  if ((hand.tenhou || hand.chihou) && (!hand.tsumo || hand.melds.length > 0)) return 'Tenhou and chihou need a tsumo with no calls';
  if (hand.tenhou && !hand.isDealer) return 'Tenhou is only for the dealer';
  if (hand.chihou && hand.isDealer) return 'Chihou is only for non-dealers';
  return null;
}

function validateMeld(meld) {
  const indexes = meld.tiles.map((t) => t.index).sort((a, b) => a - b);
  const same = indexes.every((index) => index === indexes[0]);
  if (meld.type === 'chi') {
    const ok = indexes.length === 3 && !isHonor(indexes[0]) && suitOf(indexes[0]) === suitOf(indexes[2])
      && indexes[1] === indexes[0] + 1 && indexes[2] === indexes[0] + 2;
    return ok ? null : 'A chi must be 3 tiles in a row';
  }
  if (meld.type === 'pon') return indexes.length === 3 && same ? null : 'A pon must be 3 of the same tile';
  if (meld.type === 'minkan' || meld.type === 'ankan') return indexes.length === 4 && same ? null : 'A kan must be 4 of the same tile';
  return `Unknown meld type: ${meld.type}`;
}

// ---------- Readings ----------
// A reading is one way to split the hand into groups, plus which group the winning tile completed.
// Standard groups: { kind: 'seq' | 'trip' | 'kan' | 'pair', index, called, concealed }
//   called:    true if the group was called from another player (the hand is open)
//   concealed: true if the group counts as concealed for fu and sanankou

function findReadings(hand) {
  const counts = new Array(34).fill(0);
  for (const tile of [...hand.concealed, hand.win]) counts[tile.index]++;
  const winIndex = hand.win.index;
  const readings = [];

  const meldGroups = hand.melds.map((meld) => ({
    kind: meld.type === 'chi' ? 'seq' : meld.type === 'pon' ? 'trip' : 'kan',
    index: meld.index,
    called: meld.type !== 'ankan',
    concealed: meld.type === 'ankan',
  }));

  if (hand.melds.length === 0) {
    if (isSevenPairs(counts)) readings.push({ form: 'chiitoi', counts });
    if (isKokushi(counts)) readings.push({ form: 'kokushi', counts });
  }

  for (const split of splitIntoGroups(counts)) {
    const seen = new Set();
    split.forEach((group, position) => {
      if (!groupContains(group, winIndex)) return;
      const wait = waitType(group, winIndex);
      // Identical groups give identical readings; only try each once.
      const key = `${group.kind}${group.index}${wait}`;
      if (seen.has(key)) return;
      seen.add(key);

      const groups = split.map((g, i) => {
        // A triplet completed by ron counts as open for fu and sanankou.
        const concealed = !(i === position && g.kind === 'trip' && !hand.tsumo);
        return { ...g, called: false, concealed };
      });
      readings.push({ form: 'standard', groups: [...groups, ...meldGroups], wait, counts });
    });
  }
  return readings;
}

function isSevenPairs(counts) {
  return counts.filter((count) => count === 2).length === 7;
}

function isKokushi(counts) {
  return KOKUSHI_TILES.every((index) => counts[index] >= 1)
    && KOKUSHI_TILES.reduce((sum, index) => sum + counts[index], 0) === 14;
}

// Every way to split the concealed tiles into one pair plus sets.
function splitIntoGroups(counts) {
  const results = [];
  for (let pairIndex = 0; pairIndex < 34; pairIndex++) {
    if (counts[pairIndex] < 2) continue;
    const rest = [...counts];
    rest[pairIndex] -= 2;
    for (const sets of splitIntoSets(rest)) {
      results.push([{ kind: 'pair', index: pairIndex }, ...sets]);
    }
  }
  return results;
}

function splitIntoSets(counts) {
  const first = counts.findIndex((count) => count > 0);
  if (first === -1) return [[]];
  const results = [];
  if (counts[first] >= 3) {
    const rest = [...counts];
    rest[first] -= 3;
    for (const sets of splitIntoSets(rest)) results.push([{ kind: 'trip', index: first }, ...sets]);
  }
  if (!isHonor(first) && first % 9 <= 6 && counts[first + 1] > 0 && counts[first + 2] > 0) {
    const rest = [...counts];
    rest[first]--;
    rest[first + 1]--;
    rest[first + 2]--;
    for (const sets of splitIntoSets(rest)) results.push([{ kind: 'seq', index: first }, ...sets]);
  }
  return results;
}

function groupContains(group, index) {
  if (group.kind === 'seq') return index >= group.index && index <= group.index + 2;
  return group.index === index;
}

function waitType(group, winIndex) {
  if (group.kind === 'pair') return 'tanki';
  if (group.kind === 'trip') return 'shanpon';
  const position = winIndex - group.index;
  if (position === 1) return 'kanchan';
  const number = group.index % 9; // 0 means the sequence starts at 1
  if ((position === 2 && number === 0) || (position === 0 && number === 6)) return 'penchan';
  return 'ryanmen';
}

// ---------- Scoring one reading ----------

function scoreReading(reading, hand, rules) {
  const yakuman = findYakuman(reading, hand);
  if (yakuman.length > 0) {
    const count = yakuman.reduce((sum, y) => sum + y.count, 0);
    return {
      yaku: yakuman.map((y) => ({ name: y.name, han: 13 * y.count })),
      han: 0, fu: 0, yakuman: count,
    };
  }

  const yaku = findYaku(reading, hand);
  if (yaku.length === 0) return null;
  const fu = calculateFu(reading, hand, yaku);
  const dora = countDora(reading, hand, rules);
  const all = [...yaku, ...dora];
  const han = all.reduce((sum, y) => sum + y.han, 0);
  return { yaku: all, han, fu, yakuman: 0 };
}

function isBetter(a, b, rules) {
  const baseA = basePoints(a, rules);
  const baseB = basePoints(b, rules);
  if (baseA !== baseB) return baseA > baseB;
  if (a.han !== b.han) return a.han > b.han;
  return a.fu > b.fu;
}

// All tile kinds in the hand, with kans counted as 4.
function allTileIndexes(reading, hand) {
  const indexes = [...hand.concealed, hand.win].map((t) => t.index);
  for (const meld of hand.melds) indexes.push(...meld.tiles.map((t) => t.index));
  return indexes;
}

function findYakuman(reading, hand) {
  const found = [];
  const add = (name, count = 1) => found.push({ name, count });
  const indexes = allTileIndexes(reading, hand);

  if (hand.tenhou) add('Tenhou');
  if (hand.chihou) add('Chihou');

  if (reading.form === 'kokushi') {
    const thirteenWait = reading.counts[hand.win.index] === 2;
    add(thirteenWait ? 'Kokushi Musou 13-Wait' : 'Kokushi Musou', thirteenWait ? 2 : 1);
    return found;
  }

  if (indexes.every(isHonor)) add('Tsuuiisou');
  if (indexes.every((index) => GREEN_TILES.has(index))) add('Ryuuiisou');
  if (indexes.every(isTerminal)) add('Chinroutou');

  if (reading.form === 'standard') {
    const sets = reading.groups.filter((g) => g.kind !== 'pair');
    const pair = reading.groups.find((g) => g.kind === 'pair');
    const setIndexes = sets.filter((g) => g.kind !== 'seq').map((g) => g.index);

    const concealedSets = sets.filter((g) => g.kind !== 'seq' && g.concealed).length;
    if (concealedSets === 4) {
      const tanki = reading.wait === 'tanki';
      add(tanki ? 'Suuankou Tanki' : 'Suuankou', tanki ? 2 : 1);
    }

    const dragonSets = setIndexes.filter(isDragon).length;
    if (dragonSets === 3) add('Daisangen');

    const windSets = setIndexes.filter(isWind).length;
    if (windSets === 4) add('Daisuushii', 2);
    else if (windSets === 3 && isWind(pair.index)) add('Shousuushii');

    if (sets.filter((g) => g.kind === 'kan').length === 4) add('Suukantsu');

    const chuuren = chuurenType(reading.counts, hand);
    if (chuuren === 'junsei') add('Junsei Chuuren Poutou', 2);
    else if (chuuren === 'normal') add('Chuuren Poutou');
  }
  return found;
}

function chuurenType(counts, hand) {
  if (hand.melds.length > 0) return null;
  const suit = suitOf(hand.win.index);
  if (suit === 3) return null;
  const start = suit * 9;
  const inSuit = counts.slice(start, start + 9);
  if (inSuit.reduce((a, b) => a + b, 0) !== 14) return null;
  const pattern = [3, 1, 1, 1, 1, 1, 1, 1, 3];
  if (!inSuit.every((count, i) => count >= pattern[i])) return null;
  const withoutWin = [...inSuit];
  withoutWin[hand.win.index - start]--;
  return withoutWin.every((count, i) => count === pattern[i]) ? 'junsei' : 'normal';
}

function findYaku(reading, hand) {
  const yaku = [];
  const add = (name, han) => yaku.push({ name, han });
  const closed = hand.isClosed;
  const indexes = allTileIndexes(reading, hand);

  // Yaku from the situation rather than the tiles
  if (hand.doubleRiichi) add('Double Riichi', 2);
  else if (hand.riichi) add('Riichi', 1);
  if (hand.ippatsu) add('Ippatsu', 1);
  if (closed && hand.tsumo) add('Menzen Tsumo', 1);
  if (hand.haitei) add('Haitei', 1);
  if (hand.houtei) add('Houtei', 1);
  if (hand.rinshan) add('Rinshan Kaihou', 1);
  if (hand.chankan) add('Chankan', 1);

  // Yaku from the tiles, for any shape
  if (indexes.every((index) => !isTerminalOrHonor(index))) add('Tanyao', 1);
  const suits = new Set(indexes.filter((index) => !isHonor(index)).map(suitOf));
  const hasHonors = indexes.some(isHonor);
  if (suits.size === 1 && !hasHonors) add('Chinitsu', closed ? 6 : 5);
  if (suits.size === 1 && hasHonors) add('Honitsu', closed ? 3 : 2);
  const allTerminalOrHonor = indexes.every(isTerminalOrHonor);
  if (allTerminalOrHonor) add('Honroutou', 2);

  if (reading.form === 'chiitoi') {
    add('Chiitoitsu', 2);
    return yaku;
  }

  const groups = reading.groups;
  const sets = groups.filter((g) => g.kind !== 'pair');
  const pair = groups.find((g) => g.kind === 'pair');
  const sequences = sets.filter((g) => g.kind === 'seq');
  const triplets = sets.filter((g) => g.kind !== 'seq');

  // Pinfu: closed, all sequences, a pair worth no fu, and a two-sided wait
  if (closed && sequences.length === 4 && pairFu(pair.index, hand) === 0 && reading.wait === 'ryanmen') add('Pinfu', 1);

  // Iipeikou / Ryanpeikou (closed only)
  if (closed) {
    const seqCounts = {};
    for (const s of sequences) seqCounts[s.index] = (seqCounts[s.index] ?? 0) + 1;
    const identicalPairs = Object.values(seqCounts).reduce((sum, count) => sum + Math.floor(count / 2), 0);
    if (identicalPairs === 2) add('Ryanpeikou', 3);
    else if (identicalPairs === 1) add('Iipeikou', 1);
  }

  // Yakuhai
  for (const t of triplets) {
    if (isDragon(t.index)) add(`Yakuhai: ${honorName(t.index)}`, 1);
    if (t.index === hand.seatWind) add(`Seat Wind: ${honorName(t.index)}`, 1);
    if (t.index === hand.roundWind) add(`Round Wind: ${honorName(t.index)}`, 1);
  }

  // Chanta / Junchan: every group has a terminal or honor, with at least one sequence
  const groupHasTerminalOrHonor = (g) => (g.kind === 'seq' ? g.index % 9 === 0 || g.index % 9 === 6 : isTerminalOrHonor(g.index));
  if (sequences.length > 0 && groups.every(groupHasTerminalOrHonor)) {
    if (hasHonors) add('Chanta', closed ? 2 : 1);
    else add('Junchan', closed ? 3 : 2);
  }

  // Ittsu: 123, 456, 789 in one suit
  for (let suit = 0; suit < 3; suit++) {
    const starts = new Set(sequences.filter((s) => suitOf(s.index) === suit).map((s) => s.index % 9));
    if (starts.has(0) && starts.has(3) && starts.has(6)) add('Ittsu', closed ? 2 : 1);
  }

  // Sanshoku doujun / doukou: the same sequence or triplet in all three suits
  for (let number = 0; number < 9; number++) {
    const hasIn = (list, suit) => list.some((g) => g.index === suit * 9 + number);
    if ([0, 1, 2].every((suit) => hasIn(sequences, suit))) add('Sanshoku Doujun', closed ? 2 : 1);
    if ([0, 1, 2].every((suit) => hasIn(triplets, suit))) add('Sanshoku Doukou', 2);
  }

  if (triplets.length === 4) add('Toitoi', 2);
  if (triplets.filter((t) => t.concealed).length === 3) add('Sanankou', 2);
  if (sets.filter((g) => g.kind === 'kan').length === 3) add('Sankantsu', 2);
  if (triplets.filter((t) => isDragon(t.index)).length === 2 && isDragon(pair.index)) add('Shousangen', 2);

  return yaku;
}

// ---------- Fu ----------

// Fu for the pair. A double wind pair is worth 2 fu, as in M-League.
function pairFu(index, hand) {
  if (isDragon(index)) return 2;
  if (index === hand.seatWind || index === hand.roundWind) return 2;
  return 0;
}

function calculateFu(reading, hand, yaku) {
  if (reading.form === 'chiitoi') return 25;
  const isPinfu = yaku.some((y) => y.name === 'Pinfu');
  if (isPinfu) return hand.tsumo ? 20 : 30;

  let fu = 20;
  if (hand.isClosed && !hand.tsumo) fu += 10;
  if (hand.tsumo) fu += 2;

  for (const group of reading.groups) {
    if (group.kind === 'pair') {
      fu += pairFu(group.index, hand);
    } else if (group.kind !== 'seq') {
      let setFu = isTerminalOrHonor(group.index) ? 4 : 2;
      if (group.concealed) setFu *= 2;
      if (group.kind === 'kan') setFu *= 4;
      fu += setFu;
    }
  }
  if (['kanchan', 'penchan', 'tanki'].includes(reading.wait)) fu += 2;

  // An open hand with no fu at all is rounded up to 30.
  if (!hand.isClosed && fu === 20) return 30;
  return Math.ceil(fu / 10) * 10;
}

// ---------- Dora ----------

function countDora(reading, hand, rules) {
  const indexes = allTileIndexes(reading, hand);
  const countMatching = (indicators) => indicators.reduce((sum, indicator) => {
    const dora = doraFromIndicator(indicator.index, rules.players);
    const inHand = indexes.filter((index) => index === dora).length;
    const inNuki = dora === NORTH ? hand.nukiDora : 0;
    return sum + inHand + inNuki;
  }, 0);

  const result = [];
  const dora = countMatching(hand.doraIndicators);
  if (dora > 0) result.push({ name: 'Dora', han: dora });
  const red = [...hand.concealed, hand.win, ...hand.melds.flatMap((m) => m.tiles)].filter((t) => t.red).length;
  if (red > 0) result.push({ name: 'Aka Dora', han: red });
  if (hand.riichi || hand.doubleRiichi) {
    const ura = countMatching(hand.uraIndicators);
    if (ura > 0) result.push({ name: 'Ura Dora', han: ura });
  }
  if (hand.nukiDora > 0) result.push({ name: 'Nuki Dora', han: hand.nukiDora });
  return result;
}
