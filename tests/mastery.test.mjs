// Unit tests for the mastery model (app/lib/mastery.js). Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, actions, plan, recallProbability, shakyPrereqs, WEIGHTS, HALF_LIFE_DAYS, MIN_EVIDENCE } from '../app/lib/mastery.js';

const DAY = 864e5, NOW = Date.UTC(2026, 9, 8);
const ch = (id, extra = {}) => ({
  id, est_minutes: 60, prereqs: [],
  sections: [{ anchor: 'a', h: 'Intuition' }, { anchor: 'b', h: 'Mechanism' }, { anchor: 'c', h: 'Production' }, { anchor: 'd', h: 'Check your understanding' }, { anchor: 'e', h: 'Sources' }],
  check: ['q1', 'q2', 'q3', 'q4'], interview: [{ q: 'i1' }, { q: 'i2' }], flashcards: [{}, {}, {}, {}],
  ...extra,
});
const blank = () => ({ progress: {}, cards: {}, labs: {} });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('no evidence → not started, nothing to do', () => {
  const a = assess(ch('x-01'), blank(), null, NOW);
  assert.equal(a.level, 'none'); assert.equal(a.evidence, 0); assert.equal(a.started, false);
  assert.deepEqual(actions(a, ch('x-01'), NOW), []);
});

test('reading counts only the sections the reader tracks, and is evidence but never mastery', () => {
  const s = blank(); s.progress['x-01'] = { status: 'reading', sections: { a: 1, b: 1, c: 1 } };
  const a = assess(ch('x-01'), s, null, NOW);
  assert.equal(a.parts.reading.total, 3); close(a.parts.reading.evidence, 1);
  assert.equal(a.level, 'read'); assert.equal(a.scored, false); assert.equal(a.mastery, 0);
  close(a.evidence, WEIGHTS.reading / (WEIGHTS.reading + WEIGHTS.recall + WEIGHTS.cards));
});

test('forgetting curve: 0.9 when a card comes due, 0 after "again", null if never reviewed', () => {
  close(recallProbability({ last: NOW - 10 * DAY, interval: 10 }, NOW), 0.9);
  assert.equal(recallProbability({ last: NOW, interval: 0 }, NOW), 0);
  assert.equal(recallProbability(undefined, NOW), null);
  assert.ok(recallProbability({ last: NOW - 40 * DAY, interval: 10 }, NOW) < 0.9);
});

test('self-grades: score is the weighted mean of g/2; old grades fade evidence, not score', () => {
  const s = blank();
  s.progress['x-01'] = { checks: { 0: { g: 2, at: NOW }, 1: { g: 0, at: NOW } } };
  const fresh = assess(ch('x-01'), s, null, NOW);
  close(fresh.parts.recall.score, 0.5); close(fresh.parts.recall.evidence, 2 / 6);
  const later = assess(ch('x-01'), s, null, NOW + HALF_LIFE_DAYS * DAY);
  close(later.parts.recall.score, 0.5); close(later.parts.recall.evidence, 1 / 6);
});

test('combination is the evidence-weighted mean of the parts', () => {
  const s = blank();
  s.progress['x-01'] = { status: 'reading', sections: { a: 1, b: 1, c: 1 }, checks: { 0: { g: 2, at: NOW }, 1: { g: 2, at: NOW }, 2: { g: 1, at: NOW } } };
  const a = assess(ch('x-01'), s, null, NOW);
  close(a.mastery, a.parts.recall.score);   // reading never enters the score
  s.cards['x-01:0'] = { last: NOW - 10 * DAY, interval: 10 };   // recall 0.9 on one of four cards
  const b = assess(ch('x-01'), s, null, NOW), Q = b.parts.recall, F = b.parts.cards;
  close(b.mastery, (WEIGHTS.recall * Q.evidence * Q.score + WEIGHTS.cards * F.evidence * F.score) / (WEIGHTS.recall * Q.evidence + WEIGHTS.cards * F.evidence));
  close(a.evidence, (WEIGHTS.reading * 1 + WEIGHTS.recall * 0.5) / (WEIGHTS.reading + WEIGHTS.recall + WEIGHTS.cards));
});

test('a single perfect answer is "too early to tell", not "strong"', () => {
  const s = blank(); s.progress['x-01'] = { checks: { 0: { g: 2, at: NOW } } };
  const a = assess(ch('x-01'), s, null, NOW);
  close(a.mastery, 1); assert.ok(a.evidence < MIN_EVIDENCE); assert.equal(a.level, 'early');
});

test('a passed lab is full credit and raises evidence; a lab chapter offers more evidence', () => {
  const lab = { id: 'lab-x', test_count: 8 };
  const s = blank(); s.labs['lab-x'] = { runs: 3, best: 8, passedAt: NOW };
  const a = assess(ch('x-01'), s, lab, NOW);
  close(a.parts.lab.score, 1); close(a.mastery, 1);
  close(a.evidence, WEIGHTS.lab / (WEIGHTS.reading + WEIGHTS.recall + WEIGHTS.cards + WEIGHTS.lab));
  s.labs['lab-x'] = { runs: 2, best: 6 };
  close(assess(ch('x-01'), s, lab, NOW).parts.lab.score, 6 / 8);
});

