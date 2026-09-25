import { test, assertEqual } from './runner.js';
import { roundLabel } from '../names.js';
import { defaultRules, newGame, saveRound, deleteRound, replay, standings } from '../game.js';

const game4 = (overrides = {}) => newGame({ players: ['A', 'B', 'C', 'D'], rules: { ...defaultRules(4), ...overrides } });
const game3 = (overrides = {}) => newGame({ players: ['A', 'B', 'C'], rules: { ...defaultRules(3), ...overrides } });
const play = (game, rounds) => rounds.reduce((g, round) => saveRound(g, round), game);

const noten4 = { outcome: 'draw', tenpai: [false, false, false, false], riichi: [] };
const summary = (game) => {
  const { state } = replay(game);
  return { hand: state.hand, honba: state.honba, sticks: state.sticks, scores: state.scores };
};

// --- Progression ---

test('non-dealer ron: deal passes, honba resets, winner collects riichi sticks', () => {
  const game = play(game4(), [{ outcome: 'ron', winner: 1, loser: 2, han: 1, fu: 30, riichi: [1, 3] }]);
  assertEqual(game.rounds[0].deltas, [0, 1000 + 2000 - 1000, -1000, -1000]);
  assertEqual(summary(game), { hand: 1, honba: 0, sticks: 0, scores: [25000, 27000, 24000, 24000] });
});

test('dealer tsumo: dealer keeps the deal and honba goes up', () => {
  const game = play(game4(), [{ outcome: 'tsumo', winner: 0, han: 1, fu: 30, riichi: [] }]);
  assertEqual(game.rounds[0].deltas, [1500, -500, -500, -500]);
  assertEqual(summary(game).hand, 0);
  assertEqual(summary(game).honba, 1);
});

test('draw: sticks stay on the table, noten dealer passes the deal, honba goes up', () => {
  const game = play(game4(), [{ outcome: 'draw', tenpai: [false, true, false, false], riichi: [1] }]);
  assertEqual(game.rounds[0].deltas, [-1000, 2000, -1000, -1000]);
  assertEqual(summary(game), { hand: 1, honba: 1, sticks: 1, scores: [24000, 27000, 24000, 24000] });
});

test('draw: tenpai dealer keeps the deal', () => {
  const game = play(game4(), [{ outcome: 'draw', tenpai: [true, false, false, false], riichi: [] }]);
  assertEqual([summary(game).hand, summary(game).honba], [0, 1]);
});

test('next win collects carried sticks and pays honba', () => {
  const game = play(game4(), [
    { outcome: 'draw', tenpai: [false, true, false, false], riichi: [1] },
    { outcome: 'ron', winner: 3, loser: 0, han: 1, fu: 30, riichi: [] },
  ]);
  assertEqual(game.rounds[1].deltas, [-1000 - 300, 0, 0, 1000 + 300 + 1000]);
  assertEqual(summary(game).sticks, 0);
});

test('abortive draw: dealer repeats, honba goes up, sticks stay', () => {
  const game = play(game4(), [{ outcome: 'abortive', riichi: [2] }]);
  assertEqual(summary(game), { hand: 0, honba: 1, sticks: 1, scores: [25000, 25000, 24000, 25000] });
});

test('chombo: riichi is returned and the round is replayed with the same honba', () => {
  const game = play(game4(), [
    { outcome: 'abortive', riichi: [] },
    { outcome: 'chombo', offender: 2, riichi: [1] },
  ]);
  assertEqual(game.rounds[1].deltas, [4000, 2000, -8000, 2000]);
  assertEqual([summary(game).hand, summary(game).honba, summary(game).sticks], [0, 1, 0]);
});

test('nagashi mangan by a non-dealer passes the deal and collects sticks', () => {
  const game = play(game4(), [
    { outcome: 'abortive', riichi: [0] },
    { outcome: 'nagashi', seat: 2, riichi: [] },
  ]);
  assertEqual(game.rounds[1].deltas, [-4100, -2100, 8300 + 1000, -2100]);
  assertEqual([summary(game).hand, summary(game).sticks], [1, 0]);
});

test('points plus sticks on the table always total the starting points', () => {
  const game = play(game4(), [
    { outcome: 'draw', tenpai: [true, true, false, false], riichi: [0, 1] },
    { outcome: 'tsumo', winner: 2, han: 3, fu: 40, riichi: [3] },
    { outcome: 'abortive', riichi: [1] },
  ]);
  const { state } = replay(game);
  assertEqual(state.scores.reduce((a, b) => a + b) + state.sticks * 1000, 100000);
});

// --- Ending the game ---

const toSouth4 = (game) => play(game, new Array(7).fill(noten4));

test('game ends when the deal passes after South 4 and someone has 30,000', () => {
  const game = play(toSouth4(game4()), [{ outcome: 'ron', winner: 0, loser: 1, han: 5, fu: 30, riichi: [] }]);
  const result = replay(game);
  assertEqual([result.over, result.reason], [true, 'normal']);
});

test('nobody at 30,000 after South 4: sudden death until someone reaches it', () => {
  let game = play(toSouth4(game4()), [noten4]);
  assertEqual([replay(game).over, replay(game).state.hand], [false, 8]);
  game = play(game, [{ outcome: 'ron', winner: 0, loser: 1, han: 5, fu: 30, riichi: [] }]); // West 1 dealer win
  assertEqual([replay(game).over, replay(game).reason], [true, 'normal']);
});

