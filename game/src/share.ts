// Sharing an ending: the phone's share sheet where available, otherwise the clipboard,
// otherwise the text is shown so the player can copy it by hand.

export const SITE_URL: string = import.meta.env.VITE_SITE_URL || 'https://the-last-weather.netlify.app/';

export type ShareResult = 'shared' | 'copied' | 'manual' | 'cancelled';

export async function shareText(title: string, text: string, url: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return 'cancelled';
      /* share sheet unavailable here (e.g. inside a frame): fall through to the clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'manual';
  }
}
