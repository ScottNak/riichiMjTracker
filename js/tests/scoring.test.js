import { test, assertEqual } from './runner.js';
import {
  RULES_4P, RULES_3P, basePoints, limitName, winPayments, nagashiPayments, drawPayments,
  chomboPayments, placementPoints, finalStandings, formatPoints,
} from '../scoring.js';

const NO_KIRIAGE = { ...RULES_4P, kiriageMangan: false };

// Seat 0 is the dealer in most tests below.
const ron = (han, fu, opts = {}) => winPayments({ winner: 1, loser: 2, dealer: 0, han, fu, ...opts }, RULES_4P);
const dealerRon = (han, fu, opts = {}) => winPayments({ winner: 0, loser: 2, dealer: 0, han, fu, ...opts }, RULES_4P);
const tsumo = (han, fu, opts = {}) => winPayments({ winner: 1, dealer: 0, han, fu, ...opts }, RULES_4P);
const dealerTsumo = (han, fu, opts = {}) => winPayments({ winner: 0, dealer: 0, han, fu, ...opts }, RULES_4P);

// --- Base points and limits ---

test('limit hands by han', () => {
  assertEqual([5, 6, 8, 11, 13].map((han) => basePoints({ han, fu: 30 }, RULES_4P)), [2000, 3000, 4000, 6000, 8000]);
});

test('kazoe yakuman off caps 13 han at sanbaiman', () => {
  assertEqual(basePoints({ han: 13, fu: 30 }, { ...RULES_4P, kazoeYakuman: false }), 6000);
});

test('double yakuman', () => {
  assertEqual(basePoints({ han: 0, fu: 0, yakuman: 2 }, RULES_4P), 16000);
});

test('limit names', () => {
  assertEqual(limitName({ han: 3, fu: 30 }, RULES_4P), null);
  assertEqual(limitName({ han: 4, fu: 30 }, RULES_4P), 'Mangan');
  assertEqual(limitName({ han: 4, fu: 30 }, NO_KIRIAGE), null);
  assertEqual(limitName({ han: 7, fu: 30 }, RULES_4P), 'Haneman');
  assertEqual(limitName({ han: 13, fu: 30 }, RULES_4P), 'Kazoe Yakuman');
  assertEqual(limitName({ han: 0, fu: 0, yakuman: 2 }, RULES_4P), '2x Yakuman');
});

// --- Ron ---

test('non-dealer ron: standard table values', () => {
  const values = [[1, 30], [2, 30], [3, 30], [2, 25], [3, 40], [1, 110]].map(([han, fu]) => ron(han, fu)[1]);
  assertEqual(values, [1000, 2000, 3900, 1600, 5200, 3600]);
});

test('dealer ron: standard table values', () => {
  const values = [[1, 30], [1, 40], [2, 30], [3, 30], [2, 25]].map(([han, fu]) => dealerRon(han, fu)[0]);
  assertEqual(values, [1500, 2000, 2900, 5800, 2400]);
});

test('ron moves points only between winner and discarder', () => {
  assertEqual(ron(3, 30), [0, 3900, -3900, 0]);
});

test('kiriage mangan: 4 han 30 fu and 3 han 60 fu', () => {
  assertEqual(ron(4, 30)[1], 8000);
  assertEqual(ron(3, 60)[1], 8000);
  assertEqual(dealerRon(4, 30)[0], 12000);
});

test('without kiriage: 4 han 30 fu stays 7700 / 11600', () => {
  assertEqual(winPayments({ winner: 1, loser: 2, dealer: 0, han: 4, fu: 30 }, NO_KIRIAGE)[1], 7700);
  assertEqual(winPayments({ winner: 0, loser: 2, dealer: 0, han: 4, fu: 30 }, NO_KIRIAGE)[0], 11600);
});

test('limit hands by ron', () => {
  assertEqual([5, 6, 8, 11, 13].map((han) => ron(han, 30)[1]), [8000, 12000, 16000, 24000, 32000]);
  assertEqual([5, 6, 8, 11, 13].map((han) => dealerRon(han, 30)[0]), [12000, 18000, 24000, 36000, 48000]);
});

test('yakuman and double yakuman by ron', () => {
  assertEqual(ron(0, 0, { yakuman: 1 })[1], 32000);
  assertEqual(ron(0, 0, { yakuman: 2 })[1], 64000);
  assertEqual(dealerRon(0, 0, { yakuman: 2 })[0], 96000);
});

