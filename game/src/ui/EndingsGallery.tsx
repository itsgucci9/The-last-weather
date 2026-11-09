import type { Scene, Story } from '../engine/types';
import { fill, type UiStrings } from '../i18n/ui';

interface Props {
  story: Story;
  ui: UiStrings;
  found: string[];
  /** Death scenes reached at least once (shown apart: deaths are not endings). */
  deaths?: string[];
  headingLevel?: 'h2' | 'h4';
}

interface Group {
  title: string | null;
  outcomes: Scene[];
}

/** Outcomes worth collecting: endings and chapter ends, in chapters that have more than one. */
function groups(story: Story, ui: UiStrings): Group[] {
  const isOutcome = (s: Scene) => s.ending || s.chapterEnd;
  if (!story.chapters?.length) return [{ title: null, outcomes: story.scenes.filter(isOutcome) }];
  return story.chapters
    .map((chapter, i) => ({
      title: `${fill(ui.chapter, { n: i + 1 })} · ${chapter.title}`,
      outcomes: story.scenes.filter((s) => s.chapter === chapter.id && isOutcome(s)),
    }))
    .filter((g) => g.outcomes.length > 1);
}

export function galleryOutcomes(story: Story): Scene[] {
  return groups(story, { chapter: '' } as UiStrings).flatMap((g) => g.outcomes);
}

/** Endings found so far, by chapter; missing ones show a hint so the player knows what to try next. */
export function EndingsGallery({ story, ui, found, deaths = [], headingLevel = 'h4' }: Props) {
  const deathScenes = story.scenes.filter((s) => s.death);
  const deathsSeen = deathScenes.filter((s) => deaths.includes(s.id));
  const list = groups(story, ui);
  const all = list.flatMap((g) => g.outcomes);
  const Heading = headingLevel;
  const count = all.filter((e) => found.includes(e.id)).length;
  return (
    <section className="endings-gallery" aria-label={ui.endingsHeading}>
      <Heading className="eyebrow">{fill(ui.endingsFound, { n: count, total: all.length })}</Heading>
      {list.map((group) => (
        <div key={group.title ?? 'all'} className="endings-group">
          {group.title && <p className="endings-group-title">{group.title}</p>}
          <ul className="endings-found">
            {group.outcomes.map((e) =>
              found.includes(e.id) ? (
                <li key={e.id} className="found" data-ending={e.id}>
                  {e.title}
                </li>
              ) : (
                <li key={e.id} className="missing" data-ending={e.id}>
                  <span className="missing-label">{ui.unknownEnding}</span>
                  {e.hint && (
                    <span className="ending-hint">
                      <span className="hint-label">{ui.hint}:</span> {e.hint}
                    </span>
                  )}
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
      {deathsSeen.length > 0 && (
        <div className="endings-group deaths-group">
          <p className="endings-group-title">{fill(ui.deathsHeading, { n: deathsSeen.length, total: deathScenes.length })}</p>
          <ul className="endings-found">
            {deathScenes.map((d) => (
              <li key={d.id} className={deaths.includes(d.id) ? 'found death' : 'missing'} data-death={d.id}>
                {deaths.includes(d.id) ? d.title : <span className="missing-label">{ui.unknownEnding}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
