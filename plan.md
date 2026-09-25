# Mahjong Scoring and Game Tracker — Plan

A mobile-friendly riichi mahjong app hosted on GitHub Pages. It tracks points for each 局, calculates scores from a tapped-in winning hand, and keeps stats for all players across all games.

## Platform
- Static site on GitHub Pages. Plain HTML, CSS, and JavaScript (ES modules). No build step and no third-party libraries.
- Only Scott enters data. Anyone with the link can view games and stats.
- Repo: https://github.com/ScottNak/riichiMjTracker. Scott's local copy is `C:\Users\scott\Claude\RiichiTracker`. Scott runs all git commands himself.
- Tiles are the Regular SVGs from FluffyStuff's riichi-mahjong-tiles (public domain, CC0), stored in `tiles/`.

## Data flow
- On load, the app reads `data.json` from the site. This file holds all finished games.
- Games in progress are saved in the browser on Scott's phone, so a refresh or closed tab loses nothing.
- After a game, Scott exports an updated `data.json` (existing games plus new ones) and commits it to the repo. Viewers see the new game once it is pushed.

## Data model
- A game holds its rule settings, its players, and an ordered list of rounds.
- Seat 0 is the starting dealer (East). Seats go in turn order from there.
- Each round stores its outcome (ron, tsumo, exhaustive draw, nagashi mangan, abortive draw, or chombo), who was involved, and the point change for every player.
- A round from a tapped-in hand also stores the hand, so it can be reviewed later.
- Current scores are the sum of all point changes. Dealer, honba, and riichi sticks are recalculated from the round list.
- Editing or deleting any past round updates everything after it.
- Stored point changes are never recalculated. Changing rule settings later does not alter past games.

## Display
- Negative final points are shown with a triangle, like the spreadsheet: ▲17.3. Positive points show a plus sign: +53.3.

## Game modes
- 4-player and 3-player (sanma) are both supported.
- Both East-only (tonpuusen) and East-South (hanchan) games are supported.
- Rules are configurable per game, with Scott's preferred settings as the default.

## Default rules
Based on M-League rules, with these settings:
- 4-player: 25,000 start, 30,000 return, uma +30/+10/−10/−30, and 20,000 oka to 1st place.
- 3-player: 35,000 start, 40,000 return, uma +30/0/−30, and 15,000 oka to 1st place (+45/0/−30 in total).
- 3-player removes 2m–8m, uses tsumo loss, and counts north tiles as nuki-dora.
- Three red fives. Open tanyao allowed.
- Head bump: only one player can win off a discard.
- Each honba adds 300 to a ron. On a 4-player tsumo, each payer pays 100 per honba.
- Tenpai payments at an exhaustive draw total 3,000, in both 3-player and 4-player.
- Busting is on: the game ends when a player drops below 0.
- Kiriage mangan is on. Kazoe yakuman is on.
- Double yakuman is on for 13-wait kokushi, suuankou tanki, junsei chuuren, and daisuushii.
- Nagashi mangan is paid exactly like a mangan tsumo win by that player, including honba and riichi sticks.
- Pao is on for daisangen and daisuushii. On a tsumo, the liable player pays the full ron value of the pao yakuman plus all honba. On a ron by someone else, the discarder and the liable player each pay half of that yakuman and half of the honba. Any other yakuman in the hand is paid normally.
- All abortive draws are on.
- The dealer may choose to end the game when winning or in tenpai in the last round (agari-yame, tenpai-yame).
- If nobody has reached the return points (30,000 in 4-player, 40,000 in 3-player) after South 4, play continues into West. The game ends at the end of the first hand in which someone has reached it, with no round limit.
- Chombo: the offender pays a mangan as if every other player won by tsumo. A non-dealer pays 4,000 to the dealer and 2,000 to each other player; the dealer pays 4,000 to each player. Riichi sticks go back to their owners, and the round is replayed with the same honba count.
- Tied final scores are ranked by seat order, starting from East.
- Riichi sticks left on the table at the end go to 1st place.

## Stats
Per player, across all games: average placement, placement counts, win rate, deal-in rate, riichi rate, average win value, and total score.
Between players: relationship stats, such as who deals into whom.

## Past history
- Past games live in a spreadsheet, one game per sheet. Each 局 has one or more rows of point changes, one column per player, with running totals after each 局.
- Riichi deposits appear as separate −1000 rows, and collected riichi sticks as separate +1000 rows.
- Imported games keep their point changes exactly as recorded. They are never checked against current scoring rules, because older games used different rules (for example, no kiriage mangan).

## Hand entry
- Scott taps in the 14 tiles, including red fives, and marks called melds (chi, pon, kan).
- Yaku that the tiles can't show are toggles: riichi, double riichi, ippatsu, haitei, houtei, rinshan, chankan, tenhou, chihou. Tsumo or ron is also a toggle.
- Dora and ura dora indicators are tapped in, and the app counts dora itself.
- When a hand can be read more than one way, the app uses the highest-scoring reading.

## Testing
- A `test.html` page runs the test suite in a browser. Nothing needs to be installed, but the page must be served over http (GitHub Pages, or a local server), since browsers block ES modules opened straight from a file.
- The scoring engine and hand analyzer are tested before the UI that uses them is built.

## Phases
1. **Scoring engine:** han and fu to points, dealer and non-dealer payments, tsumo splits, honba, riichi sticks, draw tenpai payments, nagashi mangan, pao, chombo, 3-player payments, and final standings.
2. **Hand analyzer:** tiles to every valid reading, then yaku, fu, and han for each, keeping the best.
3. **Game tracker:** game setup, per-局 entry, live scoreboard, and editable round history.
4. **Hand entry screen:** the tile picker, which feeds the analyzer and engine.
5. **Results and stats:** per-player stats across all games, importing past history, and the view-only pages.
