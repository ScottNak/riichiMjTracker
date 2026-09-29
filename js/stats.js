// Stats across finished games. Pure functions only; statsview.js shows what these return.
//
// A hand is every round except chombo (a chombo round is replayed, so it isn't a hand).
// A win is ron, tsumo, or nagashi mangan; nagashi counts as a tsumo win.
// A deal-in is the ron discarder, and the pao-liable player whenever they pay.
// Win values split a round's point changes into the payment for the hand (honba included) and the riichi stick part,
// using stickDeltas, so imported rounds (which only have point changes) work the same as entered ones.

import { replay, standings, stickDeltas } from './game.js';

// Games that match the filters. Only finished games count.
// filters: { players: 3 | 4, length: 'all' | 'east' | 'south', from: 'YYYY-MM-DD' | '', to: 'YYYY-MM-DD' | '' }
export function filterGames(games, { players, length, from, to }) {
  return games.filter((game) => game.rules.players === players
    && (length === 'all' || game.rules.length === length)
    && (!from || game.date >= from)
    && (!to || game.date <= to)
    && replay(game).over);
}

const winnerOf = (round) => (round.outcome === 'nagashi' ? round.seat : round.outcome === 'ron' || round.outcome === 'tsumo' ? round.winner : null);

// Who dealt in on a win: the ron discarder and the pao-liable player, when they pay something.
function dealersIn(round, payments, winner) {
  const seats = new Set();
  if (round.outcome === 'ron') seats.add(round.loser);
  if (round.pao && round.pao.seat !== winner) seats.add(round.pao.seat);
  return [...seats].filter((seat) => payments[seat] < 0);
}

// Every round of a game with what the stats need: the state before it, the hand payments
// (point changes minus the riichi stick part), and who paid whom for the hand.
// transfers: [{ from, to, points }] for win payments (ron, tsumo, nagashi, pao) and chombo. Riichi sticks and tenpai payments are left out.
function roundFacts(game) {
  const { before } = replay(game);
  return game.rounds.map((round, index) => {
    const state = before[index];
    const sticks = stickDeltas(round, state, game.rules);
    const payments = round.deltas.map((delta, seat) => delta - sticks[seat]);
    const winner = winnerOf(round);
    const transfers = [];
    if (winner !== null) {
      payments.forEach((paid, seat) => { if (seat !== winner && paid < 0) transfers.push({ from: seat, to: winner, points: -paid }); });
    } else if (round.outcome === 'chombo') {
      payments.forEach((got, seat) => { if (seat !== round.offender && got > 0) transfers.push({ from: round.offender, to: seat, points: got }); });
    }
    return { round, state, payments, winner, transfers, dealtIn: winner === null ? [] : dealersIn(round, payments, winner) };
  });
}

function blankPlayer(name, players) {
  return {
    name, games: 0, places: new Array(players).fill(0), points: 0, raw: 0, busts: 0,
    hands: 0, wins: 0, tsumo: 0, dealIns: 0, riichi: 0, chombo: 0,
    winHand: 0, winHonba: 0, winAll: 0, dealInPaid: 0, best: null,
  };
}

const ratio = (count, total) => (total > 0 ? count / total : null);

// Rates and averages from the counts. A value with nothing to divide by is null.
function withRates(s) {
  const placeSum = s.places.reduce((sum, count, rank) => sum + count * (rank + 1), 0);
  return {
    ...s,
    avgPlace: ratio(placeSum, s.games),
    firstRate: ratio(s.places[0], s.games),
    lastRate: ratio(s.places[s.places.length - 1], s.games),
    bustRate: ratio(s.busts, s.games),
    avgPoints: ratio(s.points, s.games),
    winRate: ratio(s.wins, s.hands),
    tsumoRate: ratio(s.tsumo, s.hands),
    dealInRate: ratio(s.dealIns, s.hands),
    riichiRate: ratio(s.riichi, s.hands),
    avgWinHand: ratio(s.winHand, s.wins),
    avgWinHonba: ratio(s.winHonba, s.wins),
    avgWinAll: ratio(s.winAll, s.wins),
    avgDealIn: ratio(s.dealInPaid, s.dealIns),
  };
}

// Stats for every player in the given games (all the same player count). Returns a list sorted by name.
export function playerStats(games) {
  const byName = new Map();
  for (const game of games) {
    const { rules, players } = game;
    const get = (seat) => {
      const name = players[seat];
      if (!byName.has(name)) byName.set(name, blankPlayer(name, rules.players));
      return byName.get(name);
    };

    standings(game).forEach(({ rank, score, points }, seat) => {
      const s = get(seat);
      s.games += 1;
      s.places[rank] += 1;
      s.points = Math.round((s.points + points) * 10) / 10; // kept in tenths, so sums don't drift
      s.raw += score - rules.startPoints;
      if (score < 0) s.busts += 1;
    });

    for (const { round, state, payments, winner, dealtIn } of roundFacts(game)) {
      if (round.outcome === 'chombo') { get(round.offender).chombo += 1; continue; }
      players.forEach((_, seat) => { get(seat).hands += 1; });
      for (const seat of round.riichi ?? []) get(seat).riichi += 1;
      if (winner === null) continue;

      const w = get(winner);
      const handAndHonba = payments[winner];
      w.wins += 1;
      if (round.outcome !== 'ron') w.tsumo += 1;
      w.winHonba += handAndHonba;
      w.winHand += handAndHonba - state.honba * rules.honbaRon;
      w.winAll += round.deltas[winner];
      if (!w.best || handAndHonba > w.best.points) w.best = { points: handAndHonba, gameId: game.id, date: game.date };
      for (const seat of dealtIn) {
        get(seat).dealIns += 1;
        get(seat).dealInPaid -= payments[seat];
      }
    }
  }
  return [...byName.values()].map(withRates).sort((a, b) => a.name.localeCompare(b.name));
}

// One player against each opponent in the given games. Returns a list sorted by games together, most first.
// above: games the player finished above the opponent. fedThem / theyFed: deal-ins between the two, with the points paid.
// net: win and chombo payments the player got from the opponent, minus what they paid the opponent.
export function opponentStats(games, name) {
  const byName = new Map();
  for (const game of games) {
    const me = game.players.indexOf(name);
    if (me < 0) continue;
    const ranks = standings(game).map((s) => s.rank);
    const get = (seat) => {
      const other = game.players[seat];
      if (!byName.has(other)) byName.set(other, { name: other, together: 0, above: 0, fedThem: 0, fedThemPoints: 0, theyFed: 0, theyFedPoints: 0, net: 0 });
      return byName.get(other);
    };
    game.players.forEach((_, seat) => {
      if (seat === me) return;
      const o = get(seat);
      o.together += 1;
      if (ranks[me] < ranks[seat]) o.above += 1;
    });
    for (const { payments, winner, transfers, dealtIn } of roundFacts(game)) {
      for (const { from, to, points } of transfers) {
        if (to === me && from !== me) get(from).net += points;
        if (from === me && to !== me) get(to).net -= points;
      }
      for (const seat of dealtIn) {
        if (seat === me && winner !== me) { get(winner).fedThem += 1; get(winner).fedThemPoints -= payments[me]; }
        if (winner === me && seat !== me) { get(seat).theyFed += 1; get(seat).theyFedPoints -= payments[seat]; }
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.together - a.together || a.name.localeCompare(b.name));
}
