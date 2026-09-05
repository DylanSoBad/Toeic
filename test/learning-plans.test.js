import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../js/modules/storage.js';
import { analyze, recommendations, selectPractice, diagnosticItems, countQuestions, ensurePlan, updateTask, reviewQuestions, validateProfile, generationContext, localDay } from '../js/modules/learning.js';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
beforeEach(() => memory.clear());
const question = (id, part, type = 'detail') => ({ id, skill: part <= 4 ? 'listening' : 'reading', part, status: 'approved', level: 'intermediate', q: id, options: ['a', 'b'], correct: 0, questionType: type });
const bank = [question('l', 2), question('r1', 5, 'word-form'), question('r2', 5, 'word-form'), question('r7', 7)];
const history = (id, correct, timestamp = '2026-09-05T05:00:00Z') => ({ id, timestamp, skill: 'reading', part: 5, total: 1, correct: Number(correct), durationSeconds: 60, breakdown: [{ ...bank[1], selected: correct ? 0 : 1, isAnswered: true, isCorrect: correct }] });
test('profile rejects invalid goals, minutes and impossible dates', () => {
  const p = { targetScore: 750, currentScore: null, examDate: '2026-02-31', dailyMinutes: 30, weakParts: [5] };
  assert.ok(validateProfile(p, new Date('2026-01-01')).length);
  assert.equal(validateProfile({ ...p, examDate: '2026-09-30' }, new Date('2026-01-01')).length, 0);
  assert.ok(validateProfile({ ...p, targetScore: 1200, dailyMinutes: 0 }).length >= 2);
});
test('analytics aggregates real answers; latest correct attempt resolves a mistake', () => {
  const state = { history: [history('b', true, '2026-09-05T06:00:00Z'), history('a', false)], reviewIds: [] };
  const a = analyze(state, new Date('2026-09-05T12:00:00'));
  assert.equal(a.parts[0].total, 2); assert.equal(a.parts[0].correct, 1); assert.equal(a.mistakes.length, 0);
  assert.equal(a.weekMinutes, 2); assert.equal(reviewQuestions(state).length, 0);
  state.reviewIds.push('r1'); assert.equal(reviewQuestions(state).length, 1);
});
test('recommendations prioritize a known weak part and stay within daily budget', () => {
  const state = { profile: { dailyMinutes: 15, weakParts: [5] }, history: [history('a', false)] };
  const rows = recommendations(bank, state, new Date('2026-09-06T12:00:00'));
  assert.equal(rows[0].kind, 'review'); assert.equal(rows[1].part, 5);
  assert.ok(rows.reduce((n, row) => n + row.minutes, 0) <= 15);
  assert.match(rows[1].reason, /0\/1/);
});
test('selection excludes drafts, filters type and avoids recently seen exercises', () => {
  const picked = selectPractice([...bank, { ...bank[1], id: 'draft', status: 'draft' }], { part: 5, questionType: 'word-form', count: 1 }, { history: [history('a', false)] });
  assert.deepEqual(picked.map(q => q.id), ['r2']);
  assert.equal(selectPractice(bank, { questionType: 'inference' }, { history: [] }).length, 0);
});
test('diagnostic counts child questions and preserves group context', () => {
  const grouped = { ...question('group', 3), type: 'multi-question', transcript: 'conversation', questions: [{ ...question('s1', 3) }, { ...question('s2', 3) }] };
  const items = diagnosticItems([...bank, grouped]);
  assert.equal(countQuestions(items), 6); assert.equal(items.find(q => q.id === 'group').transcript, 'conversation');
});
test('plan completion does not change scores and postponement is idempotent', () => {
  const date = '2026-09-05';
  const task = ensurePlan(bank, date)[0];
  updateTask(date, task.id, 'postpone'); updateTask(date, task.id, 'postpone');
  assert.equal(Storage.get().dailyPlans['2026-09-06'].length, 1);
  updateTask(date, task.id, 'completed'); ensurePlan(bank, date, true);
  assert.equal(Storage.get().dailyPlans[date].filter(t => t.id === task.id).length, 1);
  assert.equal(Storage.get().totalLessons, 0); assert.equal(Storage.get().totalCorrect, 0);
});
test('AI context contains only bounded study preferences and explicit selected answer', () => {
  const config = generationContext({}, { profile: { targetScore: 800 }, history: [history('a', false)] });
  assert.equal(config.part, 5); assert.equal(config.targetScore, 800); assert.equal(config.recentMistakes[0].selectedAnswer, 'b');
  assert.ok(config.errorTypes.includes('word-form')); assert.equal(config.apiKey, undefined);
});
test('local dates use local calendar components', () => {
  const date = new Date(2026, 8, 5, 0, 10); assert.equal(localDay(date), '2026-09-05');
});
test('transcript assistance never labels reading answers as assisted', () => {
  const state = { history: [{ ...history('a', false), assisted: true }] };
  assert.equal(analyze(state).parts[0].assisted, 0);
});
