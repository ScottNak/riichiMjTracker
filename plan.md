# Mahjong Scoring and Game Tracker — Plan

A mobile-friendly riichi mahjong app hosted on GitHub Pages. It tracks points for each 局, calculates scores from a tapped-in winning hand, and keeps stats for all players across all games.

## Platform
- Static site on GitHub Pages. Plain HTML, CSS, and JavaScript (ES modules). No build step and no third-party libraries.
- Only Scott enters data. Anyone with the link can view games and stats.
- Repo: https://github.com/ScottNak/riichiMjTracker. Scott's local copy is `C:\Users\scott\Claude\RiichiTracker`. Scott runs all git commands himself.
- Tiles are the Regular SVGs from FluffyStuff's riichi-mahjong-tiles (public domain, CC0), stored in `tiles/`.

## Data flow
- On load, the app reads `data.json` from the site. This file holds all finished games.
- Games entered on Scott's phone are saved in that browser, so a refresh or closed tab loses nothing.
- After a game, Scott taps Export on the home screen. It downloads a new `data.json` holding every game already in `data.json` plus the finished games on the phone. Scott commits it to the repo, and viewers see the new games once it is pushed.
- A finished game stays listed on the phone under "Not yet exported" until the site's `data.json` contains it; then the phone drops its copy.

## Data model
- A game holds its date, notes, rule settings, its players, and an ordered list of rounds.
- Seat 0 is the starting dealer (East). Seats go in turn order from there.
- Each round stores its outcome (ron, tsumo, exhaustive draw, nagashi mangan, abortive draw, or chombo), who was involved, who declared riichi, and the point change for every player. Point changes include riichi deposits and collected sticks.
- A round from a tapped-in hand also stores the hand, so it can be reviewed later.
- Current scores are the sum of all point changes. Dealer, honba, and riichi sticks are recalculated from the round list.
- Loading a game never recalculates its point changes, so changing rule settings or fixing the engine does not alter past games.
- Editing or deleting a round recalculates the point changes of every round after it from their entered details and the game's own rules, since their honba and sticks may have changed. Rounds without entered details (imported history) keep their recorded point changes.
- If an edit means the game should have ended earlier, the game screen says after which round, and Scott fixes or deletes the rounds after it.

## Display
- All text on screen follows a Japanese / romaji / English toggle. Japanese mode translates everything. Romaji mode is English except for mahjong terms, which are in romaji (Ryuukyoku, Houjuu, Genten, Kaeshi, Tobi, Tenpai, All Noten…). English mode keeps the usual mahjong terms (Ron, Tsumo, Riichi, Tenpai, Chombo). The app title stays "Riichi Tracker" in every mode. Riichi sticks on the table are 供託 in Japanese.
- Japanese yaku names use short forms where common (ツモ, 全帯, 一通).
- Round labels: 東2局 1本場 in Japanese, East 2 + 1 in romaji and English. The honba part is left out at 0 honba.
- When riichi sticks carry over from earlier rounds, the round label shows a riichi stick icon and the count (× 2).
- Scores are shown as one tile per player, all in a single row in seat order. Each tile has the seat wind top left (東 in Japanese, E/S/W/N otherwise), the name top right, the score large in the middle, and at the bottom the final points the player would get if the game ended now. The dealer's tile is outlined.
- When the game is over, the same tiles are sorted by placement, with the place (1st, 2nd…) top left, the final score including leftover sticks, and final points. 1st place is outlined.
- Negative final points are shown with a triangle, like the spreadsheet: ▲17.3. Positive points show a plus sign: +53.3.

## Game modes
- 4-player and 3-player (sanma) are both supported.
- Both East-only (tonpuusen) and East-South (hanchan) games are supported. New games default to East-South.
- Rules are configurable per game, with Scott's preferred settings as the default. The setup screen sets the date (default today), players, length, start and return points, uma, and switches for kiriage mangan, kazoe yakuman, busting, nagashi mangan, abortive draws, agari-yame, and sudden death. The switches sit in a collapsible Rules shelf, closed by default; each has a short note under its name. Games saved before the agari-yame and sudden-death switches existed treat them as on. Oka follows from start and return points. Uma must add up to 0.
- Players are picked from everyone in past games, or typed in as a new name.

