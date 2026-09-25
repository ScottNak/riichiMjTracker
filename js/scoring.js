// Riichi mahjong point calculations.
// Every function is pure: it takes numbers in and returns numbers out.
// Seats are numbered 0..players-1, and seat 0 is the starting dealer (East).
// A "deltas" array holds the point change for each seat.

const SHARED_RULES = {
  kiriageMangan: true,
  kazoeYakuman: true,
  honbaRon: 300,             // added to a ron per honba
  notenPaymentTotal: 3000,   // total tenpai payment at an exhaustive draw
  length: 'south',           // 'east' (tonpuusen) or 'south' (hanchan)
  busting: true,             // the game ends when a player drops below 0
  nagashiMangan: true,
  abortiveDraws: true,
};

export const RULES_4P = {
  ...SHARED_RULES,
  players: 4,
  startPoints: 25000,
  returnPoints: 30000,
  uma: [30, 10, -10, -30],
  honbaTsumoEach: 100,       // paid by each payer per honba on a tsumo
};

export const RULES_3P = {
  ...SHARED_RULES,
  players: 3,
  startPoints: 35000,
  returnPoints: 40000,
  uma: [30, 0, -30],
  honbaTsumoEach: 150,       // honba stays worth 300 in total despite tsumo loss
};

const roundUp100 = (points) => Math.ceil(points / 100) * 100;
const zeros = (rules) => new Array(rules.players).fill(0);
const addInto = (target, source) => source.forEach((value, seat) => { target[seat] += value; });

// Base points before the dealer/non-dealer multiplier.
// yakuman is the number of yakuman (2 for a double yakuman); 0 for a normal hand.
export function basePoints({ han, fu, yakuman = 0 }, rules) {
  if (yakuman > 0) return 8000 * yakuman;
  if (han >= 13) return rules.kazoeYakuman ? 8000 : 6000;
  if (han >= 11) return 6000; // sanbaiman
  if (han >= 8) return 4000;  // baiman
  if (han >= 6) return 3000;  // haneman
  if (han >= 5) return 2000;  // mangan
  const base = fu * 2 ** (han + 2);
  if (base >= 2000) return 2000;
  // Kiriage mangan: 4 han 30 fu and 3 han 60 fu round up to mangan.
  if (rules.kiriageMangan && base === 1920) return 2000;
  return base;
}

// Name of the scoring limit, or null for a hand below mangan.
export function limitName({ han, fu, yakuman = 0 }, rules) {
  if (yakuman === 1) return 'Yakuman';
  if (yakuman > 1) return `${yakuman}x Yakuman`;
  const base = basePoints({ han, fu }, rules);
  return { 8000: 'Kazoe Yakuman', 6000: 'Sanbaiman', 4000: 'Baiman', 3000: 'Haneman', 2000: 'Mangan' }[base] ?? null;
}

// Point changes for a win.
// loser is the discarder's seat for ron, or null for tsumo.
// pao is null, or { seat, yakuman } naming the liable player and how many of the hand's yakuman they are liable for.
// In 3-player, tsumo loss happens naturally: only the two other players pay.
export function winPayments({ winner, loser = null, dealer, han, fu, yakuman = 0, honba = 0, riichiSticks = 0, pao = null }, rules) {
  if (pao && pao.seat !== winner) {
    return paoWinPayments({ winner, loser, dealer, yakuman, honba, riichiSticks, pao }, rules);
  }

  const base = basePoints({ han, fu, yakuman }, rules);
  const deltas = zeros(rules);
  const winnerIsDealer = winner === dealer;

  if (loser !== null) {
    const amount = roundUp100(base * (winnerIsDealer ? 6 : 4)) + honba * rules.honbaRon;
    deltas[loser] -= amount;
    deltas[winner] += amount;
  } else {
    for (let seat = 0; seat < rules.players; seat++) {
      if (seat === winner) continue;
      const multiplier = winnerIsDealer || seat === dealer ? 2 : 1;
      const amount = roundUp100(base * multiplier) + honba * rules.honbaTsumoEach;
      deltas[seat] -= amount;
      deltas[winner] += amount;
    }
  }

  deltas[winner] += riichiSticks * 1000;
  return deltas;
}