test('dealer win in South 4 with 30,000 reached: dealer may end the game', () => {
  const game = play(toSouth4(game4()), [{ outcome: 'ron', winner: 3, loser: 0, han: 5, fu: 30, riichi: [] }]);
  const result = replay(game);
  assertEqual([result.over, result.canYame], [false, true]);
  const ended = { ...game, endedBy: 'yame' };
  assertEqual([replay(ended).over, replay(ended).reason, replay(ended).canYame], [true, 'yame', false]);
});

test('dealer win in South 4 with nobody at 30,000: no choice to end', () => {
  const game = play(toSouth4(game4()), [{ outcome: 'ron', winner: 3, loser: 0, han: 1, fu: 30, riichi: [] }]);
  assertEqual([replay(game).over, replay(game).canYame], [false, false]);
});

test('sudden death off: game ends after South 4 even if nobody has 30,000', () => {
  const game = play(toSouth4(game4({ suddenDeath: false })), [noten4]);
  assertEqual([replay(game).over, replay(game).reason], [true, 'normal']);
});

test('sudden death off: dealer may end South 4 even if nobody has 30,000', () => {
  const game = play(toSouth4(game4({ suddenDeath: false })), [{ outcome: 'ron', winner: 3, loser: 0, han: 1, fu: 30, riichi: [] }]);
  assertEqual(replay(game).canYame, true);
});

test('agari-yame off: no choice to end, the game continues', () => {
  const game = play(toSouth4(game4({ agariYame: false })), [{ outcome: 'ron', winner: 3, loser: 0, han: 5, fu: 30, riichi: [] }]);
  assertEqual([replay(game).over, replay(game).canYame], [false, false]);
});

test('games saved without the new switches behave as if they are on', () => {
  const rules = { ...defaultRules(4) };
  delete rules.suddenDeath;
  delete rules.agariYame;
  const game = play(toSouth4(newGame({ players: ['A', 'B', 'C', 'D'], rules })), [{ outcome: 'ron', winner: 3, loser: 0, han: 5, fu: 30, riichi: [] }]);
  assertEqual(replay(game).canYame, true);
});

test('bust ends the game immediately', () => {
  const game = play(game4(), [{ outcome: 'ron', winner: 1, loser: 2, han: 0, fu: 0, yakuman: 1, riichi: [] }]);
  assertEqual([replay(game).over, replay(game).reason], [true, 'bust']);
});

test('busting off: game continues below 0', () => {
  const game = play(game4({ busting: false }), [{ outcome: 'ron', winner: 1, loser: 2, han: 0, fu: 0, yakuman: 1, riichi: [] }]);
  assertEqual(replay(game).over, false);
});

test('3-player East-only ends after East 3', () => {
  const noten3 = { outcome: 'draw', tenpai: [false, false, false], riichi: [] };
  const game = play(game3({ length: 'east' }), [noten3, noten3, { outcome: 'ron', winner: 0, loser: 1, han: 5, fu: 30, riichi: [] }]);
  assertEqual([replay(game).over, replay(game).state.hand], [true, 3]);
});

test('manual end counts as over', () => {
  assertEqual(replay({ ...game4(), endedBy: 'manual' }).over, true);
});

// --- Editing ---

test('editing an earlier round recalculates honba and sticks in later rounds', () => {
  let game = play(game4(), [
    { outcome: 'ron', winner: 1, loser: 2, han: 1, fu: 30, riichi: [] },
    { outcome: 'ron', winner: 3, loser: 0, han: 1, fu: 30, riichi: [] },
  ]);
  assertEqual(game.rounds[1].deltas, [-1000, 0, 0, 1000]);
  // The first round was actually a draw with a riichi from seat 2.
  game = saveRound(game, { outcome: 'draw', tenpai: [false, false, true, false], riichi: [2] }, 0);
  assertEqual(game.rounds[1].deltas, [-1300, 0, 0, 1000 + 300 + 1000]);
});

test('deleting a round recalculates the rounds after it', () => {
  let game = play(game4(), [
    { outcome: 'abortive', riichi: [1] },
    { outcome: 'ron', winner: 3, loser: 0, han: 1, fu: 30, riichi: [] },
  ]);
  game = deleteRound(game, 0);
  assertEqual(game.rounds.length, 1);
  assertEqual(game.rounds[0].deltas, [-1000, 0, 0, 1000]);
});

test('final standings include leftover sticks for 1st place', () => {
  const game = play(game4(), [
    { outcome: 'ron', winner: 1, loser: 2, han: 5, fu: 30, riichi: [] },
    { outcome: 'abortive', riichi: [0] },
  ]);
  assertEqual(standings(game).map((s) => s.score), [24000, 34000, 17000, 25000]);
});

// --- Labels ---

test('round labels: 東2局 1本場 in Japanese, East 2 + 1 otherwise, no honba shown at 0', () => {
  assertEqual([roundLabel(0, 2, 1, 'jp'), roundLabel(1, 4, 0, 'jp'), roundLabel(0, 2, 1, 'romaji'), roundLabel(2, 1, 0, 'en')],
    ['東2局 1本場', '南4局', 'East 2 + 1', 'West 1']);
});
