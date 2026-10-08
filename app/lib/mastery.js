/* Mastery: what your own practice says about each chapter, and what to do next.

   This is an evidence model, not a test score. It uses four kinds of evidence the app
   already records — reading, self-graded questions, flashcard reviews and coding labs — and
   reports two numbers per chapter:
     mastery   how well you did on what you have demonstrated: questions, flashcards, labs (0–1).
               Reading is exposure, not demonstration, so it never raises this number.
     evidence  how much you have done, reading included, relative to what the chapter offers (0–1)
   Every constant below is shown verbatim on the Mastery page, so the model is inspectable.

   `assess` and `plan` are pure: they read a state object and a time, and touch nothing else. */

const DAY = 864e5;

/** How much each kind of evidence counts, when present. */
export const WEIGHTS = { reading: 0.1, recall: 0.35, cards: 0.35, lab: 0.2 };
/** A self-grade's weight halves every this many days, so old answers fade and prompt a retest. */
export const HALF_LIFE_DAYS = 45;
/** Below this much evidence, a chapter's score is reported as "too early to tell". */
export const MIN_EVIDENCE = 0.15;
/** Level thresholds on the mastery score. */
export const LEVELS = [
  { key: 'strong', min: 0.85, label: 'Strong' },
  { key: 'solid', min: 0.65, label: 'Solid' },
  { key: 'shaky', min: 0.4, label: 'Shaky' },
  { key: 'weak', min: 0, label: 'Weak' },
];
export const LEVEL_INFO = {
  none: { label: 'Not started' },
  read: { label: 'Read, not yet tested' },
  early: { label: 'Too early to tell' },
  ...Object.fromEntries(LEVELS.map(l => [l.key, { label: l.label }])),
};

/** Sections the chapter reader tracks (mirrors graph.js DERIVED; kept local so this stays pure). */
const DERIVED = /^(check your understanding|interview questions|flashcards|exercises and mini-project|revision summary|sources|further reading)$/i;

/**
 * Estimated chance of recalling a flashcard now. FSRS-style power forgetting curve,
 * R(t) = 1 / (1 + t / (9·S)), with the card's current interval as its stability S, so
 * R is 0.9 when a card comes due. A card whose last answer was "again" (interval 0) counts 0
 * until it is relearned. Returns null for a card never reviewed.
 */
export function recallProbability(card, now) {
  if (!card || !card.last) return null;
  if (!card.interval) return 0;
  const t = Math.max(0, (now - card.last) / DAY);
  return 1 / (1 + t / (9 * card.interval));
}

/**
 * Assess one chapter. `ch` is a content.json chapter; `state` the learner state;
 * `labs` the chapter's labs from labs.json ({id, title, test_count}, or a list of them) or null.
 */
export function assess(ch, state, labs = null, now = Date.now()) {
  labs = labs ? (Array.isArray(labs) ? labs : [labs]) : [];
  const p = state.progress?.[ch.id] || {};
  const parts = {};

  // reading: share of the sections the reader tracks
  const secs = (ch.sections || []).filter(s => !DERIVED.test(s.h));
  const read = secs.filter(s => p.sections?.[s.anchor]).length;
  const frac = secs.length ? read / secs.length : 0;
  parts.reading = { score: frac, evidence: frac, read, total: secs.length };

  // recall: self-graded self-test and interview questions (0 couldn't, 1 partly, 2 nailed it), fading with age
  const total = (ch.check || []).length + (ch.interview || []).length;
  const graded = [...Object.entries(p.checks || {}).map(([i, x]) => ({ kind: 'check', i: +i, ...x })), ...Object.entries(p.interview || {}).map(([i, x]) => ({ kind: 'interview', i: +i, ...x }))]
    .filter(x => typeof x.g === 'number');
  if (total) {
    let sw = 0, sg = 0, newest = 0;
    for (const x of graded) {
      const age = x.at ? Math.max(0, (now - x.at) / DAY) : 0;
      const w = Math.pow(0.5, age / HALF_LIFE_DAYS);
      sw += w; sg += w * (x.g / 2); newest = Math.max(newest, x.at || 0);
    }
    parts.recall = {
      score: sw ? sg / sw : 0, evidence: Math.min(1, sw / total), graded: graded.length, total,
      missed: graded.filter(x => x.g < 2), lastAt: newest || null,
    };
  }

  // flashcards: estimated recall over the cards you have reviewed
  const nCards = (ch.flashcards || []).length;
  if (nCards) {
    let reviewed = 0, sumR = 0, due = 0;
    for (let i = 0; i < nCards; i++) {
      const card = state.cards?.[`${ch.id}:${i}`];
      const r = recallProbability(card, now);
      if (r === null) continue;
      reviewed++; sumR += r;
      if (card.due && card.due <= now) due++;
    }
    parts.cards = { score: reviewed ? sumR / reviewed : 0, evidence: reviewed / nCards, reviewed, total: nCards, due };
  }

  // labs: passing every test is full credit; a partial best counts in proportion
  if (labs.length) {
    const items = labs.map(lab => {
      const l = state.labs?.[lab.id], tried = !!(l && (l.runs || l.passedAt));
      return { id: lab.id, title: lab.title || lab.id, total: lab.test_count, best: l?.best || 0, tried, passed: !!l?.passedAt,
        score: l?.passedAt ? 1 : tried ? (l.best || 0) / (lab.test_count || l.total || 1) : 0 };
    });
    const tried = items.filter(x => x.tried);
    parts.lab = { score: tried.length ? tried.reduce((a, x) => a + x.score, 0) / tried.length : 0, evidence: tried.length / items.length,
      labs: items, tried: tried.length, passed: items.filter(x => x.passed).length, total: items.length };
  }

  // combine: mastery is the evidence-weighted average of the demonstrated parts;
  // evidence counts everything, reading included
  let num = 0, den = 0, avail = 0, have = 0;
  for (const [k, part] of Object.entries(parts)) {
    const w = WEIGHTS[k];
    avail += w; have += w * part.evidence;
    if (k === 'reading') continue;
    num += w * part.evidence * part.score; den += w * part.evidence;
  }
  const evidence = avail ? have / avail : 0;
  const mastery = den ? num / den : 0;
  const level = !have ? 'none' : !den ? 'read' : evidence < MIN_EVIDENCE ? 'early' : LEVELS.find(l => mastery >= l.min).key;
  const lastAt = Math.max(p.lastAt || 0, parts.recall?.lastAt || 0, ...Object.keys(state.cards || {}).filter(k => k.startsWith(ch.id + ':')).map(k => state.cards[k].last || 0), ...labs.map(l => state.labs?.[l.id]?.at || 0));
  return { id: ch.id, mastery, evidence, level, scored: den > 0, parts, done: p.status === 'done', started: !!p.status || have > 0, lastAt: lastAt || null };
}

