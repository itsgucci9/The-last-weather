import { artUrl } from '../content';
import type { ChoiceView, GameState, Story } from '../engine/types';
import type { UiStrings } from '../i18n/ui';
import { choiceFacts, describeRisk, describeShortfall, requirementList, type Fact } from './describe';

interface Props {
  story: Story;
  state: GameState;
  views: ChoiceView[];
  ui: UiStrings;
  /** Choice waiting for a second tap because it kills (see App.activate). */
  armed: string | null;
  onActivate: (choiceId: string) => void;
}

/** Options you can take, numbered; then the ones you cannot take yet, apart and last. */
export function orderViews(views: ChoiceView[]): { open: ChoiceView[]; locked: ChoiceView[] } {
  return { open: views.filter((v) => v.available), locked: views.filter((v) => !v.available) };
}

/** A mark, not a paragraph: skull when the choice kills, a roof when it only forces shelter. */
function RiskMark({ lethal }: { lethal: boolean }) {
  return (
    <svg className="risk-mark" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {lethal ? (
        <>
          <circle cx="9" cy="7" r="4" fill="currentColor" />
          <path d="M4 16c1-3 3-4 5-4s4 1 5 4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7 6h1v2H7zM10 6h1v2h-1z" fill="#1a120c" />
        </>
      ) : (
        <path d="M2 8 L9 2 L16 8 V16 H2 Z" fill="currentColor" />
      )}
    </svg>
  );
}

function Facts({ label, facts, kind }: { label: string; facts: Fact[]; kind: 'costs' | 'gains' }) {
  if (!facts.length) return null;
  return (
    <span className={`fact-row fact-${kind}`}>
      <span className="fact-label">{label}</span>
      <span className="fact-items">
        {facts.map((f) => (
          <span key={f.text} className="fact-item">
            {f.icon && <img src={artUrl(f.icon)} alt="" width={16} height={16} />}
            {f.text}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Each option is one clear button with separate parts: what it is, what it costs, what you gain,
 * and, only when it applies, that it kills you, sends you to shelter, or what it still needs.
 */
export function Choices({ story, state, views, ui, armed, onActivate }: Props) {
  const { open, locked } = orderViews(views);

  const card = (view: ChoiceView, number?: number) => {
    const { choice, available, resolution } = view;
    const { costs, gains } = choiceFacts(story, ui, choice, state, resolution);
    const risk = available ? resolution?.risk ?? null : null;
    const lethal = risk?.kind === 'death';
    const isArmed = lethal && armed === choice.id;
    const needs = [
      ...(view.unmetAll.length || view.unmetAny ? [requirementList(story, ui, view)] : []),
      ...view.shortfalls.map((s) => describeShortfall(story, ui, s)),
    ].join(' · ');
    const classes = ['choice', available ? '' : 'is-locked', lethal ? 'is-lethal' : '', isArmed ? 'is-armed' : '', risk?.kind === 'shelter' ? 'is-shelter' : '', choice.art ? 'has-art' : '']
      .filter(Boolean)
      .join(' ');
    return (
      <li key={choice.id}>
        <button
          type="button"
          className={classes}
          aria-disabled={available ? undefined : true}
          data-choice={choice.id}
          data-risk={risk ? (risk.kind === 'death' ? `death:${risk.cause}` : `shelter:${risk.reason}`) : undefined}
          data-armed={isArmed ? 'true' : undefined}
          onClick={() => available && onActivate(choice.id)}
        >
          {choice.art && <img className="choice-art" src={artUrl(choice.art)} alt="" width={96} height={54} />}
          <span className="choice-body">
            <span className="choice-head">
              {number !== undefined && (
                <span className="choice-key" aria-hidden="true">
                  {number}
                </span>
              )}
              <span className="choice-label">{choice.label}</span>
            </span>
            {(costs.length > 0 || gains.length > 0) && (
              <span className="choice-facts">
                <Facts label={ui.costs} facts={costs} kind="costs" />
                <Facts label={ui.gains} facts={gains} kind="gains" />
              </span>
            )}
            {risk && (
              <span className={`choice-risk risk-${risk.kind}`}>
                <RiskMark lethal={lethal} />
                <span className="fact-label">{lethal ? ui.lethalTag : ui.shelterTag}</span>
                <span className="risk-detail">{describeRisk(ui, risk)}</span>
              </span>
            )}
            {isArmed && (
              <span className="choice-confirm" role="alert">
                {ui.confirmLethal}
              </span>
            )}
            {!available && (
              <span className="choice-needs">
                <span className="fact-label">{ui.needsLabel}</span>
                <span>{needs}</span>
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className="choices" aria-labelledby="choices-heading" data-tour="choices">
      <h3 id="choices-heading" className="eyebrow">
        {ui.choicesHeading}
      </h3>
      <ol className="choice-list">{open.map((view, i) => card(view, i + 1))}</ol>
      {locked.length > 0 && (
        <>
          <h4 className="eyebrow unavailable-heading">{ui.unavailableHeading}</h4>
          <ul className="choice-list choice-list-locked">{locked.map((view) => card(view))}</ul>
        </>
      )}
    </section>
  );
}
