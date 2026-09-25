// Saving games. Finished games come from data.json on the site.
// Games entered on this device live in the browser until they are exported into data.json.

const GAMES_KEY = 'riichi.games';
const LANGUAGE_KEY = 'riichi.language';

function readLocal(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text === null ? fallback : JSON.parse(text);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function loadPublishedGames() {
  try {
    const response = await fetch('data.json', { cache: 'no-cache' });
    if (!response.ok) return [];
    return (await response.json()).games ?? [];
  } catch {
    return [];
  }
}

// Local games, minus finished ones that are already in data.json.
export function loadLocalGames(published) {
  const publishedIds = new Set(published.map((game) => game.id));
  const games = readLocal(GAMES_KEY, []).filter((game) => !publishedIds.has(game.id));
  writeLocal(GAMES_KEY, games);
  return games;
}

// Returns false if the browser refused to save.
export const saveLocalGames = (games) => writeLocal(GAMES_KEY, games);

export const loadLanguage = () => readLocal(LANGUAGE_KEY, 'jp');
export const saveLanguage = (language) => writeLocal(LANGUAGE_KEY, language);

// Downloads data.json holding every published game plus the given finished local games.
export function exportData(published, finishedLocal) {
  const games = [...published, ...finishedLocal].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  const blob = new Blob([JSON.stringify({ version: 1, games }, null, 2) + '\n'], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'data.json';
  link.click();
  URL.revokeObjectURL(link.href);
}
