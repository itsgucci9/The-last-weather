// Turns conditions, effects and outcomes into short player-facing text.
import type { Choice, ChoiceView, Condition, Effects, GameState, OutcomeItem, Resolution, Risk, Shortfall, Story, Value } from '../engine/types';
import { fill, type UiStrings } from '../i18n/ui';

export function fieldLabel(story: Story, field: string): string {
  return story.stateRules[field]?.label ?? story.flagRules?.[field]?.label ?? field;
}

export function valueLabel(story: Story, field: string, value: Value): string {
  return story.flagRules?.[field]?.values?.[String(value)] ?? String(value);
}

export function describeCondition(story: Story, ui: UiStrings, c: Condition): string {
  const label = fieldLabel(story, c.field);
  if (typeof c.value === 'number') {
    if (c.op === 'gte') return fill(ui.reqAtLeast, { label, value: c.value });
    if (c.op === 'lte') return fill(ui.reqAtMost, { label, value: c.value });
    return fill(ui.reqExactly, { label, value: c.value });
  }
  if (typeof c.value === 'boolean') {
    const named = story.flagRules?.[c.field]?.values?.[String(c.value)];
    if (named) return fill(ui.reqValue, { label, value: named });
    return fill(c.value ? ui.reqFlag : ui.reqNoFlag, { label });
  }
  return fill(ui.reqValue, { label, value: valueLabel(story, c.field, c.value) });
}

/** "Needs Storm forecast or MICA Trust 2+" for a locked choice. */
/** What a locked choice still needs, as a list ("Storm forecast or MICA Trust 2+"). */
export function requirementList(story: Story, ui: UiStrings, view: ChoiceView): string {
  const parts = view.unmetAll.map((c) => describeCondition(story, ui, c));
  if (view.unmetAny) parts.push(view.unmetAny.map((c) => describeCondition(story, ui, c)).join(ui.or));
  return parts.join(ui.and);
}

export function describeRequirement(story: Story, ui: UiStrings, view: ChoiceView): string {
  return fill(ui.needs, { req: requirementList(story, ui, view) });
}

export interface Chip {
  text: string;
  tone: 'gain' | 'loss' | 'neutral';
}

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** Numeric costs and gains shown on a choice before the player commits. */
export function effectChips(story: Story, effects: Effects | undefined): Chip[] {
  return Object.entries(effects?.add ?? {})
    .filter(([, delta]) => delta !== 0)
    .map(([field, delta]) => ({ text: `${signed(delta)} ${fieldLabel(story, field)}`, tone: delta > 0 ? 'gain' : 'loss' }));
}

/**
 * Costs and gains shown on a choice, with the real change: a gain that hits the maximum or a loss
 * on a meter already at 0 says so instead of being silently clamped. (Time on a clock is shown as
 * stated: running out is shown as a risk.)
 */
export function choiceChips(story: Story, ui: UiStrings, choice: Choice, before: GameState, resolution: Resolution | null): Chip[] {
  return Object.entries(choice.effects?.add ?? {})
    .filter(([, delta]) => delta !== 0)
    .map(([field, delta]) => {
      const label = fieldLabel(story, field);
      const tone: Chip['tone'] = delta > 0 ? 'gain' : 'loss';
      const rule = story.stateRules[field];
      if (!resolution || !rule || rule.clock) return { text: `${signed(delta)} ${label}`, tone };
      const actual = (resolution.state[field] as number) - (before[field] as number);
      if (actual === delta || (rule.lethal && actual !== 0)) return { text: `${signed(delta)} ${label}`, tone };
      const note = delta > 0 ? ui.chipMax : ui.chipFloor;
      if (actual === 0) return { text: `${label}: ${note}`, tone: 'neutral' };
      return { text: `${signed(actual)} ${label} (${note})`, tone };
    });
}

export function describeShortfall(story: Story, ui: UiStrings, s: Shortfall): string {
  return fill(ui.shortfall, { label: fieldLabel(story, s.field), need: s.need, have: s.have });
}

/** One sentence for a choice that kills or forces shelter, shown before the player commits. */
export function describeRisk(ui: UiStrings, risk: Risk): string {
  if (risk.kind === 'shelter') return risk.reason === 'storm' ? ui.riskShelterStorm : ui.riskShelterStuck;
  if (risk.cause === 'asphyxiation') return ui.riskAsphyxiation;
  if (risk.cause === 'suit_breach') return ui.riskSuitBreach;
  return ui.riskStorm;
}

/** One line item in a "Costs" / "Gains" row: an icon (if the meter has one) and plain text. */
export interface Fact {
  field: string;
  icon?: string;
  text: string;
}

