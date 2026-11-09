// Platform-independent scene and choice engine. Pure functions, no DOM, no randomness.
import type {
  Chapter,
  Checkpoint,
  Choice,
  ChoiceView,
  Condition,
  ConditionGroup,
  Effects,
  Exposure,
  GameState,
  Outcome,
  OutcomeItem,
  Resolution,
  Risk,
  Scene,
  Session,
  Shortfall,
  StateRule,
  Story,
  TextVariant,
  Value,
} from './types';

export function getScene(story: Story, id: string): Scene {
  const scene = story.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown scene "${id}"`);
  return scene;
}

export function hasScene(story: Story, id: string): boolean {
  return story.scenes.some((s) => s.id === id);
}

export function evaluateCondition(condition: Condition, state: GameState): boolean {
  if (!(condition.field in state)) return false;
  const current = state[condition.field];
  switch (condition.op) {
    case 'eq':
      return current === condition.value;
    case 'gte':
      return typeof current === 'number' && typeof condition.value === 'number' && current >= condition.value;
    case 'lte':
      return typeof current === 'number' && typeof condition.value === 'number' && current <= condition.value;
    default:
      return false;
  }
}

/** all: every item must pass. any: at least one must pass. Both groups must pass when both are present. */
export function conditionsPass(group: ConditionGroup | undefined, state: GameState): boolean {
  if (!group) return true;
  const allOk = group.all ? group.all.every((c) => evaluateCondition(c, state)) : true;
  const anyOk = group.any ? group.any.some((c) => evaluateCondition(c, state)) : true;
  return allOk && anyOk;
}

export function clampValue(value: number, rule: StateRule | undefined): number {
  if (!rule) return value;
  return Math.min(rule.max, Math.max(rule.min, value));
}

export function applyEffects(state: GameState, effects: Effects | undefined, rules: Record<string, StateRule>): GameState {
  const next: GameState = { ...state };
  if (!effects) return next;
  for (const [field, delta] of Object.entries(effects.add ?? {})) {
    const current = next[field];
    if (typeof current !== 'number') throw new Error(`Cannot add to non-numeric field "${field}"`);
    next[field] = clampValue(current + delta, rules[field]);
  }
  for (const [field, value] of Object.entries(effects.set ?? {})) {
    next[field] = typeof value === 'number' ? clampValue(value, rules[field]) : value;
  }
  return next;
}

// ---------- Survival rules ----------
// Every rule below is deterministic and depends only on the current state, so the interface can
// show the exact result of a choice (including death) before the player commits.

export function exposureOf(scene: Scene): Exposure {
  return scene.exposure ?? 'sealed';
}

/** Where a choice's action happens. */
export function actionExposure(scene: Scene, choice: Choice): Exposure {
  return choice.exposure ?? exposureOf(scene);
}

export function isDeath(scene: Scene): boolean {
  return typeof scene.death === 'string';
}

/** The run is over: a final ending or a death. */
export function isTerminal(scene: Scene): boolean {
  return isEnding(scene) || isDeath(scene);
}

export function deathScene(story: Story, cause: string): Scene {
  const scene = story.scenes.find((s) => s.death === cause);
  if (!scene) throw new Error(`No death scene for cause "${cause}"`);
  return scene;
}

function activeClocks(story: Story, state: GameState): [string, StateRule][] {
  return Object.entries(story.stateRules).filter(([, rule]) => rule.clock && conditionsPass(rule.clock.activeWhen, state));
}

/** True when a running clock has reached its minimum (the storm has arrived). */
export function clockOut(story: Story, state: GameState): boolean {
  return activeClocks(story, state).some(([field, rule]) => (state[field] as number) <= rule.min);
}

function rawAfter(state: GameState, effects: Effects | undefined): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [field, delta] of Object.entries(effects?.add ?? {})) {
    const value = state[field];
    if (typeof value === 'number') raw[field] = value + delta;
  }
  return raw;
}

/**
 * Costs the player cannot pay. Costs are never silently clamped: a spendable meter (salvage),
 * or a lethal meter spent in a sealed place, locks the choice when the cost exceeds what is left.
 * (Spent outside, a lethal meter reaching zero is a death instead, shown as a risk.)
 */
export function shortfallsOf(story: Story, scene: Scene, choice: Choice, state: GameState): Shortfall[] {
  const exposure = actionExposure(scene, choice);
  const out: Shortfall[] = [];
  for (const [field, value] of Object.entries(rawAfter(state, choice.effects))) {
    const rule = story.stateRules[field];
    if (!rule || value >= rule.min) continue;
    if (rule.spend || (rule.lethal && exposure === 'sealed')) {
      out.push({ field, need: (state[field] as number) - value + rule.min, have: state[field] as number });
    }
  }
  return out;
}

function lethalRisk(story: Story, state: GameState, raw: Record<string, number>, at: 'action' | 'arrival'): Risk | null {
  // Checked in stateRules order (oxygen, then suit), then the storm clock.
  for (const [field, rule] of Object.entries(story.stateRules)) {
    if (!rule.lethal) continue;
    const value = raw[field] ?? state[field];
    if (typeof value === 'number' && value <= rule.min) return { kind: 'death', cause: rule.lethal, field, at };
  }
  for (const [field, rule] of activeClocks(story, state)) {
    if ((state[field] as number) <= rule.min) return { kind: 'death', cause: rule.clock!.cause, field, at };
  }
  return null;
}

/** Why someone with no way forward outside dies: an empty meter if there is one, else exposure. */
function strandedRisk(story: Story, state: GameState): Risk {
  const risk = lethalRisk(story, state, {}, 'arrival');
  if (risk && risk.kind === 'death') return { ...risk, at: 'stuck' };
  const [field, rule] = Object.entries(story.stateRules).find(([, r]) => r.lethal)!;
  return { kind: 'death', cause: rule.lethal!, field, at: 'stuck' };
}

/** A choice the player can take now: its conditions pass and every cost can be paid. */
export function isOpen(story: Story, scene: Scene, choice: Choice, state: GameState): boolean {
  return conditionsPass(choice.conditions, state) && shortfallsOf(story, scene, choice, state).length === 0;
}

export function availableChoices(story: Story, scene: Scene, state: GameState): Choice[] {
  return (scene.choices ?? []).filter((choice) => isOpen(story, scene, choice, state));
}

/**
 * The exact result of taking a choice (assumes it is open). In order:
 * 1. During the action, if it happens outside: an empty Oxygen or Suit meter, or the storm
 *    clock at zero, kills. If it happens in a sealed place that has a shelter and the clock runs
 *    out during it, the storm forces the player into the shelter.
 * 2. On arriving somewhere outside: the same lethal checks. Arriving in a sealed place with a
 *    shelter after the storm has come: forced shelter.
 * 3. If nothing is open where the player arrives: shelter when sealed and a shelter exists,
 *    otherwise the death that fits the state. (There is no unconditional fallback.)
 */
export function resolveChoice(story: Story, scene: Scene, choice: Choice, before: GameState): Resolution {
  const exposure = actionExposure(scene, choice);
  const raw = rawAfter(before, choice.effects);
  const state = applyEffects(before, choice.effects, story.stateRules);
  const shortfalls = shortfallsOf(story, scene, choice, before);
  const result = (sceneId: string, risk: Risk | null): Resolution => ({ sceneId, state, risk, shortfalls, exposure });
  const dest = getScene(story, choice.next);

  if (exposure !== 'sealed') {
    const risk = lethalRisk(story, state, raw, 'action');
    if (risk?.kind === 'death') return result(deathScene(story, risk.cause).id, risk);
  } else if (scene.shelter && choice.next !== scene.shelter && !clockOut(story, before) && clockOut(story, state)) {
    return result(scene.shelter, { kind: 'shelter', reason: 'storm' });
  }

  if (isTerminal(dest)) return result(dest.id, null);
  const arrival = exposureOf(dest);
  if (arrival !== 'sealed') {
    const risk = lethalRisk(story, state, {}, 'arrival');
    if (risk?.kind === 'death') return result(deathScene(story, risk.cause).id, risk);
  } else if (dest.shelter && clockOut(story, state)) {
    return result(dest.shelter, { kind: 'shelter', reason: 'storm' });
  }

  if (availableChoices(story, dest, state).length === 0) {
    if (arrival === 'sealed' && dest.shelter) return result(dest.shelter, { kind: 'shelter', reason: 'stuck' });
    const risk = strandedRisk(story, state);
    return result(deathScene(story, (risk as { cause: string }).cause).id, risk);
  }
  return result(dest.id, null);
}

export function viewChoice(story: Story, scene: Scene, choice: Choice, state: GameState): ChoiceView {
  const group = choice.conditions;
  const unmetAll = (group?.all ?? []).filter((c) => !evaluateCondition(c, state));
  const anyFailed = group?.any ? !group.any.some((c) => evaluateCondition(c, state)) : false;
  const conditionsOk = unmetAll.length === 0 && !anyFailed;
  const shortfalls = shortfallsOf(story, scene, choice, state);
  return {
    choice,
    available: conditionsOk && shortfalls.length === 0,
    unmetAll,
    unmetAny: anyFailed && group?.any ? group.any : null,
    shortfalls,
    resolution: conditionsOk ? resolveChoice(story, scene, choice, state) : null,
  };
}

/** Choices to display for a scene: open ones and locked ones (unless hideWhenLocked). Empty once the run is over. */
export function getChoiceViews(story: Story, scene: Scene, state: GameState): ChoiceView[] {
  if (isTerminal(scene)) return [];
  return (scene.choices ?? [])
    .map((choice) => viewChoice(story, scene, choice, state))
    .filter((view) => view.available || !view.choice.hideWhenLocked);
}

export function activeVariants(scene: Scene, state: GameState): TextVariant[] {
  return (scene.textVariants ?? []).filter((v) => conditionsPass(v.conditions, state));
}

/** A final ending: the run is over. */
export function isEnding(scene: Scene): boolean {
  return scene.ending === true;
}

/** Closes a chapter; the run continues through its choice. */
export function isChapterEnd(scene: Scene): boolean {
  return scene.chapterEnd === true;
}

/** Endings and chapter ends: the outcomes recorded in the endings gallery. */
export function isOutcomeScene(scene: Scene): boolean {
  return isEnding(scene) || isChapterEnd(scene);
}

export function chapterOf(story: Story, sceneId: string): Chapter | undefined {
  const id = getScene(story, sceneId).chapter;
  return id ? story.chapters?.find((c) => c.id === id) : undefined;
}

/** 1-based chapter number, or 0 when the story has no chapters. */
export function chapterNumber(story: Story, chapterId: string | undefined): number {
  return chapterId ? (story.chapters?.findIndex((c) => c.id === chapterId) ?? -1) + 1 : 0;
}

export function createSession(story: Story): Session {
  const state: GameState = { ...story.initialState };
  for (const [field, rule] of Object.entries(story.stateRules)) {
    const value = state[field];
    if (typeof value === 'number') state[field] = clampValue(value, rule);
  }
  const chapter = chapterOf(story, story.initialScene);
  return {
    sceneId: story.initialScene,
    state,
    history: [],
    ...(chapter ? { checkpoints: { [chapter.id]: { sceneId: story.initialScene, state, historyLength: 0 } } } : {}),
  };
}

function diffState(story: Story, before: GameState, after: GameState): OutcomeItem[] {
  const items: OutcomeItem[] = [];
  for (const field of Object.keys(story.stateRules)) {
    const a = before[field];
    const b = after[field];
    if (typeof a === 'number' && typeof b === 'number' && a !== b) items.push({ kind: 'stat', field, delta: b - a });
  }
  for (const [field, rule] of Object.entries(story.flagRules ?? {})) {
    if (!rule.hud) continue;
    if (before[field] !== after[field]) items.push({ kind: 'flag', field, value: after[field] });
  }
  return items;
}

/**
 * Applies a choice and moves to where it leads: the next scene, a shelter, or a death scene (see
 * resolveChoice). Throws if the run is over, or if the choice is unknown or locked. Entering a
 * new chapter records a checkpoint so the chapter can be replayed.
 */
export function choose(story: Story, session: Session, choiceId: string): Session {
  const scene = getScene(story, session.sceneId);
  if (isTerminal(scene)) throw new Error(`The run is over ("${scene.id}"): start again`);
  const choice = (scene.choices ?? []).find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Unknown choice "${choiceId}" in scene "${scene.id}"`);
  if (!isOpen(story, scene, choice, session.state)) throw new Error(`Choice "${choiceId}" is locked`);

  const { sceneId: nextId, state, risk } = resolveChoice(story, scene, choice, session.state);
  const history = [...session.history, { sceneId: scene.id, choiceId }];
  let checkpoints = session.checkpoints;
  const nextChapter = getScene(story, nextId).chapter;
  if (nextChapter && nextChapter !== scene.chapter) {
    checkpoints = { ...checkpoints, [nextChapter]: { sceneId: nextId, state, historyLength: history.length } };
  }

  const outcome: Outcome = {
    choiceId,
    fromSceneId: scene.id,
    items: diffState(story, session.state, state),
    ...(risk?.kind === 'death' ? { death: { cause: risk.cause, at: risk.at === 'action' ? scene.id : choice.next, how: risk.at } } : {}),
    ...(risk?.kind === 'shelter' ? { shelter: risk.reason } : {}),
  };
  return {
    sceneId: nextId,
    state,
    history,
    lastOutcome: outcome,
    ...(checkpoints ? { checkpoints } : {}),
  };
}

