// Progressive disclosure: what the player is shown, and when. Pure functions (no React), so the
// rules can be tested. The game starts with only what the first decision needs, and each new
// meter or item appears the first time it matters.
import { conditionsPass, exposureOf, getScene, isDeath } from '../engine/engine';
import type { ConditionGroup, Exposure, Scene, Session, Story } from '../engine/types';

function groupFields(group: ConditionGroup | undefined): string[] {
  return [...(group?.all ?? []), ...(group?.any ?? [])].map((c) => c.field);
}

/** Fields a scene's choices read or change. */
export function sceneFields(scene: Scene): Set<string> {
  const out = new Set<string>();
  for (const choice of scene.choices ?? []) {
    for (const f of Object.keys(choice.effects?.add ?? {})) out.add(f);
    for (const f of Object.keys(choice.effects?.set ?? {})) out.add(f);
    for (const f of groupFields(choice.conditions)) out.add(f);
  }
  return out;
}

export interface Reveal {
  /** Meters to show now, in stateRules order. */
  meters: string[];
  /** Meters shown for the first time in this scene (get a "New" badge and a tip). */
  fresh: string[];
}

/**
 * A meter appears once a scene the player has been in (or is in) uses it, and stays. On the very
 * first scene nothing is "new": the guided tour introduces what is there.
 */
export function revealMeters(story: Story, session: Session): Reveal {
  const before = new Set<string>();
  for (const step of session.history) for (const f of sceneFields(getScene(story, step.sceneId))) before.add(f);
  const now = new Set([...before, ...sceneFields(getScene(story, session.sceneId))]);
  const visible = (field: string) => conditionsPass(story.stateRules[field].hudWhen, session.state);
  const meters = Object.keys(story.stateRules).filter((f) => now.has(f) && visible(f));
  const fresh = session.history.length === 0 ? [] : meters.filter((f) => !before.has(f));
  return { meters, fresh };
}

/** A status line (e.g. MICA's memory) is shown once it has changed, or when this scene depends on it. */
export function showStatusFlag(story: Story, session: Session, field: string): boolean {
  const rule = story.flagRules?.[field];
  if (!rule || !conditionsPass(rule.hudWhen, session.state)) return false;
  if (session.state[field] !== story.initialState[field]) return true;
  const scene = getScene(story, session.sceneId);
  return (scene.choices ?? []).some((c) => groupFields(c.conditions).includes(field));
}

/** What kind of place the player is in, when it matters for survival (null: nothing to worry about). */
export function placeKind(story: Story, session: Session): Exposure | null {
  const scene = getScene(story, session.sceneId);
  if (scene.ending || isDeath(scene) || scene.chapterEnd) return null;
  const exposure = exposureOf(scene);
  if (exposure !== 'sealed') return exposure;
  // Sealed is only worth saying while the storm clock is running (on Vesper-6).
  const clockRunning = Object.values(story.stateRules).some((r) => r.clock && conditionsPass(r.clock.activeWhen, session.state));
  return clockRunning ? 'sealed' : null;
}