/**
 * A choice's costs and gains, as separate lists in plain words ("1 Oxygen", "+1 MICA trust").
 * The real change is shown: a gain that hits the maximum or a loss on a meter already at 0 says so.
 */
export function choiceFacts(story: Story, ui: UiStrings, choice: Choice, before: GameState, resolution: Resolution | null): { costs: Fact[]; gains: Fact[] } {
  const costs: Fact[] = [];
  const gains: Fact[] = [];
  for (const [field, delta] of Object.entries(choice.effects?.add ?? {})) {
    if (delta === 0) continue;
    const rule = story.stateRules[field];
    const label = fieldLabel(story, field);
    let text = delta > 0 ? `+${delta} ${label}` : `${-delta} ${label}`;
    if (resolution && rule && !rule.clock) {
      const actual = (resolution.state[field] as number) - (before[field] as number);
      if (actual !== delta && !(rule.lethal && actual !== 0)) {
        const note = delta > 0 ? ui.chipMax : ui.chipFloor;
        text = actual === 0 ? `${label}: ${note}` : `${delta > 0 ? `+${actual}` : -actual} ${label} (${note})`;
      }
    }
    (delta > 0 ? gains : costs).push({ field, icon: rule?.icon, text });
  }
  // Items for the pack: picked up (a gain) or used up (a cost), named before the player commits.
  for (const [field, value] of Object.entries(choice.effects?.set ?? {})) {
    if (story.flagRules?.[field]?.hud !== 'inventory') continue;
    const label = fieldLabel(story, field);
    if (value === true && before[field] !== true) gains.push({ field, text: `+ ${label}` });
    if (value === false && before[field] === true) costs.push({ field, text: label });
  }
  return { costs, gains };
}

/** What a choice actually did, split the same way: spent and gained. */
export function outcomeFacts(story: Story, items: OutcomeItem[]): { spent: Fact[]; gained: Fact[] } {
  const spent: Fact[] = [];
  const gained: Fact[] = [];
  outcomeChips(story, items).forEach((chip, i) => {
    const field = items[i].field;
    const icon = story.stateRules[field]?.icon;
    const text = items[i].kind === 'stat' && chip.tone === 'loss' ? chip.text.replace(/^−/, '') : chip.text;
    (chip.tone === 'loss' ? spent : gained).push({ field, icon, text });
  });
  return { spent, gained };
}

/** What actually changed after a choice (after clamping). */
export function outcomeChips(story: Story, items: OutcomeItem[]): Chip[] {
  return items.map((item) => {
    const label = fieldLabel(story, item.field);
    if (item.kind === 'stat') return { text: `${signed(item.delta)} ${label}`, tone: item.delta > 0 ? 'gain' : 'loss' };
    const named = story.flagRules?.[item.field]?.values?.[String(item.value)];
    if (named) return { text: `${label}: ${named}`, tone: item.value === false ? 'loss' : 'gain' };
    return item.value ? { text: `+ ${label}`, tone: 'gain' } : { text: `− ${label}`, tone: 'loss' };
  });
}

/** Opening line length. Longer sentences continue behind More. */
const LEAD_WORDS = 6;

/**
 * A few words stay on screen. The rest of the sentence, and every sentence after it,
 * waits behind More.
 */
export function beats(text: string): { lead: string; rest: string } {
  const trimmed = text.trim();
  const sentence = trimmed.match(/^([\s\S]+?[.!?…])(?:\s+)([\s\S]+)$/);
  let lead = (sentence ? sentence[1] : trimmed).trim();
  let rest = (sentence ? sentence[2] : '').trim();
  const words = lead.replace(/[.!?…]+$/, '').split(/\s+/).filter(Boolean);
  if (words.length > LEAD_WORDS) {
    const head = words.slice(0, LEAD_WORDS).join(' ');
    const tail = words.slice(LEAD_WORDS).join(' ');
    const end = lead.match(/[.!?…]+$/)?.[0] ?? '';
    lead = `${head}…`;
    rest = [tail + (end && end !== '…' ? end : ''), rest].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  return { lead, rest };
}

export type Segment = { kind: 'narration' | 'speech'; text: string };

/**
 * Splits narration from quoted dialogue (“…” or «…») so a speaker's lines can be shown
 * as dialogue. Used only for scenes that declare a speaker.
 */
export function splitDialogue(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /“([^”]+)”|«[\s\u00a0\u202f]*([^»]+?)[\s\u00a0\u202f]*»/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(last, match.index).trim();
    if (before) segments.push({ kind: 'narration', text: before });
    segments.push({ kind: 'speech', text: (match[1] ?? match[2]).trim() });
    last = match.index + match[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) segments.push({ kind: 'narration', text: rest });
  return segments;
}
