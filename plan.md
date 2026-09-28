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
- Each round stores its outcome (ron, tsumo, exhaustive draw, nagashi mangan, abortive draw, or chombo), who was involved, who declared riichi, the kind of an abortive draw, and the point change for every player. Point changes include riichi deposits and collected sticks.
- A round from a tapped-in hand also stores the hand: the hand tiles, winning tile, melds, dora and ura indicators, nuki-dora count, and the yaku toggles that were on. Riichi, ron or tsumo, and the winds come from the round and game, not the stored hand. Its han, fu, yakuman count, and pao are stored as well, and recalculating later rounds uses those, never a new reading of the hand.
- Current scores are the sum of all point changes. Dealer, honba, and riichi sticks are recalculated from the round list.
- Loading a game never recalculates its point changes, so changing rule settings or fixing the engine does not alter past games.
- Editing or deleting a round recalculates the point changes of every round after it from their entered details and the game's own rules, since their honba and sticks may have changed. Rounds without entered details (imported history) keep their recorded point changes.
- If an edit means the game should have ended earlier, the game screen says after which round, and Scott fixes or deletes the rounds after it.

## Display
- All text on screen follows a Japanese / romaji / English toggle. Japanese mode translates everything. Romaji mode is English except for mahjong terms, which are in romaji (Ryuukyoku, Houjuu, Genten, Kaeshi, Tobi, Tenpai, All Noten…). English mode keeps the usual mahjong terms (Ron, Tsumo, Riichi, Tenpai, Chombo). The app title stays "Riichi Tracker" in every mode. Riichi sticks on the table are 供託 in Japanese.
- Japanese yaku names use short forms where common (ツモ, 全帯, 一通).
- Round labels: 東2局 1本場 in Japanese, East 2 + 1 in romaji and English. The round table uses short labels: 東1+1 in Japanese, E1+1 in romaji and English. The honba part is left out at 0 honba.
- When riichi sticks carry over from earlier rounds, the round label shows a riichi stick icon and the count (× 2).
- Scores are shown as one tile per player, all in a single row in seat order. Each tile has the seat wind top left (東 in Japanese, E/S/W/N otherwise), the name top right, the score large in the middle, and at the bottom the final points the player would get if the game ended now. Each tile is tinted with the player's identity color. The dealer's tile is outlined.
- When the game is over, the same tiles are sorted by placement, with the place (1st, 2nd…) top left, the final score including leftover sticks, and final points. 1st place is outlined.
- Negative final points are shown with a triangle, like the spreadsheet: ▲17.3. Positive points show a plus sign: +53.3.

## Round table
- Right under the score tiles, a table builds up the game one row per round, oldest at the top. Viewers see the same table.
- Columns: the round, a thin winner strip, and one column per player in seat order.
- Round cell: the short round label. Under it, when riichi sticks carried into that round from earlier rounds, a riichi stick icon and the count; nothing when there are none.
- Winner strip: the winner's identity color for ron, tsumo, and nagashi mangan; gray for exhaustive and abortive draws; black for chombo.
- Player header: the player's name on their identity color. Identity colors appear only in the score tiles (as a tint), the headers, and the winner strip.
- Thin vertical lines separate the player columns.
- Identity colors are the colors the players picked, listed by name in `js/colors.js`. A player not listed gets a placeholder color by seat.
- Player cell: the whole payment for the hand, including honba, in large type. Under it, one small line holds a small riichi stick icon if the player declared riichi, then the riichi stick movement: −1,000 for the player's deposit, and the sticks the winner collects (this round's plus any carried over). The amount is left out when it is 0, and the line when there is nothing on it. In an exhaustive draw where everyone is tenpai or nobody is, the large 0 is replaced with a small gray Tenpai or Noten (テンパイ / ノーテン in Japanese). Imported rounds without entered details show their whole point change in large type.

