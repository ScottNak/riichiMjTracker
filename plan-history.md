# Mahjong Scoring and Game Tracker — History

Why things are the way they are. Current rules live in [plan.md](plan.md).

- **Static `data.json` instead of a live database** (see "Data flow"). A hosted database would let viewers watch games live, but it adds an account, API keys, and an outside service. Committing a JSON file after each game was chosen as the simpler, more reliable option.
- **Rounds store point changes, not just the hand** (see "Data model"). Past history being imported only has point transfers per round, so point changes are the one format both old and new games share. Storing them also means a rule change or engine fix can never silently rewrite old results.
- **Tile-tap entry instead of typing han and fu** (see "Hand entry"). Scott prefers entering the actual hand, accepting that the hand analyzer is the largest part of the build.
- **Deliberate differences from M-League** (see "Default rules"). M-League has no kazoe yakuman, nagashi mangan, or abortive draws; counts only combined yakuman as double; and splits tied placements evenly. Scott's group plays with kazoe yakuman, nagashi mangan, abortive draws, the four named double yakuman, and seat-order tiebreaks. Don't "fix" these to match M-League.