test('ron with honba and riichi sticks', () => {
  // 2 honba adds 600; 1 riichi stick adds 1000 to the winner only.
  assertEqual(ron(3, 30, { honba: 2, riichiSticks: 1 }), [0, 5500, -4500, 0]);
});

// --- Tsumo ---

test('non-dealer tsumo: dealer pays double', () => {
  assertEqual(tsumo(1, 30), [-500, 1100, -300, -300]);
  assertEqual(tsumo(3, 30), [-2000, 4000, -1000, -1000]);
});

test('pinfu tsumo 2 han 20 fu is 400/700', () => {
  assertEqual(tsumo(2, 20), [-700, 1500, -400, -400]);
});

test('dealer tsumo: everyone pays equally', () => {
  assertEqual(dealerTsumo(1, 30), [1500, -500, -500, -500]);
  assertEqual(dealerTsumo(4, 30), [12000, -4000, -4000, -4000]);
});

test('tsumo with honba: 100 per honba from each payer', () => {
  assertEqual(tsumo(1, 30, { honba: 2 }), [-700, 1700, -500, -500]);
});

test('yakuman tsumo', () => {
  assertEqual(tsumo(0, 0, { yakuman: 1 }), [-16000, 32000, -8000, -8000]);
});

// --- 3-player ---

test('3-player tsumo loss: non-dealer mangan tsumo collects 6000', () => {
  assertEqual(winPayments({ winner: 1, dealer: 0, han: 5, fu: 30 }, RULES_3P), [-4000, 6000, -2000]);
});

test('3-player tsumo loss: dealer mangan tsumo collects 8000', () => {
  assertEqual(winPayments({ winner: 0, dealer: 0, han: 5, fu: 30 }, RULES_3P), [8000, -4000, -4000]);
});

test('3-player ron pays the full value', () => {
  assertEqual(winPayments({ winner: 1, loser: 2, dealer: 0, han: 5, fu: 30 }, RULES_3P), [0, 8000, -8000]);
});

// --- Exhaustive draw ---

test('draw: 1, 2, or 3 players tenpai', () => {
  assertEqual(drawPayments([true, false, false, false], RULES_4P), [3000, -1000, -1000, -1000]);
  assertEqual(drawPayments([false, true, false, true], RULES_4P), [-1500, 1500, -1500, 1500]);
  assertEqual(drawPayments([true, true, false, true], RULES_4P), [1000, 1000, -3000, 1000]);
});

test('draw: nobody or everybody tenpai pays nothing', () => {
  assertEqual(drawPayments([false, false, false, false], RULES_4P), [0, 0, 0, 0]);
  assertEqual(drawPayments([true, true, true, true], RULES_4P), [0, 0, 0, 0]);
});

// --- Chombo ---

test('chombo by a non-dealer: 4000 to dealer, 2000 to others', () => {
  assertEqual(chomboPayments({ offender: 2, dealer: 0 }, RULES_4P), [4000, 2000, -8000, 2000]);
});

test('chombo by the dealer: 4000 to each', () => {
  assertEqual(chomboPayments({ offender: 0, dealer: 0 }, RULES_4P), [-12000, 4000, 4000, 4000]);
});

test('3-player chombo', () => {
  assertEqual(chomboPayments({ offender: 2, dealer: 0 }, RULES_3P), [4000, 2000, -6000]);
  assertEqual(chomboPayments({ offender: 0, dealer: 0 }, RULES_3P), [-8000, 4000, 4000]);
});

// --- Final placement points ---

test('4-player placement points match the 2/6/2024 sheet', () => {
  // Emily 33300 (1st), Allen 28000 (2nd), Scott 26000 (3rd), Matt 12700 (4th)
  assertEqual(
    [[33300, 0], [28000, 1], [26000, 2], [12700, 3]].map(([score, rank]) => placementPoints(score, rank, RULES_4P)),
    [53.3, 8, -14, -47.3],
  );
});

test('3-player placement points: +45 / 0 / -30 at return points', () => {
  assertEqual([0, 1, 2].map((rank) => placementPoints(40000, rank, RULES_3P)), [45, 0, -30]);
});

// --- The 2/6/2024 sheet, round by round (that game did not use kiriage mangan) ---