## Default rules
Based on M-League rules, with these settings:
- 4-player: 25,000 start, 30,000 return, uma +30/+10/−10/−30, and 20,000 oka to 1st place.
- 3-player: 35,000 start, 40,000 return, uma +30/0/−30, and 15,000 oka to 1st place (+45/0/−30 in total).
- 3-player removes 2m–8m, uses tsumo loss, and counts north tiles as nuki-dora. A player may instead keep north tiles in the hand as normal tiles; a north set is not a value tile (yakuhai).
- Three red fives. Open tanyao allowed.
- Standard M-League yaku only; no local yaku. Ryuuiisou counts with or without Hatsu.
- Each red five is listed as Aka Dora, separate from regular dora.
- A pair of a wind that is both the seat wind and the round wind is worth 2 fu, as in M-League.
- Head bump: only one player can win off a discard.
- Each honba is worth 300. On a ron the discarder pays all of it; on a tsumo it is split evenly among the payers (100 each in 4-player, 150 each in 3-player).
- A dealer win keeps the deal and adds a honba. A non-dealer win passes the deal and resets honba to 0.
- Exhaustive draw: honba goes up, riichi sticks stay on the table, and the dealer keeps the deal only if tenpai. Tenpai payments total 3,000, in both 3-player and 4-player. A player in riichi must be tenpai.
- Busting is on: the game ends when a player drops below 0.
- Kiriage mangan is on. Kazoe yakuman is on.
- Double yakuman is on for 13-wait kokushi, suuankou tanki, junsei chuuren, and daisuushii.
- Nagashi mangan is treated exactly like a mangan tsumo win by that player: it pays honba and riichi sticks, and a dealer nagashi keeps the deal.
- Pao is on for daisangen, daisuushii, and suukantsu. Scott picks the liable player when entering the round. On a tsumo, the liable player pays the full ron value of the pao yakuman plus all honba, in 3-player too. On a ron by someone else, the discarder and the liable player each pay half of that yakuman and half of the honba. Any other yakuman in the hand is paid normally.
- All abortive draws are on. After one, the dealer repeats, honba goes up, and riichi sticks stay on the table.
- The dealer may choose to end the game when winning or in tenpai in the last scheduled round, if someone has reached the return points or sudden death is off (agari-yame, tenpai-yame). The app offers an End game button; entering the next round continues the game. With agari-yame off, the game just continues.
- If nobody has reached the return points (30,000 in 4-player, 40,000 in 3-player) after the last scheduled round (East 4 in East-only, South 4 in East-South), play continues into the next wind with sudden death: the game ends at the end of the first hand in which someone has reached it, with no round limit. With sudden death off, the game always ends after the last scheduled round.
- Chombo: the offender pays a mangan as if every other player won by tsumo. A non-dealer pays 4,000 to the dealer and 2,000 to each other player; the dealer pays 4,000 to each player. Riichi sticks go back to their owners, and the round is replayed with the same honba count.
- Tied final scores are ranked by seat order, starting from East.
- Riichi sticks left on the table at the end go to 1st place.
- Scott can end a game at any point (for example, when someone has to leave). It is scored and counted in stats exactly like a game that ended normally. A game ended by hand can be resumed.

## Stats
Per player, across all games: average placement, placement counts, win rate, deal-in rate, riichi rate, average win value, and total score.
Between players: relationship stats, such as who deals into whom.

## Past history
- Past games live in a spreadsheet, one game per sheet. Each 局 has one or more rows of point changes, one column per player, with running totals after each 局.
- Riichi deposits appear as separate −1000 rows, and collected riichi sticks as separate +1000 rows.
- Imported games keep their point changes exactly as recorded. They are never checked against current scoring rules, because older games used different rules (for example, no kiriage mangan).

## Hand entry
- A win can be entered as han and fu (or a yakuman count, with an optional pao player). This stays available after tile entry is built, for hands nobody remembers exactly.
- Scott taps in the 14 tiles, including red fives, and marks called melds (chi, pon, kan).
- Yaku that the tiles can't show are toggles: riichi, double riichi, ippatsu, haitei, houtei, rinshan, chankan, tenhou, chihou. Tsumo or ron is also a toggle.
- Dora and ura dora indicators are tapped in, and the app counts dora itself.
- When a hand can be read more than one way, the app uses the highest-scoring reading.

## Code
- `index.html`, `css/style.css`, `js/app.js`: the page. Home (game lists and export), game setup, and the game screen (scoreboard, round entry with a live point preview, round history with edit and delete). Every change re-renders the view from the data.
- `js/game.js`: round progression, riichi sticks, honba, when a game ends, and recalculating rounds after an edit.
- `js/store.js`: loading `data.json`, saving games in the browser, and exporting `data.json`.
- `js/tiles.js`: tile notation and helpers. Tiles are written `1m`–`9m`, `1p`–`9p`, `1s`–`9s`, and `1z`–`7z` (East, South, West, North, Haku, Hatsu, Chun); a red five is `0m`, `0p`, or `0s`.
- `js/scoring.js`: rule defaults and every point payment (wins, pao, nagashi, draws, chombo, final standings).
- `js/names.js`: every display name for yaku, dora, honor tiles, winds, and round labels, in all three languages. The analyzer returns yaku ids, never display text.
- `js/text.js`: all other interface text, in all three languages. Every language has the same keys.
- `js/analyzer.js`: turns a winning hand into yaku, fu, and han. It returns a clear error for an incomplete hand, a hand with no yaku, or impossible input (such as a 5th copy of a tile).

## Testing
- A `test.html` page runs the test suite in a browser. Nothing needs to be installed, but the page must be served over http (GitHub Pages, or a local server), since browsers block ES modules opened straight from a file.
- The scoring engine, hand analyzer, and game logic are tested before the UI that uses them is built.

## Progress
- Phases 1, 2, and 3 are complete, with all tests passing.
- Scott has reviewed and approved the display names in `js/names.js`.
- Next: phase 4.

## Phases
1. **Scoring engine:** han and fu to points, dealer and non-dealer payments, tsumo splits, honba, riichi sticks, draw tenpai payments, nagashi mangan, pao, chombo, 3-player payments, and final standings.
2. **Hand analyzer:** tiles to every valid reading, then yaku, fu, and han for each, keeping the best.
3. **Game tracker:** game setup, per-局 entry, live scoreboard, and editable round history.
4. **Hand entry screen:** the tile picker, which feeds the analyzer and engine.
5. **Results and stats:** per-player stats across all games, importing past history, and the view-only pages.
