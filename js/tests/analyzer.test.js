import { test, assertEqual } from './runner.js';
import { analyzeHand } from '../analyzer.js';
import { tiles, parseTile, doraFromIndicator } from '../tiles.js';
import { RULES_4P, RULES_3P } from '../scoring.js';

// Defaults: South seat (non-dealer), East round, ron.
function analyze(concealed, winTile, options = {}, rules = RULES_4P) {
  return analyzeHand({ concealed: tiles(concealed), winTile, seatWind: 1, roundWind: 0, ...options }, rules);
}
const yakuNames = (result) => result.yaku.map((y) => y.name);
const summary = (result) => (result.ok ? { han: result.han, fu: result.fu, yaku: yakuNames(result) } : result.error);

// --- Tiles ---

test('tile notation', () => {
  assertEqual(tiles('123m0p77z'), ['1m', '2m', '3m', '0p', '7z', '7z']);
  assertEqual(parseTile('0s'), { index: 22, red: true });
  assertEqual(parseTile('7z'), { index: 33, red: false });
});

test('dora indicators wrap around', () => {
  const next = (text, players = 4) => doraFromIndicator(parseTile(text).index, players);
  assertEqual([next('9m'), next('4z'), next('7z'), next('3p')], [0, 27, 31, 12]);
});

test('3-player dora: 1m indicates 9m and 9m indicates 1m', () => {
  assertEqual([doraFromIndicator(0, 3), doraFromIndicator(8, 3)], [8, 0]);
});

// --- Basic hands and fu ---

test('riichi pinfu tsumo: 20 fu', () => {
  assertEqual(summary(analyze('123m456p789s23s99p', '4s', { tsumo: true, riichi: true })),
    { han: 3, fu: 20, yaku: ['Riichi', 'Menzen Tsumo', 'Pinfu'] });
});

test('riichi pinfu ron: 30 fu', () => {
  assertEqual(summary(analyze('123m456p789s23s99p', '4s', { riichi: true })), { han: 2, fu: 30, yaku: ['Riichi', 'Pinfu'] });
});

test('kanchan wait adds 2 fu and breaks pinfu', () => {
  assertEqual(summary(analyze('123m456p789s24s99p', '3s', { riichi: true })), { han: 1, fu: 40, yaku: ['Riichi'] });
});

test('open tanyao with no fu rounds up to 30', () => {
  const result = analyze('567p678s34s22p', '5s', { melds: [{ type: 'chi', tiles: tiles('234m') }] });
  assertEqual(summary(result), { han: 1, fu: 30, yaku: ['Tanyao'] });
});

test('triplet completed by ron counts as open', () => {
  // Chun triplet by ron: 20 + 10 (closed ron) + 4 (open honor triplet) = 34 -> 40
  assertEqual(summary(analyze('123m456p789s77z55s', '7z')), { han: 1, fu: 40, yaku: ['Yakuhai: Chun'] });
});

test('double wind pair is worth 2 fu (M-League)', () => {
  // Dealer in East round, East pair. 20 + 2 (tsumo) + 4 (555s) + 2 (pair) + 2 (kanchan) = 30. With a 4 fu pair it would be 40.
  const result = analyze('123m456p555s79s11z', '8s', { seatWind: 0, tsumo: true, riichi: true });
  assertEqual(summary(result), { han: 2, fu: 30, yaku: ['Riichi', 'Menzen Tsumo'] });
});

test('closed and open kan fu', () => {
  const result = analyze('123p456s78s55p', '9s', { riichi: true, melds: [{ type: 'ankan', tiles: tiles('9999m') }] });
  // 20 + 10 (closed ron) + 32 (closed terminal kan) = 62 -> 70
  assertEqual(summary(result), { han: 1, fu: 70, yaku: ['Riichi'] });
});

// --- Yaku ---

test('chiitoitsu: 25 fu', () => {
  assertEqual(summary(analyze('1122m3344p5566s7z', '7z')), { han: 2, fu: 25, yaku: ['Chiitoitsu'] });
});

