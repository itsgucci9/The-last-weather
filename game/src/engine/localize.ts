// Story translations live in data/locales/<lang>.json as overlays keyed by scene and choice ids.
// English text stays in data/story.json; an overlay only replaces strings, never logic.
import type { Story } from './types';

export interface SceneLocale {
  title?: string;
  location?: string;
  text?: string;
  hint?: string;
  choices?: Record<string, { label?: string; detail?: string }>;
  variants?: Record<string, string>;
}

export interface StoryLocale {
  language: string;
  /** Chapter titles by chapter id. */
  chapters?: Record<string, string>;
  stateRules?: Record<string, string>;
  flagRules?: Record<string, { label?: string; values?: Record<string, string> }>;
  scenes?: Record<string, SceneLocale>;
  /** Alt text for art files, keyed by file name (English comes from asset-manifest.json). */
  art?: Record<string, string>;
}

export function localizeStory(story: Story, locale: StoryLocale | undefined): Story {
  if (!locale) return story;
  const stateRules = Object.fromEntries(
    Object.entries(story.stateRules).map(([field, rule]) => [field, { ...rule, label: locale.stateRules?.[field] ?? rule.label }]),
  );
  const flagRules = story.flagRules
    ? Object.fromEntries(
        Object.entries(story.flagRules).map(([field, rule]) => {
          const t = locale.flagRules?.[field];
          return [
            field,
            {
              ...rule,
              label: t?.label ?? rule.label,
              ...(rule.values ? { values: { ...rule.values, ...(t?.values ?? {}) } } : {}),
            },
          ];
        }),
      )
    : undefined;
  const scenes = story.scenes.map((scene) => {
    const t = locale.scenes?.[scene.id];
    if (!t) return scene;
    return {
      ...scene,
      title: t.title ?? scene.title,
      ...(scene.location !== undefined ? { location: t.location ?? scene.location } : {}),
      text: t.text ?? scene.text,
      ...(scene.hint !== undefined ? { hint: t.hint ?? scene.hint } : {}),
      ...(scene.textVariants
        ? { textVariants: scene.textVariants.map((v) => ({ ...v, text: t.variants?.[v.id] ?? v.text })) }
        : {}),
      ...(scene.choices
        ? {
            choices: scene.choices.map((c) => {
              const tc = t.choices?.[c.id];
              return {
                ...c,
                label: tc?.label ?? c.label,
                ...(c.detail !== undefined ? { detail: tc?.detail ?? c.detail } : {}),
              };
            }),
          }
        : {}),
    };
  });
  const chapters = story.chapters?.map((c) => ({ ...c, title: locale.chapters?.[c.id] ?? c.title }));
  return { ...story, stateRules, ...(flagRules ? { flagRules } : {}), ...(chapters ? { chapters } : {}), scenes };
}

/** Every translatable string path in the story, e.g. "scenes.impact.choices.restore_memory.label". */
export function translatableKeys(story: Story): string[] {
  const keys: string[] = [];
  for (const chapter of story.chapters ?? []) keys.push(`chapters.${chapter.id}`);
  for (const field of Object.keys(story.stateRules)) keys.push(`stateRules.${field}`);
  for (const [field, rule] of Object.entries(story.flagRules ?? {})) {
    keys.push(`flagRules.${field}.label`);
    for (const value of Object.keys(rule.values ?? {})) keys.push(`flagRules.${field}.values.${value}`);
  }
  for (const scene of story.scenes) {
    const base = `scenes.${scene.id}`;
    keys.push(`${base}.title`, `${base}.text`);
    if (scene.location !== undefined) keys.push(`${base}.location`);
    if (scene.hint !== undefined) keys.push(`${base}.hint`);
    for (const v of scene.textVariants ?? []) keys.push(`${base}.variants.${v.id}`);
    for (const c of scene.choices ?? []) {
      keys.push(`${base}.choices.${c.id}.label`);
      if (c.detail !== undefined) keys.push(`${base}.choices.${c.id}.detail`);
    }
  }
  return keys;
}

/** Every string path present in a locale overlay. */
export function localeKeys(locale: StoryLocale): string[] {
  const keys: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') keys.push(path);
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };
  walk({ chapters: locale.chapters, stateRules: locale.stateRules, flagRules: locale.flagRules, scenes: locale.scenes }, '');
  return keys;
}
