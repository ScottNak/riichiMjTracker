import { test, assertEqual } from './runner.js';
import { HAND_ERRORS, activeMode, completesHand, emptyHand, pick, canPick, removeIndicator, dropPosition, setWinTile, isFull, handDisplay, toggleMeldRed, canAddNuki, analyze, analyzerInput, availableToggles, paoYakuman, toStored, fromStored } from '../hand.js';
import { tiles } from '../tiles.js';
import { RULES_4P, RULES_3P } from '../scoring.js';
import { TEXT } from '../text.js';
import { ANALYZER_ERRORS } from '../analyzer.js';

// Taps each tile of a notation string in Hand mode.
function tapIn(hand, notation, players = 4) {
  for (const text of tiles(notation)) pick(hand, 'hand', text, players, false);
  return hand;
}
const ron = { riichi: false, tsumo: false, seatWind: 1, roundWind: 0 };

test('hand: the last tile tapped is the winning tile', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s99p4s');
  assertEqual(isFull(hand), true);
  const display = handDisplay(hand);
  assertEqual(display.win.text, '4s');
  assertEqual(analyzerInput(hand, ron).winTile, '4s');
  assertEqual(display.tiles.map((t) => t.text).join(''), '1m2m3m4p5p6p9p9p2s3s7s8s9s');
});

test('hand: no more taps once full', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s99p4s');
  assertEqual(canPick(hand, 'hand', '1z', 4, false), false);
});

test('picker limits: 4 of a tile, 3 regular fives, 1 red five', () => {
  const hand = tapIn(emptyHand(), '1111m555p0p');
  assertEqual(canPick(hand, 'hand', '1m', 4, false), false);
  assertEqual(canPick(hand, 'hand', '5p', 4, false), false);
  assertEqual(canPick(hand, 'hand', '0p', 4, false), false);
  assertEqual(canPick(hand, 'dora', '1m', 4, false), false);
  assertEqual(canPick(hand, 'hand', '0s', 4, false), true);
});

test('picker: 3-player has no 2m-8m, and nuki counts toward the 4 Norths', () => {
  const hand = emptyHand();
  assertEqual(canPick(hand, 'hand', '5m', 3, false), false);
  assertEqual(canPick(hand, 'hand', '9m', 3, false), true);
  tapIn(hand, '444z', 3);
  hand.nuki = 1;
  assertEqual(canAddNuki(hand, 3), false);
  assertEqual(canAddNuki(emptyHand(), 4), false);
});

test('ura needs riichi, and no more ura than dora', () => {
  const hand = emptyHand();
  assertEqual(canPick(hand, 'ura', '1m', 4, true), false);
  pick(hand, 'dora', '2m', 4, false);
  assertEqual(canPick(hand, 'ura', '1m', 4, false), false);
  assertEqual(canPick(hand, 'ura', '1m', 4, true), true);
  pick(hand, 'ura', '1m', 4, true);
  assertEqual(canPick(hand, 'ura', '3m', 4, true), false);
});

test('at most 4 dora indicators; a removed one leaves a placeholder the next tap fills', () => {
  const hand = emptyHand();
  for (const text of ['1m', '2m', '3m', '4m']) pick(hand, 'dora', text, 4, false);
  assertEqual(canPick(hand, 'dora', '5m', 4, false), false);
  for (const text of ['1p', '2p', '3p', '4p']) pick(hand, 'ura', text, 4, true);
  removeIndicator(hand, 'dora', 1);
  assertEqual([hand.dora, hand.ura], [['1m', null, '3m', '4m'], ['1p', '2p', '3p', '4p']]);
  assertEqual(activeMode(tapIn(hand, '123m456p789s23s99p4s'), 'hand', true), 'dora');
  pick(hand, 'dora', '5m', 4, false);
  assertEqual(hand.dora[1], '5m');
  removeIndicator(hand, 'ura', 0);
  assertEqual(activeMode(hand, 'hand', true), 'ura');
  pick(hand, 'ura', '6m', 4, true);
  assertEqual(hand.ura, ['6m', '2p', '3p', '4p']);
});