// A yakuman win with a liable (pao) player. See the pao rule in plan.md.
function paoWinPayments({ winner, loser, dealer, yakuman, honba, riichiSticks, pao }, rules) {
  const deltas = zeros(rules);
  const paoValue = 8000 * pao.yakuman * (winner === dealer ? 6 : 4);
  const honbaTotal = honba * rules.honbaRon;

  if (loser !== null && loser !== pao.seat) {
    for (const payer of [loser, pao.seat]) {
      deltas[payer] -= (paoValue + honbaTotal) / 2;
    }
  } else {
    deltas[pao.seat] -= paoValue + honbaTotal;
  }
  deltas[winner] += paoValue + honbaTotal + riichiSticks * 1000;

  // Any yakuman the liable player is not responsible for is paid normally, without honba.
  const otherYakuman = yakuman - pao.yakuman;
  if (otherYakuman > 0) {
    addInto(deltas, winPayments({ winner, loser, dealer, han: 0, fu: 0, yakuman: otherYakuman }, rules));
  }
  return deltas;
}

// Nagashi mangan is paid exactly like a mangan tsumo win by that player.
export function nagashiPayments({ seat, dealer, honba = 0, riichiSticks = 0 }, rules) {
  return winPayments({ winner: seat, dealer, han: 5, fu: 30, honba, riichiSticks }, rules);
}

// Point changes for an exhaustive draw. tenpai is one boolean per seat.
export function drawPayments(tenpai, rules) {
  const deltas = zeros(rules);
  const tenpaiCount = tenpai.filter(Boolean).length;
  if (tenpaiCount === 0 || tenpaiCount === rules.players) return deltas;
  const total = rules.notenPaymentTotal;
  tenpai.forEach((isTenpai, seat) => {
    deltas[seat] = isTenpai ? total / tenpaiCount : -total / (rules.players - tenpaiCount);
  });
  return deltas;
}

// Chombo: the offender pays a mangan as if every other player had won by tsumo.
// A non-dealer pays 4000 to the dealer and 2000 to each other player; the dealer pays 4000 to each.
// Returning riichi sticks is handled by the game tracker, not here.
export function chomboPayments({ offender, dealer }, rules) {
  const deltas = zeros(rules);
  for (let seat = 0; seat < rules.players; seat++) {
    if (seat === offender) continue;
    const amount = offender === dealer || seat === dealer ? 4000 : 2000;
    deltas[seat] += amount;
    deltas[offender] -= amount;
  }
  return deltas;
}

// Final points for one player: (score - return) / 1000, plus uma, plus oka for 1st place.
// rank is 0 for 1st place. Worked in tenths to avoid floating point error.
export function placementPoints(score, rank, rules) {
  const okaTenths = ((rules.returnPoints - rules.startPoints) * rules.players) / 100;
  const tenths = (score - rules.returnPoints) / 100 + rules.uma[rank] * 10 + (rank === 0 ? okaTenths : 0);
  return tenths / 10;
}

// Final standings for every seat: rank (0 = 1st), final score, and final points.
// Ties go to the seat closest to East. Leftover riichi sticks go to 1st place.
export function finalStandings(scores, leftoverSticks, rules) {
  const order = scores.map((_, seat) => seat).sort((a, b) => scores[b] - scores[a] || a - b);
  return scores.map((score, seat) => {
    const rank = order.indexOf(seat);
    const finalScore = score + (rank === 0 ? leftoverSticks * 1000 : 0);
    return { rank, score: finalScore, points: placementPoints(finalScore, rank, rules) };
  });
}

// Final points for display: +53.3, ▲47.3, 0.0
export function formatPoints(points) {
  const text = Math.abs(points).toFixed(1);
  if (points > 0) return `+${text}`;
  if (points < 0) return `▲${text}`;
  return text;
}
