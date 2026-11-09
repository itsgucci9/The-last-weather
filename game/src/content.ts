// Loads the handoff content (story, translations, art) at build time.
// Add a scene: edit data/story.json. Add art: drop an SVG in assets/ and reference its file name.
import manifestJson from '../asset-manifest.json';
import storyJson from '../data/story.json';
import { localizeStory, type StoryLocale } from './engine/localize';
import type { Story } from './engine/types';
import type { Lang } from './i18n/ui';

export const baseStory = storyJson as unknown as Story;

const localeModules = import.meta.glob<StoryLocale>('../data/locales/*.json', { eager: true, import: 'default' });
const locales: Partial<Record<Lang, StoryLocale>> = {};
for (const locale of Object.values(localeModules)) locales[locale.language as Lang] = locale;

const artModules = import.meta.glob<string>('../assets/*.svg', { eager: true, query: '?url', import: 'default' });
const artUrls: Record<string, string> = {};
for (const [file, url] of Object.entries(artModules)) artUrls[file.split('/').pop()!] = url;

const englishAlt: Record<string, string> = {};
for (const a of [...manifestJson.scenes, ...manifestJson.icons]) englishAlt[a.file.split('/').pop()!] = a.alt;

export function artUrl(file: string): string {
  const url = artUrls[file];
  if (!url) throw new Error(`Missing art file "${file}" in assets/`);
  return url;
}

export function artAlt(file: string, lang: Lang): string {
  return locales[lang]?.art?.[file] ?? englishAlt[file] ?? '';
}

const cache = new Map<Lang, Story>();
export function storyFor(lang: Lang): Story {
  let story = cache.get(lang);
  if (!story) {
    story = localizeStory(baseStory, lang === 'en' ? undefined : locales[lang]);
    cache.set(lang, story);
  }
  return story;
}
