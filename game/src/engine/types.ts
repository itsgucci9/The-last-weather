// Story data types. These mirror data/story.json and contain no UI or platform code.

export type Value = number | boolean | string;
export type GameState = Record<string, Value>;

export type Op = 'eq' | 'gte' | 'lte';

export interface Condition {
  field: string;
  op: Op;
  value: Value;
}

/** Every item in `all` must pass; at least one item in `any` must pass; both groups when both exist. */
export interface ConditionGroup {
  all?: Condition[];
  any?: Condition[];
}

export interface Effects {
  /** Numeric values to add, clamped with stateRules. */
  add?: Record<string, number>;
  /** Fields to replace. */
  set?: Record<string, Value>;
}

/**
 * Where something happens. "sealed": a pressurised or sheltered place (station, shelter, ship
 * cabin) where empty meters are not lethal. "exposed": outside. "storm": an exposed storm crossing.
 */
export type Exposure = 'sealed' | 'exposed' | 'storm';

export interface Choice {
  id: string;
  label: string;
  detail?: string;
  /** Optional preview art for this choice (file name inside assetRoot). */
  art?: string;
  conditions?: ConditionGroup;
  effects?: Effects;
  next: string;
  /** Where the action itself happens, when it differs from the scene (e.g. a spacewalk from the cabin). */
  exposure?: Exposure;
  /** Hide this choice instead of showing it locked when its conditions fail. */
  hideWhenLocked?: boolean;
}

/** Extra text shown after a scene's main text when its conditions pass. */
export interface TextVariant {
  id: string;
  conditions?: ConditionGroup;
  speaker?: string;
  text: string;
}

export interface Chapter {
  id: string;
  title: string;
}

export interface Scene {
  id: string;
  /** Chapter id (see Story.chapters). */
  chapter?: string;
  title: string;
  location?: string;
  art: string;
  /** Sound mood for this scene (see src/audio.ts): wind, interior, storm, launch, space, shelter. */
  ambience?: string;
  /** Where the player is in this scene. Required for every scene that has choices. */
  exposure?: Exposure;
  /**
   * A safe scene this place can retreat to. Used when the storm arrives while the player is
   * sealed in here, or when no choice is open here and the player is safe.
   */
  shelter?: string;
  speaker?: string;
  text: string;
  textVariants?: TextVariant[];
  choices?: Choice[];
  /** A final ending: the run is over. */
  ending?: boolean;
  /** Closes a chapter: shows a recap, and its choice continues into the next chapter. */
  chapterEnd?: boolean;
  /** Endings only: a nudge shown in the endings gallery until this ending is found. */
  hint?: string;
  /** A death scene: the run is over. Value = the cause it shows (see StateRule.lethal / clock.cause). Not an ending. */
  death?: string;
}

export interface StateRule {
  min: number;
  max: number;
  label: string;
  /** HUD icon file name inside assetRoot. */
  icon?: string;
  /** Show a low warning at or below this value. */
  warnAt?: number;
  /**
   * Lethal meter: reaching `min` while exposed (during an exposed action, or on arriving in an
   * exposed scene) kills, with this death cause. In a sealed place it may reach `min` safely,
   * but a cost larger than what is left locks the choice.
   */
  lethal?: string;
  /** A cost larger than what is left locks the choice instead of being clamped. */
  spend?: boolean;
  /** Countdown meter (time). Costs are time passing: it stops at `min`, and `min` means the storm has arrived. */
  clock?: ClockRule;
  /** Only show in the HUD while these conditions pass. */
  hudWhen?: ConditionGroup;
}

export interface ClockRule {
  /** Death cause when the clock runs out during an exposed action or on arrival outside. */
  cause: string;
  /** The clock only matters while these conditions pass (e.g. while still on the planet). */
  activeWhen?: ConditionGroup;
}

export interface FlagRule {
  label: string;
  /** Display names for flag values (keys are the value as a string: "true", "careful", ...). */
  values?: Record<string, string>;
  /** Where the HUD shows this flag. */
  hud?: 'inventory' | 'status';
  /** Only show in the HUD while these conditions pass (e.g. hide the coupler once it is installed). */
  hudWhen?: ConditionGroup;
  /** Only include in the field log from this chapter on (chapter id). */
  logFrom?: string;
  /** Include in the ending field log. */
  log?: boolean;
}

export interface Story {
  schemaVersion: number;
  title: string;
  assetRoot: string;
  initialScene: string;
  /** Chapters in play order. Scenes name their chapter with Scene.chapter. */
  chapters?: Chapter[];
  initialState: GameState;
  stateRules: Record<string, StateRule>;
  flagRules?: Record<string, FlagRule>;
  conditionOperators?: string[];
  effectFormat?: Record<string, string>;
  scenes: Scene[];
}

export interface HistoryEntry {
  sceneId: string;
  choiceId: string;
}

export type OutcomeItem =
  | { kind: 'stat'; field: string; delta: number }
  | { kind: 'flag'; field: string; value: Value };

export interface Outcome {
  choiceId: string;
  fromSceneId: string;
  items: OutcomeItem[];
  /** The player died: the cause, the scene where it happened, and whether during the action, on arrival, or with no way forward. */
  death?: { cause: string; at: string; how: 'action' | 'arrival' | 'stuck' };
  /** The player was sent to shelter: the storm arrived while sealed in, or nothing else was open. */
  shelter?: 'storm' | 'stuck';
}

/** Where and how the player entered a chapter, so the chapter can be replayed from there. */
export interface Checkpoint {
  sceneId: string;
  state: GameState;
  historyLength: number;
}

export interface Session {
  sceneId: string;
  state: GameState;
  history: HistoryEntry[];
  lastOutcome?: Outcome;
  /** chapter id -> checkpoint taken when this run entered that chapter. */
  checkpoints?: Record<string, Checkpoint>;
}

/** A cost the player cannot pay: needs more than is left. */
export interface Shortfall {
  field: string;
  need: number;
  have: number;
}

/** What a choice will do beyond its stated effects, known before it is taken. */
export type Risk =
  | { kind: 'death'; cause: string; field: string; at: 'action' | 'arrival' | 'stuck' }
  | { kind: 'shelter'; reason: 'storm' | 'stuck' };

export interface Resolution {
  /** Where the run goes: the next scene, a shelter, or a death scene. */
  sceneId: string;
  /** State after the choice (numbers clamped). */
  state: GameState;
  risk: Risk | null;
  shortfalls: Shortfall[];
  /** Where the action happens. */
  exposure: Exposure;
}

export interface ChoiceView {
  choice: Choice;
  available: boolean;
  /** Failed conditions from `all`. */
  unmetAll: Condition[];
  /** The `any` group when none of it passed (all its items are needed as alternatives). */
  unmetAny: Condition[] | null;
  /** Costs larger than what is left (the choice is locked). */
  shortfalls: Shortfall[];
  /** The deterministic result, for showing risk before the player commits (null when locked by conditions). */
  resolution: Resolution | null;
}