/** Next actions for one assessed chapter, each with a reason and a priority. */
export function actions(a, ch, now = Date.now()) {
  const out = [], P = a.parts, need = a.scored ? 1.2 - a.mastery : 1;
  const add = (kind, base, label, href, reason, minutes) => out.push({ chapter: a.id, kind, label, href, reason, minutes, priority: base * need });
  if (P.cards?.due) add('due', 3, `Review ${P.cards.due} due flashcard${P.cards.due > 1 ? 's' : ''}`, `#/cards?c=${a.id}`, 'Due now — reviewing on time is what keeps them remembered', Math.max(1, Math.round(P.cards.due * 0.5)));
  const missed = P.recall?.missed || [];
  if (missed.length) {
    const kind = missed.filter(x => x.kind === 'interview').length > missed.length / 2 ? 'interview' : 'check';
    add('missed', 2.5, `Retry ${missed.length} question${missed.length > 1 ? 's' : ''} you marked Couldn't or Partly`, `#/practice?c=${a.id}&t=${kind}`, 'Your own grades say these are not there yet', missed.length * 2);
  }
  for (const l of P.lab?.labs || []) if (l.tried && !l.passed) add('lab', 2, `Finish the lab “${l.title}” — ${l.best} of ${l.total} tests pass`, `#/lab/${l.id}`, 'The failing tests say exactly what is missing', 15);
  if (P.recall?.graded && P.recall.lastAt) {
    const age = (now - P.recall.lastAt) / DAY;
    if (age > HALF_LIFE_DAYS) add('stale', 1.8, `Retest — your last self-test here was ${Math.round(age)} days ago`, `#/practice?c=${a.id}&t=check`, 'Old answers count for less as time passes', 8);
  }
  if (P.reading.evidence >= 0.5 && P.recall && !P.recall.graded) add('untested', 1.6, `Take the self-test (${(ch.check || []).length || P.recall.total} questions)`, `#/practice?c=${a.id}&t=check`, 'You have read it but not tested yourself yet', 10);
  const fresh = (P.lab?.labs || []).find(l => !l.tried);
  if (fresh && (P.reading.evidence >= 0.5 || a.done)) add('lab-new', 1.2, `Prove it in the lab “${fresh.title}” (${fresh.total} tests)`, `#/lab/${fresh.id}`, 'Implementing it is the strongest evidence there is', 25);
  if (P.cards && P.cards.reviewed < P.cards.total && (P.reading.evidence >= 0.5 || a.done)) add('new-cards', 1, `Learn ${P.cards.total - P.cards.reviewed} new flashcards`, `#/cards?c=${a.id}`, 'Not in your review rotation yet', Math.round((P.cards.total - P.cards.reviewed) * 0.5));
  if (a.started && !a.done && P.reading.total && P.reading.read < P.reading.total) add('read', 0.8, `Finish reading — ${P.reading.total - P.reading.read} section${P.reading.total - P.reading.read > 1 ? 's' : ''} left`, `#/c/${a.id}`, 'Started but not finished', Math.round((ch.est_minutes || 30) * (1 - P.reading.evidence)));
  return out.sort((x, y) => y.priority - x.priority);
}

/** The study plan: the highest-priority actions across chapters you have started, at most `perChapter` each. */
export function plan(chapters, state, labsByChapter = {}, now = Date.now(), { limit = 6, perChapter = 2 } = {}) {
  const assessed = chapters.map(ch => ({ ch, a: assess(ch, state, labsByChapter[ch.id] || null, now) }));
  const all = assessed.filter(x => x.a.started).flatMap(x => actions(x.a, x.ch, now).slice(0, perChapter));
  return all.sort((x, y) => y.priority - x.priority).slice(0, limit);
}

/** Prerequisites whose own evidence says they are weak or shaky. */
export function shakyPrereqs(ch, chapters, state, labsByChapter = {}, now = Date.now()) {
  const byId = new Map(chapters.map(c => [c.id, c]));
  return (ch.prereqs || []).map(id => byId.get(id)).filter(Boolean)
    .map(c => assess(c, state, labsByChapter[c.id] || null, now))
    .filter(a => a.level === 'weak' || a.level === 'shaky');
}
