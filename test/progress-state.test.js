import test from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../js/modules/storage.js';
import { Progress, calculateStreak, localDateKey } from '../js/modules/progress.js';

const KEY = 'toeic_master_data';
function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  let writes = 0;
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes++; values.set(key, value); },
    removeItem: key => values.delete(key)
  };
  return { values, writes: () => writes };
}
const answeredRows = [
  { id: 'one', skill: 'reading', part: 6, questionType: 'text-completion', grammarPoint: 'tenses',
    parentId: 'passage', passage: 'Context', q: 'A question', options: ['A', 'B'], selected: 0, correct: 0, isAnswered: true, isCorrect: true },
  { id: 'two', skill: 'reading', part: 6, questionType: 'text-completion',
    parentId: 'passage', passage: 'Context', q: 'Another question', options: ['A', 'B'], selected: null, correct: 1, isAnswered: false, isCorrect: false }
];

test('v1 migration preserves counters/content without inventing recent study dates', () => {
  memoryStorage({ toeic_progress: JSON.stringify({ totalLessons: 17, totalAnswered: 20, totalCorrect: 15,
    learnedWords: { meeting: true }, customExercises: [{ id: 'personal' }], unknownPreference: 'preserved' }) });
  const state = Storage.get();
  assert.equal(state.version, 3);
  assert.equal(state.totalLessons, 17);
  assert.equal(state.lastActiveDate, null);
  assert.deepEqual(state.dailyLessons, {});
  assert.equal(Progress.getStats().streak, 0);
  assert.equal(state.unknownPreference, 'preserved');
  assert.equal(state.customExercises[0].id, 'personal');
  assert.equal(state.learnedWords.meeting, true);
});

test('v2 upgrade retains history, tombstones, profile and deduplication keys', () => {
  memoryStorage({ [KEY]: JSON.stringify({ version: 2, totalLessons: 1, history: [{ id: 'legacy-attempt', total: 1 }],
    deletedExerciseIds: ['removed'], profile: { targetScore: 800 }, dailyPlans: { '2026-09-01': ['task'] } }) });
  const state = Storage.get();
  assert.deepEqual(state.deletedExerciseIds, ['removed']);
  assert.deepEqual(state.dailyPlans['2026-09-01'], ['task']);
  assert.equal(state.profile.targetScore, 800);
  assert.equal(Progress.recordQuizResult({ id: 'legacy-attempt', total: 1, correct: 1 }), false);
  assert.equal(Storage.get().totalLessons, 1);
});

test('corrupt stored JSON is not silently overwritten with an empty state', () => {
  const memory = memoryStorage({ [KEY]: '{not-json' });
  assert.throws(() => Storage.get(), /JSON/);
  assert.equal(memory.values.get(KEY), '{not-json');
  assert.equal(memory.writes(), 0);
});

test('one quiz write atomically commits exact answer counts, history and streak', () => {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const state = Storage.migrate({ totalLessons: 1, dailyLessons: { [localDateKey(yesterday)]: 1 } });
  const memory = memoryStorage({ [KEY]: JSON.stringify(state) });
  const result = { id: 'attempt-one', skill: 'reading', part: 6, total: 2, correct: 99, answered: 99,
    breakdown: answeredRows, durationSeconds: 42, kind: 'diagnostic', assisted: true };
  assert.equal(Progress.recordQuizResult(result), true);
  assert.equal(memory.writes(), 1);
  const saved = Storage.get();
  assert.equal(saved.totalLessons, 2);
  assert.equal(saved.totalAnswered, 1);
  assert.equal(saved.totalSubmitted, 2);
  assert.equal(saved.totalCorrect, 1);
  assert.equal(saved.totalUnanswered, 1);
  assert.equal(saved.streak, 2);
  assert.equal(saved.skillReading, 1);
  assert.equal(saved.history[0].durationSeconds, 42);
  assert.equal(saved.history[0].kind, 'diagnostic');
  assert.equal(saved.history[0].assisted, true);
  assert.deepEqual(saved.history[0].breakdown, answeredRows);
  assert.equal(Progress.recordQuizResult(result), false);
  assert.equal(memory.writes(), 1);
  assert.equal(Storage.get().history.length, 1);
});

test('repeated mock submission cannot inflate mocks or history; explicit new attempt can', () => {
  memoryStorage();
  const result = { id: 'mock-one', total: 2, correct: 1, answered: 1, breakdown: answeredRows };
  Progress.recordMockTest(result);
  Progress.recordMockTest(result);
  assert.equal(Storage.get().mockTests, 1);
  Progress.recordMockTest({ ...result, id: 'mock-two' });
  assert.equal(Storage.get().mockTests, 2);
  assert.equal(Storage.get().history.length, 2);
});

test('learning a word does not overwrite lesson/streak changes and duplicate marking is a no-op', () => {
  const memory = memoryStorage();
  Progress.recordWordLearned('meeting');
  assert.equal(memory.writes(), 1);
  assert.equal(Progress.recordWordLearned('meeting'), false);
  const state = Storage.get();
  assert.equal(state.learnedWords.meeting, true);
  assert.equal(state.totalLessons, 1);
  assert.equal(state.dailyLessons[localDateKey()], 1);
  assert.equal(state.streak, 1);
  assert.equal(state.history[0].kind, 'word');
});

test('self-practice records skill and duration but not fictitious test answers', () => {
  memoryStorage();
  Progress.completeLesson('writing', { id: 'writing-attempt', durationSeconds: 80, response: 'My answer.' });
  Progress.completeLesson('writing', { id: 'writing-attempt', durationSeconds: 80 });
  const saved = Storage.get();
  assert.equal(saved.skillWriting, 1);
  assert.equal(saved.totalAnswered, 0);
  assert.equal(saved.history[0].scorePct, null);
  assert.equal(saved.history[0].response, 'My answer.');
});

test('streak follows local calendar days and expires without fabricating activity', () => {
  const daily = { '2026-09-02': 1, '2026-09-03': 2, '2026-09-04': 1 };
  assert.equal(localDateKey(new Date(2026, 8, 5, 0, 1)), '2026-09-05');
  assert.equal(calculateStreak(daily, new Date(2026, 8, 5, 0, 1)), 3);
  assert.equal(calculateStreak(daily, new Date(2026, 8, 6, 12)), 0);
  memoryStorage({ [KEY]: JSON.stringify(Storage.migrate({ dailyLessons: daily, streak: 99 })) });
  const before = localStorage.getItem(KEY);
  Progress.getStats(); Progress.updateStreak();
  assert.equal(localStorage.getItem(KEY), before);
});

test('quota failure reports an error and does not emit a success notification', () => {
  memoryStorage();
  let notifications = 0;
  const unsubscribe = Storage.subscribe(() => notifications++);
  localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => Progress.completeLesson('reading', { id: 'cannot-save' }), /Không thể lưu/);
  assert.equal(notifications, 0);
  assert.equal(Storage.get().totalLessons, 0);
  unsubscribe();
});

test('stats expose genuine part/type breakdown and actual elapsed time', () => {
  memoryStorage();
  Progress.recordQuizResult({ id: 'analytics', total: 2, skill: 'reading', breakdown: answeredRows, durationSeconds: 17 });
  const stats = Progress.getStats();
  assert.deepEqual(stats.byPart['6'], { total: 2, answered: 1, correct: 1, unanswered: 1, wrong: 0, accuracy: 50 });
  assert.equal(stats.byErrorType.tenses.correct, 1);
  assert.equal(stats.studySeconds, 17);
});