test('two labs in one chapter: untried labs lower evidence, not the score', () => {
  const labs = [{ id: 'l1', title: 'One', test_count: 8 }, { id: 'l2', title: 'Two', test_count: 10 }];
  const s = blank(); s.labs.l1 = { runs: 1, best: 8, passedAt: NOW };
  const a = assess(ch('x-01'), s, labs, NOW);
  close(a.parts.lab.score, 1); close(a.parts.lab.evidence, 0.5); assert.equal(a.parts.lab.passed, 1);
  s.progress['x-01'] = { status: 'done', sections: { a: 1, b: 1, c: 1 } };
  const acts = actions(assess(ch('x-01'), s, labs, NOW), ch('x-01'), NOW);
  assert.ok(acts.some(x => x.kind === 'lab-new' && x.href === '#/lab/l2'), 'the untried lab should be suggested');
});

test('levels follow the thresholds once there is enough evidence', () => {
  const s = blank(); const g = v => Object.fromEntries([0, 1, 2, 3].map(i => [i, { g: v, at: NOW }]));
  for (const [v, level] of [[2, 'strong'], [1, 'shaky'], [0, 'weak']]) {
    s.progress['x-01'] = { sections: { a: 1, b: 1, c: 1 }, checks: g(v), interview: { 0: { g: v, at: NOW }, 1: { g: v, at: NOW } } };
    const a = assess(ch('x-01'), s, null, NOW);
    assert.equal(a.level, level, `all grades ${v} → ${a.mastery} → ${a.level}`);
  }
});

test('actions: due cards first, then missed questions, each linked to the right place', () => {
  const s = blank();
  s.progress['x-01'] = { status: 'reading', sections: { a: 1, b: 1 }, checks: { 0: { g: 0, at: NOW }, 1: { g: 1, at: NOW }, 2: { g: 2, at: NOW } } };
  s.cards['x-01:0'] = { last: NOW - 5 * DAY, interval: 3, due: NOW - 2 * DAY };
  const c = ch('x-01'), acts = actions(assess(c, s, null, NOW), c, NOW);
  assert.equal(acts[0].kind, 'due'); assert.equal(acts[0].href, '#/cards?c=x-01');
  assert.equal(acts[1].kind, 'missed'); assert.match(acts[1].label, /Retry 2 questions/); assert.equal(acts[1].href, '#/practice?c=x-01&t=check');
  assert.ok(acts.some(x => x.kind === 'read' && /1 section left/.test(x.label)));
});

test('actions: read-but-untested suggests the self-test and the lab', () => {
  const s = blank(); s.progress['x-01'] = { status: 'done', sections: { a: 1, b: 1, c: 1 } };
  const c = ch('x-01'), kinds = actions(assess(c, s, { id: 'lab-x', test_count: 9 }, NOW), c, NOW).map(x => x.kind);
  assert.ok(kinds.includes('untested') && kinds.includes('lab-new') && kinds.includes('new-cards'), kinds.join());
});

test('stale self-tests prompt a retest', () => {
  const s = blank(); s.progress['x-01'] = { checks: { 0: { g: 2, at: NOW - 60 * DAY } }, status: 'reading' };
  const c = ch('x-01'); assert.ok(actions(assess(c, s, null, NOW), c, NOW).some(x => x.kind === 'stale'));
});

test('plan: only started chapters, capped per chapter, highest priority first', () => {
  const s = blank(), cs = [ch('x-01'), ch('x-02'), ch('x-03')];
  s.progress['x-01'] = { status: 'reading', sections: { a: 1 }, checks: { 0: { g: 0, at: NOW }, 1: { g: 0, at: NOW } } };
  for (let i = 0; i < 4; i++) s.cards[`x-02:${i}`] = { last: NOW - 9 * DAY, interval: 4, due: NOW - DAY };
  s.progress['x-02'] = { status: 'reading', sections: { a: 1, b: 1, c: 1 } };
  const p = plan(cs, s, {}, NOW, { limit: 10, perChapter: 2 });
  assert.ok(p.every(x => x.chapter !== 'x-03'));
  for (const id of ['x-01', 'x-02']) assert.ok(p.filter(x => x.chapter === id).length <= 2);
  assert.deepEqual(p.map(x => x.priority), [...p.map(x => x.priority)].sort((a, b) => b - a));
});

test('shaky prerequisites are surfaced, strong or unstarted ones are not', () => {
  const s = blank(), g = v => ({ sections: { a: 1, b: 1, c: 1 }, checks: Object.fromEntries([0, 1, 2, 3].map(i => [i, { g: v, at: NOW }])), interview: { 0: { g: v, at: NOW }, 1: { g: v, at: NOW } } });
  s.progress['p-01'] = g(0); s.progress['p-02'] = g(2);
  const cs = [ch('p-01'), ch('p-02'), ch('p-03'), ch('x-01', { prereqs: ['p-01', 'p-02', 'p-03'] })];
  assert.deepEqual(shakyPrereqs(cs[3], cs, s, {}, NOW).map(a => a.id), ['p-01']);
});
