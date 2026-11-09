// Explores every possible run through the story. Used by the validator and the tests.
// Runs that reach the same scene with the same state continue identically, so the walk visits
// each (scene, state) pair once and counts runs with dynamic programming instead of listing
// them: the number of runs grows multiplicatively with each chapter.
import { availableChoices, choose, getChoiceViews, getScene, isDeath, isTerminal } from './engine';
import type { GameState, Story } from './types';

export interface StatRange {
  min: number;
  max: number;
}

export interface ExploreReport {
  /** Number of distinct complete runs (choice sequences) from the start to a final ending or a death. */
  pathCount: number;
  /** Distinct (scene, state) situations reached. */
  nodeCount: number;
  /** Final ending or death scene id -> number of complete runs ending there. */
  endingCounts: Map<string, number>;
  /** Scene id -> number of complete runs that pass through it. */
  throughCounts: Map<string, number>;
  /** Distinct final states at each ending. */
  endStates: { endingId: string; state: GameState }[];
  deadEnds: { sceneId: string; state: GameState }[];
  loops: { sceneId: string }[];
  visitedScenes: Set<string>;
  /** sceneId -> choiceId -> distinct situations where it was available / locked. */
  choiceStats: Map<string, Map<string, { available: number; locked: number }>>;
  /** sceneId -> field -> range of numeric values on arrival. */
  statRanges: Map<string, Map<string, StatRange>>;
  /** Choices where the storm forced the player into shelter. */
  stormShelters: number;
  /** Choices that landed somewhere with nothing open (handled by shelter or death): should be 0. */
  stuck: { sceneId: string; choiceId: string; result: string }[];
  /** "cause @ scene" -> number of choices (situations) that kill there. */
  deathPlaces: Map<string, number>;
}

interface Node {
  sceneId: string;
  state: GameState;
  next: string[];
  /** Complete runs from this node to an ending, per ending. */
  toEnd: Map<string, number>;
}

const keyOf = (sceneId: string, state: GameState) => `${sceneId}|${JSON.stringify(state)}`;

export function explore(story: Story, startState?: GameState, startScene = story.initialScene): ExploreReport {
  const report: ExploreReport = {
    pathCount: 0,
    nodeCount: 0,
    endingCounts: new Map(),
    throughCounts: new Map(),
    endStates: [],
    deadEnds: [],
    loops: [],
    visitedScenes: new Set(),
    choiceStats: new Map(),
    statRanges: new Map(),
    stormShelters: 0,
    stuck: [],
    deathPlaces: new Map(),
  };
  const nodes = new Map<string, Node>();
  const onStack = new Set<string>();
  const order: string[] = []; // post-order: children before parents

  const visit = (sceneId: string, state: GameState): string => {
    const key = keyOf(sceneId, state);
    if (nodes.has(key)) {
      if (onStack.has(key)) report.loops.push({ sceneId });
      return key;
    }
    const scene = getScene(story, sceneId);
    const node: Node = { sceneId, state, next: [], toEnd: new Map() };
    nodes.set(key, node);
    onStack.add(key);
    report.visitedScenes.add(sceneId);

    const ranges = report.statRanges.get(sceneId) ?? new Map<string, StatRange>();
    for (const field of Object.keys(story.stateRules)) {
      const value = state[field] as number;
      const range = ranges.get(field);
      ranges.set(field, range ? { min: Math.min(range.min, value), max: Math.max(range.max, value) } : { min: value, max: value });
    }
    report.statRanges.set(sceneId, ranges);

    if (isTerminal(scene)) {
      node.toEnd.set(sceneId, 1);
      if (!isDeath(scene)) report.endStates.push({ endingId: sceneId, state });
    } else {
      const stats = report.choiceStats.get(sceneId) ?? new Map<string, { available: number; locked: number }>();
      const views = getChoiceViews(story, scene, state);
      for (const choice of scene.choices ?? []) {
        const entry = stats.get(choice.id) ?? { available: 0, locked: 0 };
        if (views.some((view) => view.choice.id === choice.id && view.available)) entry.available += 1;
        else entry.locked += 1;
        stats.set(choice.id, entry);
      }
      report.choiceStats.set(sceneId, stats);

      const choices = availableChoices(story, scene, state);
      if (choices.length === 0) report.deadEnds.push({ sceneId, state });
      for (const choice of choices) {
        const next = choose(story, { sceneId, state, history: [] }, choice.id);
        const outcome = next.lastOutcome;
        if (outcome?.shelter === 'storm') report.stormShelters += 1;
        if (outcome?.shelter === 'stuck') report.stuck.push({ sceneId, choiceId: choice.id, result: 'shelter' });
        if (outcome?.death) {
          const key = `${outcome.death.cause} @ ${outcome.death.at}`;
          report.deathPlaces.set(key, (report.deathPlaces.get(key) ?? 0) + 1);
          if (outcome.death.how === 'stuck') report.stuck.push({ sceneId, choiceId: choice.id, result: 'death' });
        }
        node.next.push(visit(next.sceneId, next.state));
      }
    }
    onStack.delete(key);
    order.push(key);
    return key;
  };

  const rootKey = visit(startScene, startState ?? { ...story.initialState });

  // Runs from each node to the end (children are finished before their parents in post-order).
  for (const key of order) {
    const node = nodes.get(key)!;
    for (const childKey of node.next) {
      for (const [ending, count] of nodes.get(childKey)!.toEnd) node.toEnd.set(ending, (node.toEnd.get(ending) ?? 0) + count);
    }
  }
  // Runs from the root to each node (parents before children: reverse post-order).
  const fromRoot = new Map<string, number>([[rootKey, 1]]);
  for (const key of [...order].reverse()) {
    const ways = fromRoot.get(key) ?? 0;
    for (const childKey of nodes.get(key)!.next) fromRoot.set(childKey, (fromRoot.get(childKey) ?? 0) + ways);
  }

  const root = nodes.get(rootKey)!;
  report.endingCounts = new Map(root.toEnd);
  report.pathCount = [...root.toEnd.values()].reduce((a, b) => a + b, 0);
  report.nodeCount = nodes.size;
  for (const [key, node] of nodes) {
    const through = (fromRoot.get(key) ?? 0) * [...node.toEnd.values()].reduce((a, b) => a + b, 0);
    report.throughCounts.set(node.sceneId, (report.throughCounts.get(node.sceneId) ?? 0) + through);
  }
  return report;
}
