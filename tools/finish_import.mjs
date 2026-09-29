// Second step of the one-time import: node tools/finish_import.mjs (from the repo folder).
// Reads tools/history.json, checks every imported round against the app's own scoring code,
// works out how each game ended, and writes data.json. Prints each game's final standings.
import { readFileSync, writeFileSync } from 'node:fs';
import { defaultRules, replay, standings, stickDeltas } from '../js/game.js';
import { winPayments, drawPayments, chomboPayments } from '../js/scoring.js';

const FU = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
const same = (a, b) => a.every((value, i) => value === b[i]);
const minus = (a, b) => a.map((value, i) => value - b[i]);

// Whether some han/fu or yakuman count pays exactly this, honba included.
function winFits(round, state, rules, payment) {
  const dealer = state.hand % rules.players;
  const loser = round.outcome === 'ron' ? round.loser : null;
  const tries = [];
  for (let han = 1; han <= 13; han++) for (const fu of han < 5 ? FU : [30]) tries.push({ han, fu, yakuman: 0 });
  for (let yakuman = 1; yakuman <= 6; yakuman++) tries.push({ han: 0, fu: 0, yakuman });
  return tries.some((hand) => same(winPayments({ winner: round.winner, loser, dealer, ...hand, honba: state.honba, riichiSticks: 0 }, rules), payment));
}

function check(round, state, rules) {
  const payment = minus(round.deltas, stickDeltas(round, state, rules));
  switch (round.outcome) {
    case 'ron':
    case 'tsumo': return winFits(round, state, rules, payment) || winFits(round, state, { ...rules, kiriageMangan: !rules.kiriageMangan }, payment);
    case 'draw': return same(payment, drawPayments(round.tenpai, rules));
    case 'abortive': return payment.every((value) => value === 0);
    case 'chombo': return same(round.deltas, chomboPayments({ offender: round.offender, dealer: state.hand % rules.players }, rules));
    default: return false;
  }
}

const lastHand = (rules) => (rules.length === 'east' ? 1 : 2) * rules.players - 1;
const problems = [];
const games = JSON.parse(readFileSync('tools/history.json', 'utf8')).map((imported) => {
  const rules = { ...defaultRules(imported.players.length), length: imported.length };
  const tag = imported.notes.match(/"(.*)"/)[1];
  let game = { id: imported.id, date: imported.date, createdAt: imported.createdAt, notes: imported.notes, rules,
    players: imported.players, rounds: imported.rounds, endedBy: null };
  let result = replay(game);
  const failing = (r) => game.rounds.flatMap((round, i) => (check(round, result.before[i], r) ? [] : [i]));

  // Some older 3-player games paid differently from today's rules. The game keeps today's rules
  // (its rounds are never recalculated) and gets a note instead.
  const quirks = rules.players === 3 ? [
    [{ honbaTsumoEach: 100 }, 'each tsumo payer added 100 per honba instead of 150'],
    [{ notenPaymentTotal: 2000 }, 'tenpai payments totaled 2,000 instead of 3,000'],
  ] : [];
  const tries = [[]];
  for (const quirk of quirks) tries.push(...tries.map((set) => [...set, quirk]));
  const fit = tries.find((set) => failing({ ...rules, ...Object.assign({}, ...set.map(([change]) => change)) }).length === 0);
  if (!fit) failing(rules).forEach((i) => problems.push(`${tag} round ${i + 1}: ${JSON.stringify(game.rounds[i])}`));
  else if (fit.length) game.notes += ` In this game ${fit.map(([, text]) => text).join(', and ')}, so it may have been played incorrectly.`;
  if (result.endsAt !== null && result.endsAt < game.rounds.length - 1) problems.push(`${tag}: should have ended after round ${result.endsAt + 1}`);

  // How the game ended.
  if (!result.over) {
    if (result.canYame) game.endedBy = 'yame';
    else if (result.state.hand > lastHand(rules)) {
      // Every scheduled round was played and nobody reached the return points: they didn't play sudden death.
      game.rules = { ...rules, suddenDeath: false };
      if (!replay(game).over) problems.push(`${tag}: doesn't end even without sudden death`);
    } else game.endedBy = 'manual';
  }
  result = replay(game);
  const end = game.endedBy === 'manual' ? 'ended early' : game.endedBy === 'yame' ? 'agari-yame' : result.reason;
  const table = standings(game).map((s, seat) => ({ ...s, seat })).sort((a, b) => a.rank - b.rank)
    .map((s) => `${game.players[s.seat]} ${s.points > 0 ? '+' : ''}${s.points}`).join(', ');
  console.log(`${tag.padEnd(13)} ${end.padEnd(12)} ${table}`);
  return game;
});

if (problems.length) {
  console.log('\nProblems, data.json not written:\n' + problems.join('\n'));
  process.exit(1);
}
writeFileSync('data.json', JSON.stringify({ version: 1, games }, null, 2) + '\n');
console.log(`\n${games.length} games written to data.json`);
