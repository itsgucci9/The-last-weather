// Local save. localStorage works in browsers and inside Capacitor's WebView; every call is
// guarded because some browsers (private modes, embedded frames) throw on access.

const PREFIX = 'the-last-weather:';
export const KEYS = {
  run: `${PREFIX}run:v1`,
  settings: `${PREFIX}settings:v1`,
  endings: `${PREFIX}endings:v1`,
  deaths: `${PREFIX}deaths:v1`,
  tutorial: `${PREFIX}tutorial:v1`,
} as const;

export function storageAvailable(): boolean {
  try {
    const probe = `${PREFIX}probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game keeps running from memory */
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