## Round entry
- The table's last row is the entry row for the next round, on a light gray background to show it is active. It is hidden when the game is over and for viewers.
- Each player cell in the entry row has a Riichi toggle, shown as a riichi stick, available at every step. It is disabled for chombo, since chombo returns riichi sticks.
- A win is entered by tapping cells, with no Ron or Tsumo button: tap the winner's cell, then the cell of the player who dealt in for ron, or the winner's cell again for tsumo.
- Under the entry row are two buttons, Draw and Other. They are hidden once a winner is tapped; Back brings them back.
  - Draw (Ryuukyoku, 流局): the exhaustive draw. Players already marked riichi start out marked tenpai, as does anyone marked riichi afterward. Tap to change who is tenpai (nobody for all noten).
  - Other: Abortive draw, Nagashi Mangan, or Chombo. Abortive draw then asks for the kind (Kyuushu Kyuuhai, Suufon Renda, Suucha Riichi, Suukaikan); 3-player offers only Kyuushu Kyuuhai and Suukaikan, and Suucha Riichi needs every player marked riichi. Nagashi Mangan and Chombo then ask to tap the player.
  - Abortive draws and Nagashi Mangan are offered only when their rule switches are on.
- Once a win is picked, the hand entry screen opens (see "Hand entry"). The winner's cell is tagged Ron or Tsumo and the discarder's cell Fed (Houjuu in romaji, 放銃者 in Japanese).
- For draws and Other, once everything is picked, the entry row's cells preview the point changes, and Save records the round. Back clears the picks but keeps the riichi toggles.
- To fix a round, tap its round cell. That row turns into an entry row loaded with the round's details, with Save changes, Cancel, and Delete round (tap twice). A win reopens the hand entry screen; its Back returns to the row, where Cancel and Delete round are. The new-round entry row is hidden during an edit.

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
- The hand entry screen covers the whole game screen. Its top line shows the round, the winner with Ron or Tsumo, and who dealt in on the left, and two tabs on the right: Tiles (selected first) and Han/Fu.
- Tiles tab:
  - The picker has one row per suit (man, pin, sou, honors), with red 5m, 5p, and 5s buttons beside the regular fives. 3-player leaves out 2m–8m. A button is grayed out once all its copies are used across the hand, melds, and indicators: 4 of each tile, 3 regular fives, and 1 red five per suit.
  - The hand, melds, and indicators are left-aligned; the mode buttons and the picker are centered.
  - Mode buttons above the picker: Hand, Chi, Pon, Kan, and Closed kan. In Hand, each tap adds a tile. The hand holds 14 tiles minus 3 per meld, and the last tile tapped is the winning tile, shown apart from the rest. In Chi, Pon, Kan, and Closed kan, one tap places the whole meld (chi takes its lowest tile), then the mode goes back to Hand. A kan of 5s always includes the red five. While the winner is in riichi, Chi, Pon, and Kan are disabled (Closed kan stays); turning riichi on with a call already placed shows the "Riichi needs a closed hand" message.
  - With one hand tile left to tap, picker tiles that can't complete a winning shape are faded but still tappable. Yaku don't count here, since toggles and dora can still change them.
  - Tapping a hand tile removes it. Holding one makes it the winning tile once the hand is full.
  - Melds show without a label. A closed kan shows as a dark green face-down tile at each end. Each meld has a ✕ that removes it; tapping a 5 inside a chi or pon switches it between red and regular.
  - Dora and Ura share one line. Each label is a button that points the picker at its indicators; each tap then adds one, and tapping an indicator removes it. Dora holds up to 4 indicators, and Ura no more than Dora. Dora and ura pair up by position: removing one always leaves a dark green face-down placeholder, the other row keeps its tile, and the next tap in that row fills the placeholder. Tapping a placeholder drops that whole position, dora and ura both. Ura appears only when the winner is in riichi. Save needs at least one dora indicator and, when the winner is in riichi, as many ura indicators as dora. Once the hand is full, a missing dora indicator, then a missing ura, takes over the picker so the next tap fills it, and its button shows as selected.
  - 3-player has a North dora counter with − and +.
  - Toggles for yaku the tiles can't show. Riichi is always there and is the winner's riichi toggle from the entry row, so turning it on or off here changes that toggle too. The rest are offered only where they can apply: double riichi and ippatsu when the winner is in riichi; haitei, rinshan (once a kan is placed), and tenhou (dealer) or chihou (non-dealer) for tsumo; houtei and chankan for ron.
  - Ron or tsumo comes from how the cells were tapped, and the seat and round winds from the game; neither is a toggle here.
  - Once the hand is complete, the screen lists each yaku with its han, then the total han, fu, and limit, or the yakuman count. A problem with the hand (incomplete, no yaku, impossible input) shows as a message instead.
  - Once the hand scores, the mode buttons, picker, nuki-dora counter, and yaku toggles hide, leaving the hand, melds, Dora/Ura line, yaku list, and preview. They come back when a hand tile is removed or Dora or Ura is tapped, and hide again after the next indicator or tile is added if the hand still scores.
  - When a hand can be read more than one way, the app uses the highest-scoring reading.
  - The pao picker appears only when the hand has daisangen, daisuushii, or suukantsu, and covers those yakuman.