test('ryanpeikou beats chiitoitsu', () => {
  assertEqual(summary(analyze('112233m445566p7z', '7z')), { han: 3, fu: 40, yaku: ['Ryanpeikou'] });
});

test('open honitsu, ittsu, and yakuhai', () => {
  const result = analyze('123m456m789m1z', '1z', { melds: [{ type: 'pon', tiles: tiles('555z') }] });
  // 20 + 4 (open haku) + 2 (East pair, round wind) + 2 (tanki) = 28 -> 30
  assertEqual(summary(result), { han: 4, fu: 30, yaku: ['Honitsu', 'Yakuhai: Haku', 'Ittsu'] });
});

test('seat and round wind triplet count separately', () => {
  const result = analyze('111z234m567p8s', '8s', { seatWind: 0, melds: [{ type: 'chi', tiles: tiles('678s') }] });
  assertEqual(yakuNames(result), ['Seat Wind: East', 'Round Wind: East']);
});

test('junchan, read as a two-sided wait for pinfu', () => {
  // 78s + 99s waiting on 9s: reading it as 78s-9s (two-sided) adds pinfu and scores higher than a pair wait.
  assertEqual(summary(analyze('123m789m123p789s9s', '9s')), { han: 4, fu: 30, yaku: ['Pinfu', 'Junchan'] });
});

test('open sanshoku doujun is 1 han', () => {
  const result = analyze('123m123s456p9m', '9m', { melds: [{ type: 'chi', tiles: tiles('123p') }] });
  assertEqual(summary(result), { han: 1, fu: 30, yaku: ['Sanshoku Doujun'] });
});

test('chooses the highest-scoring reading: sanankou over iipeikou', () => {
  // 111222333m can be three triplets or three 123m sequences.
  assertEqual(summary(analyze('111222333m456p5s', '5s', { tsumo: true })),
    { han: 3, fu: 40, yaku: ['Menzen Tsumo', 'Sanankou'] });
});

test('toitoi and sanankou by ron on a shanpon', () => {
  // The 5z triplet was completed by ron, so only three triplets are concealed.
  assertEqual(summary(analyze('111m222p333s44z55z', '5z')),
    { han: 5, fu: 50, yaku: ['Yakuhai: Haku', 'Toitoi', 'Sanankou'] });
});

test('situational yaku', () => {
  const result = analyze('123m456p789s23s99p', '4s', { tsumo: true, doubleRiichi: true, ippatsu: true, haitei: true });
  assertEqual(yakuNames(result), ['Double Riichi', 'Ippatsu', 'Menzen Tsumo', 'Haitei', 'Pinfu']);
});

test('shousangen', () => {
  // 20 + 10 + 8 + 8 (concealed dragon triplets) + 2 (dragon pair) + 2 (tanki) = 50
  assertEqual(summary(analyze('555666z7z123m456p', '7z')),
    { han: 4, fu: 50, yaku: ['Yakuhai: Haku', 'Yakuhai: Hatsu', 'Shousangen'] });
});

test('honroutou with toitoi', () => {
  assertEqual(summary(analyze('111m999p111s11z99s', '1z')),
    { han: 7, fu: 60, yaku: ['Honroutou', 'Round Wind: East', 'Toitoi', 'Sanankou'] });
});

test('rinshan kaihou after an open kan', () => {
  const result = analyze('123p456s78s99p', '9s', { tsumo: true, rinshan: true, melds: [{ type: 'minkan', tiles: tiles('5555m') }] });
  assertEqual(summary(result), { han: 1, fu: 30, yaku: ['Rinshan Kaihou'] });
});

test('3-player: a North triplet kept in hand is not a value tile', () => {
  assertEqual(summary(analyze('444z123p456p789s5s', '5s', { riichi: true }, RULES_3P)), { han: 1, fu: 40, yaku: ['Riichi'] });
});

// --- Yakuman ---

test('kokushi musou: single wait and 13-wait', () => {
  const single = analyze('19m19p19s123456z1m', '7z');
  assertEqual([single.yakuman, yakuNames(single)], [1, ['Kokushi Musou']]);
  const thirteen = analyze('19m19p19s1234567z', '1m');
  assertEqual([thirteen.yakuman, yakuNames(thirteen)], [2, ['Kokushi Musou 13-Wait']]);
});