/** The chapter the run is in; after a death, the chapter where it happened. */
export function runChapterId(story: Story, session: Session): string | undefined {
  const scene = getScene(story, session.sceneId);
  if (scene.chapter) return scene.chapter;
  const at = session.lastOutcome?.death?.at ?? session.lastOutcome?.fromSceneId;
  return at && hasScene(story, at) ? getScene(story, at).chapter : undefined;
}

/** Goes back to where this run entered the current chapter (or the chapter where it died), with the state it had then. */
export function restartChapter(story: Story, session: Session): Session | null {
  const chapter = runChapterId(story, session);
  const checkpoint = chapter ? session.checkpoints?.[chapter] : undefined;
  if (!chapter || !checkpoint) return null;
  const upTo = chapterNumber(story, chapter);
  const checkpoints = Object.fromEntries(Object.entries(session.checkpoints ?? {}).filter(([id]) => chapterNumber(story, id) <= upTo));
  return {
    sceneId: checkpoint.sceneId,
    state: { ...checkpoint.state },
    history: session.history.slice(0, checkpoint.historyLength),
    checkpoints,
  };
}

function sameType(a: Value, b: unknown): boolean {
  return typeof a === typeof b;
}

/** Rebuilds a session from saved JSON. Returns null if it doesn't fit the current story. */
export function restoreSession(story: Story, raw: unknown): Session | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<Session>;
  if (typeof data.sceneId !== 'string' || !hasScene(story, data.sceneId)) return null;
  const state = restoreState(story, data.state);
  if (!state) return null;
  const history = Array.isArray(data.history)
    ? data.history.filter((h) => h && typeof h.sceneId === 'string' && typeof h.choiceId === 'string')
    : [];
  const checkpoints: Record<string, Checkpoint> = {};
  for (const [id, cp] of Object.entries((data.checkpoints ?? {}) as Record<string, Partial<Checkpoint>>)) {
    const cpState = restoreState(story, cp?.state);
    if (
      story.chapters?.some((c) => c.id === id) &&
      typeof cp?.sceneId === 'string' &&
      hasScene(story, cp.sceneId) &&
      cpState &&
      Number.isInteger(cp.historyLength) &&
      (cp.historyLength as number) >= 0 &&
      (cp.historyLength as number) <= history.length
    ) {
      checkpoints[id] = { sceneId: cp.sceneId, state: cpState, historyLength: cp.historyLength as number };
    }
  }
  return {
    sceneId: data.sceneId,
    state,
    history,
    ...(isSavedOutcome(data.lastOutcome) ? { lastOutcome: data.lastOutcome } : {}),
    ...(Object.keys(checkpoints).length ? { checkpoints } : {}),
  };
}