test('a placeholder stays until filled; tapping it drops the position', () => {
  const hand = emptyHand();
  pick(hand, 'dora', '1m', 4, false);
  pick(hand, 'dora', '2m', 4, false);
  pick(hand, 'ura', '3m', 4, true);
  removeIndicator(hand, 'dora', 1);
  assertEqual([hand.dora, hand.ura], [['1m', null], ['3m']]);
  dropPosition(hand, 1);
  assertEqual([hand.dora, hand.ura], [['1m'], ['3m']]);
  removeIndicator(hand, 'ura', 0);
  dropPosition(hand, 0);
  assertEqual([hand.dora, hand.ura], [[], []]);
});

test('holding a tile makes it the winning tile once the hand is full', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s99p4s');
  setWinTile(hand, 0);
  assertEqual(handDisplay(hand).win.text, '1m');
  const partial = tapIn(emptyHand(), '123m');
  setWinTile(partial, 0);
  assertEqual(partial.tiles, ['1m', '2m', '3m']);
});

test('melds: one tap places the meld and goes back to Hand', () => {
  const hand = emptyHand();
  assertEqual(pick(hand, 'chi', '3p', 4, false), 'hand');
  assertEqual(hand.melds, [{ type: 'chi', tiles: ['3p', '4p', '5p'] }]);
  assertEqual(canPick(hand, 'chi', '8p', 4, false), false);
  assertEqual(canPick(hand, 'chi', '1z', 4, false), false);
  pick(hand, 'kan', '5s', 4, false);
  assertEqual(hand.melds[1], { type: 'minkan', tiles: ['0s', '5s', '5s', '5s'] });
  pick(hand, 'ankan', '7z', 4, false);
  assertEqual(hand.melds[2].type, 'ankan');
  assertEqual(hand.tiles.length, 0);
});

test('melds: no room once the hand has too many tiles', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s9p');
  assertEqual(canPick(hand, 'pon', '1z', 4, false), false);
});

test('melds: a 5 in a meld switches between red and regular', () => {
  const hand = emptyHand();
  pick(hand, 'pon', '5p', 4, false);
  toggleMeldRed(hand, 0, 1, 4);
  assertEqual(hand.melds[0].tiles, ['5p', '0p', '5p']);
  toggleMeldRed(hand, 0, 0, 4); // only one red 5p
  assertEqual(hand.melds[0].tiles, ['5p', '0p', '5p']);
  toggleMeldRed(hand, 0, 1, 4);
  assertEqual(hand.melds[0].tiles, ['5p', '5p', '5p']);
  pick(hand, 'kan', '5m', 4, false);
  toggleMeldRed(hand, 1, 0, 4); // a kan of 5s keeps its red five
  assertEqual(hand.melds[1].tiles[0], '0m');
});

test('toggles offered only where they apply', () => {
  const hand = emptyHand();
  assertEqual(availableToggles({ riichi: false, tsumo: false, dealer: false, hand }), ['houtei', 'chankan']);
  assertEqual(availableToggles({ riichi: true, tsumo: true, dealer: true, hand }), ['doubleRiichi', 'ippatsu', 'haitei', 'tenhou']);
});

test('analyzer input leaves out toggles and ura that no longer apply', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s99p4s');
  hand.toggles = ['haitei', 'ippatsu', 'doubleRiichi'];
  hand.ura = ['1m'];
  const input = analyzerInput(hand, ron);
  assertEqual([input.haitei, input.ippatsu, input.riichi, input.uraIndicators], [undefined, undefined, false, []]);
  const riichiTsumo = analyzerInput(hand, { ...ron, riichi: true, tsumo: true });
  assertEqual([riichiTsumo.haitei, riichiTsumo.doubleRiichi, riichiTsumo.riichi, riichiTsumo.uraIndicators], [true, true, false, ['1m']]);
});