test('suuankou by tsumo, suuankou tanki by ron', () => {
  assertEqual(analyze('111m222p333s44z55z', '5z', { tsumo: true }).yakuman, 1);
  const tanki = analyze('111m222p333s555z4z', '4z');
  assertEqual([tanki.yakuman, yakuNames(tanki)], [2, ['Suuankou Tanki']]);
});

test('daisangen', () => {
  const result = analyze('555666777z11m23p', '1p');
  assertEqual([result.yakuman, yakuNames(result)], [1, ['Daisangen']]);
});

test('daisuushii is a double yakuman', () => {
  const result = analyze('222333444z5p', '5p', { melds: [{ type: 'pon', tiles: tiles('111z') }] });
  assertEqual([result.yakuman, yakuNames(result)], [2, ['Daisuushii']]);
});

test('chuuren poutou and junsei chuuren poutou', () => {
  const junsei = analyze('1112345678999m', '5m');
  assertEqual([junsei.yakuman, yakuNames(junsei)], [2, ['Junsei Chuuren Poutou']]);
  const normal = analyze('1113345678999m', '2m');
  assertEqual([normal.yakuman, yakuNames(normal)], [1, ['Chuuren Poutou']]);
});

test('tsuuiisou as seven pairs', () => {
  assertEqual(yakuNames(analyze('1122334455667z', '7z')), ['Tsuuiisou']);
});

test('ryuuiisou', () => {
  assertEqual(yakuNames(analyze('223344s666s888s6z', '6z')), ['Ryuuiisou']);
});

test('tenhou', () => {
  const result = analyze('123m456p789s23s99p', '4s', { seatWind: 0, tsumo: true, tenhou: true });
  assertEqual([result.yakuman, yakuNames(result)], [1, ['Tenhou']]);
});

// --- Dora ---

test('dora, red fives, and ura dora', () => {
  const result = analyze('123m406p789s23s99p', '4s', { riichi: true, doraIndicators: ['3p'], uraIndicators: ['8s'] });
  assertEqual(summary(result), { han: 5, fu: 30, yaku: ['Riichi', 'Pinfu', 'Dora', 'Aka Dora', 'Ura Dora'] });
});

test('dora without a yaku is not a win', () => {
  assertEqual(analyze('456p789s23s99p', '4s', { melds: [{ type: 'chi', tiles: tiles('123m') }], doraIndicators: ['8s'] }).error, 'No yaku');
});

test('3-player: nuki dora, and North indicated by West', () => {
  const result = analyze('99m123p456p789s23s', '4s', { riichi: true, doraIndicators: ['1m', '3z'], nukiDora: 2 }, RULES_3P);
  // Dora: 9m x2 (indicator 1m) + 2 pulled Norths (indicator West); plus 2 nuki dora
  assertEqual(summary(result), { han: 8, fu: 30, yaku: ['Riichi', 'Pinfu', 'Dora', 'Nuki Dora'] });
  assertEqual(result.yaku.find((y) => y.name === 'Dora').han, 4);
});

// --- Invalid input ---

test('invalid hands give a clear error', () => {
  assertEqual(analyze('123m456p789s23s99p', '7s').error, 'Not a complete hand');
  assertEqual(analyze('11111m456p789s23s', '4s').error, 'More than 4 of the same tile');
  assertEqual(analyze('123m456p789s23s9p', '4s').error, 'Expected 13 tiles in hand plus the winning tile');
  assertEqual(analyze('123m456p789s23s99p', '4s', { ippatsu: true }).error, 'Ippatsu needs riichi');
  assertEqual(analyze('123m456p789s23s99p', '4s', { haitei: true }).error, 'Haitei needs tsumo');
  assertEqual(analyze('234m456p789s23s99p', '4s', {}, RULES_3P).error, '2m-8m are not used in 3-player');
  assertEqual(analyze('123m406p789s23s09p', '4s').error, 'More than 1 red five of the same suit');
});