test('2/6/2024 sheet: each round reproduces the recorded point changes', () => {
  // Seats: 0 Emily, 1 Matt, 2 Scott, 3 Allen. Emily is the starting dealer.
  const R = NO_KIRIAGE;
  assertEqual(winPayments({ winner: 0, loser: 1, dealer: 0, han: 1, fu: 40 }, R), [2000, -2000, 0, 0]); // E1
  assertEqual(drawPayments([false, true, false, true], R), [-1500, 1500, -1500, 1500]); // E1+1 (Matt also paid a 1000 riichi deposit)
  assertEqual(winPayments({ winner: 0, loser: 1, dealer: 1, han: 4, fu: 30, honba: 2, riichiSticks: 1 }, R), [9300, -8300, 0, 0]); // E2+2
  assertEqual(winPayments({ winner: 1, loser: 2, dealer: 2, han: 3, fu: 40 }, R), [0, 5200, -5200, 0]); // E3
  assertEqual(winPayments({ winner: 3, loser: 0, dealer: 3, han: 1, fu: 30 }, R), [-1500, 0, 0, 1500]); // E4
});

// --- 3-player honba and draws ---

test('3-player ron with honba adds 300 per honba', () => {
  assertEqual(winPayments({ winner: 1, loser: 2, dealer: 0, han: 5, fu: 30, honba: 1 }, RULES_3P), [0, 8300, -8300]);
});

test('3-player draw payments total 3000', () => {
  assertEqual(drawPayments([true, false, false], RULES_3P), [3000, -1500, -1500]);
  assertEqual(drawPayments([true, false, true], RULES_3P), [1500, -3000, 1500]);
});

// --- Nagashi mangan ---

test('nagashi mangan pays like a mangan tsumo, with honba and riichi sticks', () => {
  assertEqual(nagashiPayments({ seat: 1, dealer: 0 }, RULES_4P), [-4000, 8000, -2000, -2000]);
  assertEqual(nagashiPayments({ seat: 0, dealer: 0, honba: 1, riichiSticks: 2 }, RULES_4P), [14300, -4100, -4100, -4100]);
});

// --- Pao ---

test('pao tsumo: the liable player pays the full yakuman', () => {
  assertEqual(winPayments({ winner: 1, dealer: 0, han: 0, fu: 0, yakuman: 1, pao: { seat: 3, yakuman: 1 } }, RULES_4P), [0, 32000, 0, -32000]);
});

test('pao ron: discarder and liable player split the yakuman and the honba', () => {
  assertEqual(
    winPayments({ winner: 1, loser: 2, dealer: 0, han: 0, fu: 0, yakuman: 1, honba: 1, riichiSticks: 1, pao: { seat: 3, yakuman: 1 } }, RULES_4P),
    [0, 33300, -16150, -16150],
  );
});

test('pao ron when the liable player is the discarder: they pay it all', () => {
  assertEqual(winPayments({ winner: 1, loser: 3, dealer: 0, han: 0, fu: 0, yakuman: 1, honba: 1, pao: { seat: 3, yakuman: 1 } }, RULES_4P), [0, 32300, 0, -32300]);
});

test('pao with a second yakuman: the other yakuman is paid normally', () => {
  // Daisangen (pao on seat 3) + tsuuiisou, by tsumo.
  assertEqual(winPayments({ winner: 1, dealer: 0, han: 0, fu: 0, yakuman: 2, pao: { seat: 3, yakuman: 1 } }, RULES_4P), [-16000, 64000, -8000, -40000]);
});

test('pao on a dealer daisuushii (double yakuman) tsumo', () => {
  assertEqual(winPayments({ winner: 0, dealer: 0, han: 0, fu: 0, yakuman: 2, pao: { seat: 2, yakuman: 2 } }, RULES_4P), [96000, 0, -96000, 0]);
});

// --- Final standings and display ---

test('final standings: ties go to the seat closest to East, leftover sticks go to 1st', () => {
  assertEqual(finalStandings([30000, 30000, 20000, 19000], 1, RULES_4P), [
    { rank: 0, score: 31000, points: 51 },
    { rank: 1, score: 30000, points: 10 },
    { rank: 2, score: 20000, points: -20 },
    { rank: 3, score: 19000, points: -41 },
  ]);
});

test('final standings for the 2/6/2024 sheet', () => {
  // Seats: Emily, Matt, Scott, Allen
  assertEqual(finalStandings([33300, 12700, 26000, 28000], 0, RULES_4P).map((s) => formatPoints(s.points)), ['+53.3', '▲47.3', '▲14.0', '+8.0']);
});

test('points display', () => {
  assertEqual([53.3, -47.3, 8, 0].map(formatPoints), ['+53.3', '▲47.3', '+8.0', '0.0']);
});

test('3-player tsumo with honba: 150 per honba from each payer', () => {
  assertEqual(winPayments({ winner: 1, dealer: 0, han: 5, fu: 30, honba: 2 }, RULES_3P), [-4300, 6600, -2300]);
});
