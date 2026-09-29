// Identity colors: each player's picked color, used for their column header and the winner strip.

// Players' picked colors, by name: 'Name': '#rrggbb'.
export const PLAYER_COLORS = {
  Scott: '#81c6e8',
  Allen: '#c8120a',
  Matt: '#fcdf1b',
  Daryl: '#b5a7d6',
  Rachel: '#fd96c1',
  James: '#4dd359',
  Mario: '#b6d7a8',
  Emily: '#faf673',
  Ben: '#ffa94d',
  // Rare players share white.
  Dave: '#ffffff',
  Rohit: '#ffffff',
  Kai: '#ffffff',
  Rick: '#ffffff',
};

// Placeholder colors by seat, for players not listed above.
const SEAT_COLORS = ['#1e88e5', '#e53935', '#43a047', '#fb8c00'];

export const DRAW_COLOR = '#9e9e9e';
export const CHOMBO_COLOR = '#000000';

export const playerColor = (name, seat) => PLAYER_COLORS[name] ?? SEAT_COLORS[seat];

// Black or white text, whichever reads better on a '#rrggbb' background.
export function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#ffffff';
}