/** Rebuilds a state from saved JSON: every field must exist with the right type; numbers are clamped. */
function restoreState(story: Story, raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state: GameState = {};
  for (const [field, initial] of Object.entries(story.initialState)) {
    const saved = (raw as GameState)[field];
    // Fields added in a later version of the story start at their initial value.
    if (saved === undefined) {
      state[field] = initial;
      continue;
    }
    if (!sameType(initial, saved)) return null;
    state[field] = typeof saved === 'number' ? clampValue(saved, story.stateRules[field]) : saved;
  }
  return state;
}

/** A damaged "last action" in a save is dropped rather than allowed to break the screen. */
function isSavedOutcome(value: unknown): value is Outcome {
  if (!value || typeof value !== 'object') return false;
  const o = value as Partial<Outcome>;
  if (o.death !== undefined && (typeof o.death?.cause !== 'string' || typeof o.death?.at !== 'string' || !['action', 'arrival', 'stuck'].includes(o.death?.how))) return false;
  if (o.shelter !== undefined && o.shelter !== 'storm' && o.shelter !== 'stuck') return false;
  return (
    typeof o.choiceId === 'string' &&
    typeof o.fromSceneId === 'string' &&
    Array.isArray(o.items) &&
    o.items.every(
      (item) =>
        item &&
        typeof item.field === 'string' &&
        ((item.kind === 'stat' && typeof item.delta === 'number') ||
          (item.kind === 'flag' && ['number', 'boolean', 'string'].includes(typeof item.value))),
    )
  );
}
