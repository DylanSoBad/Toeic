import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Storage } from '../js/modules/storage.js';
import { Validator } from '../js/modules/validation.js';
import { ContentLoader } from '../js/modules/content-loader.js';
import { AiGenerator } from '../js/modules/ai-generator.js';
import { TemplateGenerator } from '../js/modules/template-generator.js';
import { generateExercises } from '../server/ai-service.js';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const originalFetch = globalThis.fetch;
const staticFetch = async url => new Response(await fs.readFile(new URL('../' + url, import.meta.url)), { status: 200, headers: { 'content-type': 'application/json' } });
beforeEach(() => { memory.clear(); ContentLoader.clearCache(); globalThis.fetch = staticFetch; });
after(() => { globalThis.fetch = originalFetch; });
test('all six skill collections load and validate without silent drops', async () => {
  const bank = await ContentLoader.getAllQuestionBank(); assert.ok(bank.length > 80);
  assert.deepEqual(ContentLoader.getLoadErrors(), []);
  for (const skill of ['reading', 'listening', 'speaking', 'writing', 'vocabulary', 'grammar']) assert.ok(bank.some(q => q.skill === skill), skill);
  assert.equal(Validator.validateQuestionBank(bank).valid, true);
});
test('static question overrides persist, drafts hide original, deletion survives refresh', async () => {
  const original = (await ContentLoader.getReadingData(5)).items[0];
  assert.equal(ContentLoader.saveExercise({ ...original, q: 'Updated question' }).success, true);
  assert.equal((await ContentLoader.getReadingData(5)).items.find(q => q.id === original.id).q, 'Updated question');
  ContentLoader.saveExercise({ ...original, status: 'draft' });
  assert.ok(!(await ContentLoader.getReadingData(5)).items.some(q => q.id === original.id));
  assert.equal(ContentLoader.deleteExercise(original.id), true); ContentLoader.clearCache();
  assert.ok(!(await ContentLoader.getAllQuestionBank()).some(q => q.id === original.id));
});
test('import refuses conflicts and invalid batch atomically', async () => {
  const item = (await ContentLoader.getAllQuestionBank())[0];
  assert.equal((await ContentLoader.importExercises([item])).success, false);
  const invalid = { ...item, id: 'import-bad', correct: 100 };
  assert.equal((await ContentLoader.importExercises([{ ...item, id: 'import-good' }, invalid])).success, false);
  assert.equal(Storage.get().customExercises.length, 0);
  assert.equal((await ContentLoader.importExercises([{ ...item, q: 'replacement' }], { replaceExisting: true })).success, true);
});
test('validator rejects unsafe shape, child duplicates, fractional answers and duplicate options', () => {
  const q = { id: 'safe', skill: 'reading', part: 5, type: 'single-choice', q: 'Q', options: ['A', 'B'], correct: 0 };
  for (const bad of [null, [], { ...q, skill: 1 }, { ...q, correct: .5 }, { ...q, options: ['A', ' a '] }, { ...q, audioUrl: 'javascript:alert(1)' }, JSON.parse('{"id":"x","skill":"reading","__proto__":{}}')]) assert.equal(Validator.validateQuestion(bad).valid, false);
  assert.equal(Validator.validateQuestion({ id: 'g', skill: 'reading', type: 'multi-question', passage: 'P', questions: [q, q] }).valid, false);
});
test('offline generator does not pad repetitions or silently ignore level', () => {
  const batch = TemplateGenerator.generate({ category: 'all', level: 'all', count: 20 });
  assert.equal(new Set(batch.map(q => q.q)).size, batch.length); assert.equal(Validator.validateQuestionBank(batch).valid, true);
  const advanced = TemplateGenerator.generate({ category: 'all', level: 'advanced', count: 20 });
  assert.ok(advanced.every(q => q.level === 'advanced')); assert.ok(advanced.length < 20);
  assert.throws(() => TemplateGenerator.generate({ category: 'invented' }));
});
test('explicit mocked AI follows real client validation, persists draft, survives reload and needs approval', async () => {
  await ContentLoader.getAllQuestionBank();
  globalThis.fetch = async (url, options) => url === '/api/ai-generate' ? new Response(JSON.stringify(await generateExercises(JSON.parse(options.body), { env: {} })), { status: 200, headers: { 'content-type': 'application/json' } }) : staticFetch(url);
  const response = await AiGenerator.generateQuestions({ skill: 'reading', part: 5, count: 1, useMock: true, level: 'intermediate' });
  assert.equal(response.success, true, response.error);
  const id = response.items[0].id;
  assert.equal(AiGenerator.getDrafts()[0].id, id); assert.ok(!(await ContentLoader.getReadingData(5)).items.some(q => q.id === id));
  assert.equal(AiGenerator.updateDraft({ ...response.items[0], explanation: 'Edited explanation' }).success, true);
  assert.equal(AiGenerator.getDrafts()[0].explanation, 'Edited explanation');
  assert.equal(AiGenerator.approveDraft(id).success, true);
  assert.ok((await ContentLoader.getReadingData(5)).items.some(q => q.id === id));
  assert.ok(Storage.get().customExercises[0].reviewedAt);
});
test('malformed AI JSON and unrequested mock never save content', async () => {
  globalThis.fetch = async () => new Response('broken', { status: 200 });
  assert.equal((await AiGenerator.generateQuestions({ count: 1 })).success, false);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, isMock: true, items: [{}] }), { status: 200 });
  assert.equal((await AiGenerator.generateQuestions({ count: 1 })).success, false);
  assert.equal(Storage.get().customExercises.length, 0);
});