test('analyze a tapped-in hand', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s99p4s');
  assertEqual(analyze(emptyHand(), ron, RULES_4P).error, 'tileCount');
  assertEqual(analyze(hand, ron, RULES_4P).error, 'needDora');
  hand.dora = ['1z'];
  assertEqual(analyze(hand, { ...ron, riichi: true }, RULES_4P).error, 'needUra');
  hand.ura = ['1z'];
  const result = analyze(hand, { ...ron, riichi: true }, RULES_4P);
  assertEqual([result.han, result.fu], [2, 30]);
});

test('analyze with melds and nuki-dora in 3-player', () => {
  const hand = emptyHand();
  pick(hand, 'pon', '7z', 3, false);
  tapIn(hand, '123p456p789s9p9p', 3);
  hand.nuki = 1;
  hand.dora = ['1z'];
  const result = analyze(hand, ron, RULES_3P);
  assertEqual(result.yaku.map((y) => y.id), ['yakuhai', 'nukiDora']);
});

test('pao yakuman count', () => {
  const hand = emptyHand();
  pick(hand, 'pon', '5z', 4, false);
  pick(hand, 'pon', '6z', 4, false);
  tapIn(hand, '777z11m222m');
  hand.dora = ['1z'];
  const result = analyze(hand, ron, RULES_4P);
  assertEqual(paoYakuman(result), 1);
});

test('a missing dora, then a missing ura, takes over the picker once the hand is full', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s99p');
  assertEqual(activeMode(hand, 'hand', true), 'hand');
  tapIn(hand, '4s');
  assertEqual(activeMode(hand, 'hand', true), 'dora');
  hand.dora = ['1z', '2z'];
  assertEqual(activeMode(hand, 'hand', false), 'hand');
  assertEqual(activeMode(hand, 'dora', true), 'ura');
  hand.ura = ['3z'];
  assertEqual(analyze(hand, { ...ron, riichi: true }, RULES_4P).error, 'needUra');
  hand.ura = ['3z', '4z'];
  assertEqual(activeMode(hand, 'hand', true), 'hand');
  assertEqual(analyze(hand, { ...ron, riichi: true }, RULES_4P).ok, true);
});

test('with one tile left, only tiles that complete the hand count', () => {
  const hand = tapIn(emptyHand(), '123m456p789s23s99p');
  assertEqual(['1s', '4s', '5s', '9p', '1z'].map((t) => completesHand(hand, t, RULES_4P)), [true, true, false, false, false]);
  const chiitoi = tapIn(emptyHand(), '1133m5577p99s11z2z');
  assertEqual(['2z', '3z'].map((t) => completesHand(chiitoi, t, RULES_4P)), [true, false]);
  assertEqual(completesHand(tapIn(emptyHand(), '123m'), '5z', RULES_4P), true);
});

test('in riichi, chi, pon, and open kan fall back to Hand; closed kan stays', () => {
  const hand = emptyHand();
  assertEqual(['chi', 'pon', 'kan', 'ankan'].map((m) => activeMode(hand, m, true)), ['hand', 'hand', 'hand', 'ankan']);
  assertEqual(activeMode(hand, 'pon', false), 'pon');
});

test('stored hand round trip', () => {
  const hand = emptyHand();
  pick(hand, 'chi', '1m', 4, false);
  tapIn(hand, '456p789s23s99p4s');
  hand.dora = ['3z'];
  hand.toggles = ['houtei'];
  const stored = toStored(hand);
  assertEqual(stored.winTile, '4s');
  assertEqual(fromStored(JSON.parse(JSON.stringify(stored))), hand);
});

test('every analyzer error has a message in all three languages', () => {
  const missing = ['en', 'romaji', 'jp'].flatMap((lang) => [...ANALYZER_ERRORS, ...HAND_ERRORS].filter((id) => !TEXT[lang].handErrors?.[id]).map((id) => `${lang}.${id}`));
  assertEqual(missing, []);
});
