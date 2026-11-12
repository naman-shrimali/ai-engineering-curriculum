/* Spaced repetition: SM-2 with the usual 4-button mapping.
   Card ids are `${chapterId}:${index}` into content.chapters[].flashcards. */
const DAY = 864e5;

export function schedule(card, grade /* 0 again, 1 hard, 2 good, 3 easy */) {
  const c = { ease: 2.5, interval: 0, reps: 0, lapses: 0, ...(card || {}) };
  const q = [1, 3, 4, 5][grade];                       // SM-2 quality
  if (q < 3) { c.reps = 0; c.lapses += 1; c.interval = 0; }
  else {
    if (c.reps === 0) c.interval = grade === 3 ? 4 : 1;
    else if (c.reps === 1) c.interval = grade === 3 ? 7 : grade === 1 ? 3 : 6;
    else c.interval = Math.round(c.interval * c.ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1));
    c.reps += 1;
  }
  c.ease = Math.max(1.3, c.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const minutes = q < 3 ? 10 : 0;                      // "again": back in 10 minutes
  c.due = Date.now() + (c.interval ? c.interval * DAY : minutes * 6e4);
  c.last = Date.now();
  return c;
}

export function isDue(card, at = Date.now()) { return !card || !card.due || card.due <= at; }

/** Human label for the next interval a grade would produce. */
export function preview(card, grade) {
  const c = schedule(card, grade);
  if (!c.interval) return '10 min';
  return c.interval === 1 ? '1 day' : c.interval < 30 ? `${c.interval} days` : c.interval < 365 ? `${Math.round(c.interval / 30)} mo` : `${(c.interval / 365).toFixed(1)} yr`;
}
