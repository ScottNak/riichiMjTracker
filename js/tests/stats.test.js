import { test, assertEqual } from './runner.js';
import { defaultRules, newGame, saveRound } from '../game.js';
import { filterGames, playerStats, opponentStats } from '../stats.js';

const game4 = (date = '2026-01-01', length = 'south') => newGame({ players: ['A', 'B', 'C', 'D'], rules: { ...defaultRules(4), length }, date });
const play = (game, rounds) => rounds.reduce((g, round) => saveRound(g, round), game);
const ended = (game) => ({ ...game, endedBy: 'manual' });
const find = (list, name) => list.find((s) => s.name === name);

// Draw with B in riichi, D rons A with 1 honba and 1 stick, dealer C chombos, B tsumos in riichi.
// Final scores: A 26,400 (3rd), B 32,100 (1st), C 11,500 (4th), D 30,000 (2nd).
const sample = () => ended(play(game4(), [
  { outcome: 'draw', tenpai: [false, true, false, false], riichi: [1] },
  { outcome: 'ron', winner: 3, loser: 0, han: 1, fu: 30, riichi: [] },
  { outcome: 'chombo', offender: 2 },
  { outcome: 'tsumo', winner: 1, han: 1, fu: 30, riichi: [1] },
]));

test('stats: placements, points, and raw points', () => {
  const b = find(playerStats([sample()]), 'B');
  assertEqual([b.games, b.places, b.points, b.raw, b.avgPlace, b.firstRate], [1, [1, 0, 0, 0], 52.1, 7100, 1, 1]);
});

test('stats: chombo is not a hand, and is counted for the offender', () => {
  const stats = playerStats([sample()]);
  assertEqual(stats.map((s) => s.hands), [3, 3, 3, 3]);
  assertEqual(find(stats, 'C').chombo, 1);
});

test('stats: wins and riichi per hand, tsumo as a share of wins', () => {
  const b = find(playerStats([sample()]), 'B');
  assertEqual([b.wins, b.tsumo, b.riichi, b.winRate, b.riichiRate, b.tsumoRate], [1, 1, 2, 1 / 3, 2 / 3, 1]);
  assertEqual(find(playerStats([sample()]), 'D').tsumoRate, 0);
});

test('stats: win value by hand, with honba, and with sticks', () => {
  const d = find(playerStats([sample()]), 'D');
  assertEqual([d.avgWinHand, d.avgWinHonba, d.avgWinAll, d.best.points], [1000, 1300, 2300, 1300]);
});

test('stats: deal-in counts what the discarder paid, honba included', () => {
  const a = find(playerStats([sample()]), 'A');
  assertEqual([a.dealIns, a.dealInRate, a.avgDealIn], [1, 1 / 3, 1300]);
});

test('stats: pao on a ron is a deal-in for both payers', () => {
  const game = ended(play(game4(), [{ outcome: 'ron', winner: 1, loser: 2, han: 0, fu: 0, yakuman: 1, pao: { seat: 3, yakuman: 1 }, riichi: [] }]));
  const stats = playerStats([game]);
  assertEqual([find(stats, 'C').dealIns, find(stats, 'C').dealInPaid, find(stats, 'D').dealIns, find(stats, 'D').dealInPaid], [1, 16000, 1, 16000]);
});

test('stats: nagashi mangan is a tsumo win', () => {
  const game = ended(play(game4(), [{ outcome: 'nagashi', seat: 2, riichi: [] }]));
  const c = find(playerStats([game]), 'C');
  assertEqual([c.wins, c.tsumo, c.avgWinHonba], [1, 1, 8000]);
});

test('stats: bust counts only players who end below 0', () => {
  const game = play(game4(), [{ outcome: 'ron', winner: 0, loser: 1, han: 13, fu: 0, riichi: [] }]);
  const stats = playerStats([game]);
  assertEqual(stats.map((s) => s.busts), [0, 1, 0, 0]);
});

test('opponents: games together, finished above, deal-ins, and points exchanged', () => {
  const vs = opponentStats([sample()], 'A');
  assertEqual(find(vs, 'D'), { name: 'D', together: 1, above: 0, fedThem: 1, fedThemPoints: 1300, theyFed: 0, theyFedPoints: 0, net: -1300 });
  assertEqual([find(vs, 'B').net, find(vs, 'C').net, find(vs, 'C').above], [-300, 4000, 1]);
  assertEqual(find(opponentStats([sample()], 'D'), 'A').theyFed, 1);
});

test('filters: player count, length, dates, and finished games only', () => {
  const games = [
    sample(),
    ended(play(game4('2026-03-01', 'east'), [{ outcome: 'abortive', kind: 'kyuushu', riichi: [] }])),
    play(game4('2026-02-01'), [{ outcome: 'abortive', kind: 'kyuushu', riichi: [] }]), // in progress
  ];
  const ids = (filters) => filterGames(games, { players: 4, length: 'all', from: '', to: '', ...filters }).map((g) => g.date);
  assertEqual(ids({}), ['2026-01-01', '2026-03-01']);
  assertEqual(ids({ length: 'east' }), ['2026-03-01']);
  assertEqual(ids({ from: '2026-02-01' }), ['2026-03-01']);
  assertEqual(ids({ to: '2026-02-01' }), ['2026-01-01']);
  assertEqual(ids({ players: 3 }), []);
});
