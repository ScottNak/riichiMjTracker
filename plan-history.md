# Mahjong Scoring and Game Tracker — History

Why things are the way they are. Current rules live in [plan.md](plan.md).

- **Static `data.json` instead of a live database** (see "Data flow"). A hosted database would let viewers watch games live, but it adds an account, API keys, and an outside service. Committing a JSON file after each game was chosen as the simpler, more reliable option.
- **Rounds store point changes, not just the hand** (see "Data model"). Past history being imported only has point transfers per round, so point changes are the one format both old and new games share. Storing them also means a rule change or engine fix can never silently rewrite old results.
- **Edits recalculate the rounds after them** (see "Data model"). This is not a conflict with the rule above: fixing an earlier round changes the honba and riichi sticks every later round started with, so their stored payments would otherwise be wrong.
- **Tile-tap entry instead of typing han and fu** (see "Hand entry"). Scott prefers entering the actual hand, accepting that the hand analyzer is the largest part of the build.
- **Han and fu entry stays after tile entry is built** (see "Hand entry"). It is the fallback for hands nobody remembers tile by tile. Don't remove it in phase 4.
- **Deliberate differences from M-League** (see "Default rules"). M-League has no kazoe yakuman, nagashi mangan, or abortive draws; counts only combined yakuman as double; and splits tied placements evenly. Scott's group plays with kazoe yakuman, nagashi mangan, abortive draws, the four named double yakuman, and seat-order tiebreaks. Don't "fix" these to match M-League.
- **Honba is part of the large payment in the round table** (see "Round table"). Scott wants everything paid for the hand in the large number; only riichi sticks go on the small line under it. Don't split honba out.
- **No Ron or Tsumo buttons** (see "Round entry"). Scott first listed Ron and Tsumo buttons, then chose tapping alone: the two tap patterns can't be confused, and the cell tags and point preview show the result before Save. Don't add the buttons back.
- **The exhaustive draw is labeled 流局, not 荒牌平局** (see "Round entry"). 流局 is what players say; abortive draws sit under Other, so the label isn't ambiguous.
- **Yakuman has its own button instead of typing 13/26/39 han** (see "Round entry"). 13+ typed han is a counted (kazoe) yakuman: it never becomes a double, pao doesn't apply, and it drops to sanbaiman with kazoe off. A real yakuman must stay distinguishable from it.
