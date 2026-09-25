// Tile notation and helpers.
// A tile is written as a number plus a suit letter: '1m'..'9m', '1p'..'9p', '1s'..'9s',
// and honors '1z'..'7z' (East, South, West, North, Haku, Hatsu, Chun).
// A red five is written with 0: '0m', '0p', '0s'.
//
// Internally each tile kind has an index 0..33:
// man 0-8, pin 9-17, sou 18-26, honors 27-33.

export const EAST = 27;
export const NORTH = 30;
export const HAKU = 31;
export const HATSU = 32;
export const CHUN = 33;

const SUITS = ['m', 'p', 's', 'z'];
const HONOR_NAMES = ['East', 'South', 'West', 'North', 'Haku', 'Hatsu', 'Chun'];

// '0p' -> { index: 13, red: true }
export function parseTile(text) {
  const match = /^([0-9])([mpsz])$/.exec(text);
  if (!match) throw new Error(`Not a tile: ${text}`);
  const number = Number(match[1]);
  const suit = SUITS.indexOf(match[2]);
  const red = number === 0;
  if (red && suit === 3) throw new Error(`Not a tile: ${text}`);
  if (suit === 3 && number > 7) throw new Error(`Not a tile: ${text}`);
  return { index: suit * 9 + (red ? 5 : number) - 1, red };
}

// 13 -> '5p'
export function tileText(index) {
  return `${(index % 9) + 1}${SUITS[Math.floor(index / 9)]}`;
}

// Short notation for writing hands: '123m055p77z' -> ['1m','2m','3m','0p','5p','5p','7z','7z']
export function tiles(notation) {
  const result = [];
  let digits = '';
  for (const char of notation.replace(/\s/g, '')) {
    if (/[0-9]/.test(char)) {
      digits += char;
    } else {
      for (const digit of digits) result.push(`${digit}${char}`);
      digits = '';
    }
  }
  if (digits) throw new Error(`Missing suit letter in: ${notation}`);
  return result;
}

export const isHonor = (index) => index >= 27;
export const isTerminal = (index) => !isHonor(index) && (index % 9 === 0 || index % 9 === 8);
export const isTerminalOrHonor = (index) => isHonor(index) || isTerminal(index);
export const isDragon = (index) => index >= HAKU;
export const isWind = (index) => index >= EAST && index <= NORTH;
export const suitOf = (index) => Math.floor(index / 9);

export function honorName(index) {
  return HONOR_NAMES[index - EAST];
}

// The dora is the tile after the indicator. Winds and dragons each wrap around.
// In 3-player, 2m-8m are removed, so 1m indicates 9m and 9m indicates 1m.
export function doraFromIndicator(index, players) {
  if (isWind(index)) return index === NORTH ? EAST : index + 1;
  if (isDragon(index)) return index === CHUN ? HAKU : index + 1;
  if (players === 3 && suitOf(index) === 0) return index === 0 ? 8 : 0;
  return index % 9 === 8 ? index - 8 : index + 1;
}

// Tiles that do not exist in 3-player (2m-8m).
export const isRemovedIn3p = (index) => index >= 1 && index <= 7;
