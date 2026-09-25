// Game tracking: round progression, riichi sticks, honba, and when a game ends.
// Pure functions only; saving and display live elsewhere.
//
// A game: { id, date ('YYYY-MM-DD', the day it was played), createdAt, notes, rules, players: [name by seat], rounds: [round], endedBy: null | 'manual' | 'yame' }
// A round is what Scott entered plus the resulting point change for every seat:
//   { outcome: 'ron',      winner, loser, han, fu, yakuman, pao, riichi, deltas }
//   { outcome: 'tsumo',    winner, han, fu, yakuman, pao, riichi, deltas }
//   { outcome: 'draw',     tenpai: [bool by seat], riichi, deltas }
//   { outcome: 'nagashi',  seat, riichi, deltas }
//   { outcome: 'abortive', riichi, deltas }
//   { outcome: 'chombo',   offender, deltas }
// riichi lists the seats that declared riichi this round. pao is null or { seat, yakuman }.
// deltas include riichi deposits (-1000) and collected sticks, so scores are just the sum of deltas.

import { RULES_4P, RULES_3P, winPayments, nagashiPayments, drawPayments, chomboPayments, finalStandings } from './scoring.js';

export function defaultRules(players) {
  const rules = players === 3 ? RULES_3P : RULES_4P;
  return { ...rules, uma: [...rules.uma] };
}

export function newGame({ players, rules, date, notes = '' }) {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date,
    createdAt: new Date().toISOString(),
    notes,
    rules,
    players,
    rounds: [],
    endedBy: null,
  };
}

// State at the start of a round. hand counts dealer turns from East 1 (0 = East 1, 4 = South 1 in 4-player).
function startState(rules) {
  return { hand: 0, honba: 0, sticks: 0, scores: new Array(rules.players).fill(rules.startPoints) };
}

export const dealerOf = (state, rules) => state.hand % rules.players;
export const windOf = (state, rules) => Math.floor(state.hand / rules.players);
export const handNumberOf = (state, rules) => (state.hand % rules.players) + 1;
const lastHand = (rules) => (rules.length === 'east' ? 1 : 2) * rules.players - 1;

// Point changes for a round, given the state at its start.
export function computeDeltas(round, state, rules) {
  const dealer = dealerOf(state, rules);
  const riichi = round.outcome === 'chombo' ? [] : round.riichi ?? [];
  const sticks = state.sticks + riichi.length;
  const { honba } = state;
  let deltas;
  switch (round.outcome) {
    case 'ron':
    case 'tsumo':
      deltas = winPayments({
        winner: round.winner,
        loser: round.outcome === 'ron' ? round.loser : null,
        dealer, han: round.han, fu: round.fu, yakuman: round.yakuman ?? 0,
        honba, riichiSticks: sticks, pao: round.pao ?? null,
      }, rules);
      break;
    case 'nagashi':
      deltas = nagashiPayments({ seat: round.seat, dealer, honba, riichiSticks: sticks }, rules);
      break;
    case 'draw':
      deltas = drawPayments(round.tenpai, rules);
      break;
    case 'abortive':
      deltas = new Array(rules.players).fill(0);
      break;
    case 'chombo':
      deltas = chomboPayments({ offender: round.offender, dealer }, rules);
      break;
    default:
      throw new Error(`Unknown outcome: ${round.outcome}`);
  }
  for (const seat of riichi) deltas[seat] -= 1000;
  return deltas;
}

// Who collects the sticks on the table, and whether the dealer keeps the deal.
function winnerOf(round) {
  if (round.outcome === 'ron' || round.outcome === 'tsumo') return round.winner;
  if (round.outcome === 'nagashi') return round.seat;
  return null;
}

// State at the start of the next round.
function advance(state, round, rules) {
  const dealer = dealerOf(state, rules);
  const scores = state.scores.map((score, seat) => score + round.deltas[seat]);
  const riichiCount = round.outcome === 'chombo' ? 0 : (round.riichi ?? []).length;
  const winner = winnerOf(round);
  let { hand, honba, sticks } = state;

  if (winner !== null) {
    sticks = 0;
    if (winner === dealer) honba += 1;
    else { hand += 1; honba = 0; }
  } else if (round.outcome === 'draw') {
    sticks += riichiCount;
    honba += 1;
    if (!round.tenpai[dealer]) hand += 1;
  } else if (round.outcome === 'abortive') {
    sticks += riichiCount;
    honba += 1;
  }
  // Chombo: the round is replayed with the same dealer, honba, and sticks.
  return { hand, honba, sticks, scores };
}

// Whether the game ends after a round. Returns { over, reason, canYame }.
// canYame: the dealer won or was tenpai in the last round and may choose to end the game.
function endCheck(before, after, round, rules) {
  if (rules.busting && after.scores.some((score) => score < 0)) return { over: true, reason: 'bust', canYame: false };
  if (round.outcome === 'chombo') return { over: false, canYame: false };

  const last = lastHand(rules);
  const reached = after.scores.some((score) => score >= rules.returnPoints);
  if (before.hand > last) return { over: reached, reason: 'normal', canYame: false }; // sudden death
  if (before.hand < last) return { over: false, canYame: false };

  // The last scheduled round.
  if (after.hand > last) return { over: reached, reason: 'normal', canYame: false };
  const dealer = dealerOf(before, rules);
  const dealerKept = winnerOf(round) === dealer || (round.outcome === 'draw' && round.tenpai[dealer]);
  return { over: false, canYame: reached && dealerKept };
}

// Replays every round. Returns the state before each round, the current state, and whether the game is over.
// endsAt is the index of the first round after which the game should have ended, or null.
export function replay(game) {
  const { rules } = game;
  let state = startState(rules);
  const before = [];
  let status = { over: false, canYame: false };
  let endsAt = null;
  game.rounds.forEach((round, index) => {
    before.push(state);
    const next = advance(state, round, rules);
    status = endCheck(state, next, round, rules);
    if (status.over && endsAt === null) endsAt = index;
    state = next;
  });
  const over = status.over || game.endedBy !== null;
  const reason = status.over ? status.reason : game.endedBy;
  return { before, state, over, reason, canYame: status.canYame && game.endedBy === null, endsAt };
}

// Adds a round at the end, or replaces the round at index. Later rounds are recalculated,
// since the honba and sticks they started with may have changed. Returns a new game.
export function saveRound(game, entry, index = game.rounds.length) {
  const rounds = [...game.rounds];
  rounds[index] = entry;
  return recalculateFrom({ ...game, rounds }, index);
}

export function deleteRound(game, index) {
  const rounds = game.rounds.filter((_, i) => i !== index);
  return recalculateFrom({ ...game, rounds }, index);
}

// Rounds without entered details (imported history) keep their recorded deltas.
function recalculateFrom(game, index) {
  const { rules } = game;
  let state = startState(rules);
  const rounds = game.rounds.map((round, i) => {
    const updated = i >= index && round.outcome ? { ...round, deltas: computeDeltas(round, state, rules) } : round;
    state = advance(state, updated, rules);
    return updated;
  });
  return { ...game, rounds };
}

export function standings(game) {
  const { state } = replay(game);
  return finalStandings(state.scores, state.sticks, game.rules);
}