- Han/Fu tab, for hands nobody remembers tile by tile: typed Han and Fu boxes and a Yakuman button, centered. Fu is hidden at 5 han or more. Save needs a possible fu: 20, 25, or 30 to 110 in tens, and at least 30 at 1 han. Each tap on Yakuman adds one yakuman (Yakuman, Double Yakuman, and so on up to 6, then back to Yakuman). While yakuman is on, the pao picker shows beside the Yakuman button, and typing in the Han or Fu box switches back to han and fu.
- The bottom of the screen previews each player's point change, with Back and Save round (Save changes when editing). The tab showing at Save decides what is saved: from Tiles, the hand and what it scores; from Han/Fu, the typed values and no hand.
- Back closes the screen and clears the win picks, but keeps the riichi toggles and any tapped-in tiles.
- Editing a round saved from tiles opens the Tiles tab loaded with its hand; a round saved from han and fu opens the Han/Fu tab.

## Code
- `index.html`, `css/style.css`, `js/app.js`: the page. Home (game lists and export), game setup, and the game screen (score tiles, and the round table with its entry row and round editing). The hand entry screen is in `js/handview.js`. Every change re-renders the view from the data.
- `js/game.js`: round progression, riichi sticks, honba, when a game ends, and recalculating rounds after an edit.
- `js/colors.js`: each player's identity color, and the draw and chombo strip colors.
- `js/store.js`: loading `data.json`, saving games in the browser, and exporting `data.json`.
- `js/tiles.js`: tile notation and helpers. Tiles are written `1m`–`9m`, `1p`–`9p`, `1s`–`9s`, and `1z`–`7z` (East, South, West, North, Haku, Hatsu, Chun); a red five is `0m`, `0p`, or `0s`.
- `js/scoring.js`: rule defaults and every point payment (wins, pao, nagashi, draws, chombo, final standings).
- `js/names.js`: every display name for yaku, dora, honor tiles, winds, and round labels, in all three languages. The analyzer returns yaku ids, never display text.
- `js/text.js`: all other interface text, in all three languages. Every language has the same keys.
- `js/analyzer.js`: turns a winning hand into yaku, fu, and han. For an incomplete hand, a hand with no yaku, or impossible input (such as a 5th copy of a tile), it returns an error id, never display text; `js/text.js` has the message for each id.
- `js/hand.js`: the hand entry screen's pure logic: which picker tiles are still available, placing melds, and turning a stored hand into analyzer input.
- `js/handview.js`: the hand entry screen's view and its actions.

## Testing
- A `test.html` page runs the test suite in a browser. Nothing needs to be installed, but the page must be served over http (GitHub Pages, or a local server), since browsers block ES modules opened straight from a file.
- The scoring engine, hand analyzer, and game logic are tested before the UI that uses them is built.

## Progress
- Phases 1, 2, and 3 are complete, with all tests passing.
- Scott has reviewed and approved the display names in `js/names.js`.
- Phase 4 is built, with all tests passing. Next: Scott tries it on his phone, then phase 5.

## Phases
1. **Scoring engine:** han and fu to points, dealer and non-dealer payments, tsumo splits, honba, riichi sticks, draw tenpai payments, nagashi mangan, pao, chombo, 3-player payments, and final standings.
2. **Hand analyzer:** tiles to every valid reading, then yaku, fu, and han for each, keeping the best.
3. **Game tracker:** game setup, per-局 entry, live scoreboard, and editable round history.
4. **Hand entry screen:** the tile picker, which feeds the analyzer and engine.
5. **Results and stats:** per-player stats across all games, importing past history, and the view-only pages.
