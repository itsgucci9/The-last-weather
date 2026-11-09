// Structural checks for story data. Pure: the caller supplies asset names and locales.
import { explore } from './explore';
import { localeKeys, translatableKeys, type StoryLocale } from './localize';
import type { Condition, ConditionGroup, Effects, Story } from './types';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const OPS = new Set(['eq', 'gte', 'lte']);

export function validateStory(
  story: Story,
  options: { assets?: string[]; locales?: StoryLocale[]; ambiences?: readonly string[] } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const state = story.initialState;
  const sceneIds = new Set<string>();

  if (story.schemaVersion !== 1) errors.push(`Unsupported schemaVersion ${story.schemaVersion}`);

  for (const scene of story.scenes) {
    if (sceneIds.has(scene.id)) errors.push(`Duplicate scene id "${scene.id}"`);
    sceneIds.add(scene.id);
  }
  if (!sceneIds.has(story.initialScene)) errors.push(`initialScene "${story.initialScene}" does not exist`);
  // The unconditional fallback is gone: shelter is now decided by the player's state (Scene.shelter).
  if ('fallbackScene' in story) errors.push('fallbackScene is no longer supported: give safe scenes a "shelter" instead');

  const chapterIds = new Set<string>();
  for (const chapter of story.chapters ?? []) {
    if (chapterIds.has(chapter.id)) errors.push(`Duplicate chapter id "${chapter.id}"`);
    chapterIds.add(chapter.id);
    if (!chapter.title?.trim()) errors.push(`chapter "${chapter.id}": empty title`);
    if ('fallback' in chapter) errors.push(`chapter "${chapter.id}": fallback is no longer supported`);
  }
  if (story.chapters?.length) {
    for (const scene of story.scenes) {
      if (!scene.chapter && !scene.death) errors.push(`scene "${scene.id}": no chapter`);
      else if (scene.chapter && !chapterIds.has(scene.chapter)) errors.push(`scene "${scene.id}": unknown chapter "${scene.chapter}"`);
    }
    const first = story.scenes.find((s) => s.id === story.initialScene);
    if (first && first.chapter !== story.chapters[0].id) errors.push(`initialScene must be in the first chapter`);
  }

  for (const [field, rule] of Object.entries(story.stateRules)) {
    const value = state[field];
    if (typeof value !== 'number') errors.push(`stateRules.${field}: initialState value must be a number`);
    else if (value < rule.min || value > rule.max) errors.push(`initialState.${field}=${value} is outside ${rule.min}-${rule.max}`);
    if (rule.min > rule.max) errors.push(`stateRules.${field}: min is greater than max`);
    if (rule.icon && options.assets && !options.assets.includes(rule.icon)) errors.push(`stateRules.${field}: icon "${rule.icon}" not found`);
    if (rule.clock && (rule.lethal || rule.spend)) errors.push(`stateRules.${field}: a clock cannot also be lethal or spendable`);
    const cause = rule.lethal ?? rule.clock?.cause;
    if (cause && !story.scenes.some((s) => s.death === cause)) errors.push(`stateRules.${field}: no death scene for cause "${cause}"`);
  }
  const causes = new Set(Object.values(story.stateRules).flatMap((r) => [r.lethal, r.clock?.cause]).filter(Boolean) as string[]);
  if (!causes.size) warnings.push('No lethal meter or clock: nothing in this story can kill the player');
  for (const [field, rule] of Object.entries(story.flagRules ?? {})) {
    if (!(field in state)) errors.push(`flagRules.${field}: no such field in initialState`);
    if (rule.logFrom && !story.chapters?.some((c) => c.id === rule.logFrom)) errors.push(`flagRules.${field}.logFrom: unknown chapter "${rule.logFrom}"`);
    if (rule.values) {
      const initial = String(state[field]);
      if (!(initial in rule.values)) warnings.push(`flagRules.${field}: no display name for initial value "${initial}"`);
    }
  }
  // Checked after checkGroup is defined (below).
  const flagGroups = Object.entries(story.flagRules ?? {}).filter(([, rule]) => rule.hudWhen);

  const checkCondition = (c: Condition, where: string) => {
    if (!(c.field in state)) return errors.push(`${where}: unknown field "${c.field}"`);
    if (!OPS.has(c.op)) return errors.push(`${where}: unknown op "${c.op}"`);
    const initial = state[c.field];
    if (typeof initial !== typeof c.value) errors.push(`${where}: ${c.field} compares ${typeof initial} with ${typeof c.value}`);
    if ((c.op === 'gte' || c.op === 'lte') && typeof initial !== 'number') errors.push(`${where}: ${c.op} needs a numeric field`);
    const values = story.flagRules?.[c.field]?.values;
    if (values && typeof c.value === 'string' && !(c.value in values)) warnings.push(`${where}: no display name for ${c.field}="${c.value}"`);
  };
  const checkGroup = (group: ConditionGroup | undefined, where: string) => {
    if (!group) return;
    if (group.all && group.all.length === 0) errors.push(`${where}: empty "all" group`);
    if (group.any && group.any.length === 0) errors.push(`${where}: empty "any" group (it could never pass)`);
    group.all?.forEach((c, i) => checkCondition(c, `${where}.all[${i}]`));
    group.any?.forEach((c, i) => checkCondition(c, `${where}.any[${i}]`));
  };
  const checkEffects = (effects: Effects | undefined, where: string) => {
    if (!effects) return;
    for (const [field, delta] of Object.entries(effects.add ?? {})) {
      if (typeof state[field] !== 'number') errors.push(`${where}.add: "${field}" is not a numeric field`);
      if (typeof delta !== 'number') errors.push(`${where}.add.${field}: value must be a number`);
    }
    for (const [field, value] of Object.entries(effects.set ?? {})) {
      if (!(field in state)) errors.push(`${where}.set: unknown field "${field}"`);
      else if (typeof state[field] !== typeof value) errors.push(`${where}.set.${field}: expected ${typeof state[field]}`);
      const values = story.flagRules?.[field]?.values;
      if (values && typeof value === 'string' && !(value in values)) warnings.push(`${where}.set: no display name for ${field}="${value}"`);
    }
  };
  const checkArt = (art: string | undefined, where: string) => {
    if (!art) return errors.push(`${where}: missing art`);
    if (options.assets && !options.assets.includes(art)) errors.push(`${where}: art "${art}" not found in ${story.assetRoot}`);
  };

  for (const [field, rule] of flagGroups) checkGroup(rule.hudWhen, `flagRules.${field}.hudWhen`);
  for (const [field, rule] of Object.entries(story.stateRules)) {
    checkGroup(rule.hudWhen, `stateRules.${field}.hudWhen`);
    checkGroup(rule.clock?.activeWhen, `stateRules.${field}.clock.activeWhen`);
  }
  const EXPOSURES = ['sealed', 'exposed', 'storm'];
  const sceneById = new Map(story.scenes.map((s) => [s.id, s]));

  for (const scene of story.scenes) {
    const where = `scene "${scene.id}"`;
    if (scene.hint !== undefined && !scene.ending && !scene.chapterEnd) warnings.push(`${where}: hint is only shown for endings`);
    if (scene.ending && scene.chapterEnd) errors.push(`${where}: cannot be both an ending and a chapter end`);
    if (scene.ambience !== undefined && options.ambiences && !options.ambiences.includes(scene.ambience)) {
      errors.push(`${where}: unknown ambience "${scene.ambience}" (use ${options.ambiences.join(', ')})`);
    }
    checkArt(scene.art, where);
    if (!scene.text?.trim()) errors.push(`${where}: empty text`);
    const variantIds = new Set<string>();
    for (const v of scene.textVariants ?? []) {
      if (variantIds.has(v.id)) errors.push(`${where}: duplicate text variant "${v.id}"`);
      variantIds.add(v.id);
      checkGroup(v.conditions, `${where} variant "${v.id}"`);
    }
    if (scene.exposure !== undefined && !EXPOSURES.includes(scene.exposure)) errors.push(`${where}: unknown exposure "${scene.exposure}"`);
    if (scene.shelter !== undefined) {
      const target = sceneById.get(scene.shelter);
      if (!target) errors.push(`${where}: shelter "${scene.shelter}" does not exist`);
      else if ((target.exposure ?? 'sealed') !== 'sealed' || target.death) errors.push(`${where}: shelter "${scene.shelter}" must be a sealed, survivable scene`);
    }
    if (scene.death !== undefined) {
      if (!causes.has(scene.death)) warnings.push(`${where}: death cause "${scene.death}" is not used by any meter`);
      if (scene.ending || scene.chapterEnd) errors.push(`${where}: a death is neither an ending nor a chapter end`);
      if (scene.choices?.length) errors.push(`${where}: a death scene cannot have choices (the run is over)`);
      continue;
    }
    if (scene.ending) {
      if (scene.choices?.length) errors.push(`${where}: an ending cannot have choices`);
      continue;
    }
    if (!scene.choices?.length) errors.push(`${where}: not an ending but has no choices`);
    if (scene.exposure === undefined) errors.push(`${where}: say where the player is with "exposure" (sealed, exposed or storm)`);
    const choiceIds = new Set<string>();
    for (const choice of scene.choices ?? []) {
      const cw = `${where} choice "${choice.id}"`;
      if (choiceIds.has(choice.id)) errors.push(`${cw}: duplicate id`);
      choiceIds.add(choice.id);
      if (!sceneIds.has(choice.next)) errors.push(`${cw}: next scene "${choice.next}" does not exist`);
      if (choice.art) checkArt(choice.art, cw);
      if (choice.exposure !== undefined && !EXPOSURES.includes(choice.exposure)) errors.push(`${cw}: unknown exposure "${choice.exposure}"`);
      checkGroup(choice.conditions, cw);
      checkEffects(choice.effects, cw);
    }
  }

  if (errors.length === 0) {
    const report = explore(story);
    for (const d of report.deadEnds.slice(0, 10)) errors.push(`Dead end at "${d.sceneId}" with state ${JSON.stringify(d.state)}`);
    for (const s of report.stuck.slice(0, 10)) errors.push(`Stuck: "${s.sceneId}.${s.choiceId}" leads somewhere with nothing open (handled by ${s.result})`);
    for (const cause of causes) {
      if (![...report.deathPlaces.keys()].some((k) => k.startsWith(`${cause} @`))) warnings.push(`Death "${cause}" can never happen`);
    }
    for (const l of report.loops.slice(0, 10)) errors.push(`Loop: a run can come back to "${l.sceneId}" in the same state`);
    for (const scene of story.scenes) {
      if (!report.visitedScenes.has(scene.id)) warnings.push(`Scene "${scene.id}" is never reached`);
    }
    for (const [sceneId, choices] of report.choiceStats) {
      for (const [choiceId, s] of choices) {
        if (s.available === 0) warnings.push(`Choice "${sceneId}.${choiceId}" is never available`);
      }
    }
    for (const end of report.endStates) {
      for (const [field, rule] of Object.entries(story.stateRules)) {
        const v = end.state[field] as number;
        if (v < rule.min || v > rule.max) errors.push(`${field}=${v} escaped its limits`);
      }
    }
    for (const scene of story.scenes.filter((s) => s.ending)) {
      if (!report.endingCounts.get(scene.id)) warnings.push(`Ending "${scene.id}" is never reached`);
    }
  }

  const required = translatableKeys(story);
  for (const locale of options.locales ?? []) {
    const present = new Set(localeKeys(locale));
    const missing = required.filter((k) => !present.has(k));
    const extra = [...present].filter((k) => !required.includes(k));
    for (const k of missing) errors.push(`Locale "${locale.language}" is missing ${k}`);
    for (const k of extra) warnings.push(`Locale "${locale.language}" has unused key ${k}`);
  }

  return { errors, warnings };
}
