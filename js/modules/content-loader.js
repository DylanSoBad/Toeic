/** Bundled content with persistent local overrides and deletion tombstones. */
import { Storage } from './storage.js';
import { Validator } from './validation.js';

const cache = new Map();
const definitions = [
  ...[1, 2, 3, 4].map(part => ({ path: `listening/part-${part}.json`, skill: 'listening', part })),
  ...[5, 6, 7].map(part => ({ path: `reading/part-${part}.json`, skill: 'reading', part })),
  ...['read-aloud', 'describe-picture', 'respond-questions', 'opinion'].map((name, index) => ({ path: `speaking/${name}.json`, skill: 'speaking', part: index + 1 })),
  ...['sentence', 'email', 'essay'].map((name, index) => ({ path: `writing/${name}.json`, skill: 'writing', part: index + 1 })),
  ...['business', 'office', 'travel', 'finance', 'health'].map(topic => ({ path: `vocabulary/${topic}.json`, skill: 'vocabulary', topic })),
  ...['tenses', 'passive', 'relative-clauses', 'conditionals', 'word-form'].map(topic => ({ path: `grammar/${topic}.json`, skill: 'grammar', topic, key: 'rules' })),
  { path: 'mock-tests/test-01.json', collection: 'mock-tests/test-01', skill: 'mock' }
];
const clone = value => JSON.parse(JSON.stringify(value));
const inferSkill = item => item.skill || (item.word ? 'vocabulary' : item.formula || item.usage ? 'grammar' : undefined);

function normalize(item, definition = {}) {
  const result = { version: 1, level: 'intermediate', topic: definition.topic || 'general', source: 'system', status: 'approved', ...item };
  result.skill = inferSkill(item) || definition.skill;
  if (definition.part !== undefined && result.part === undefined) result.part = definition.part;
  if (definition.collection) result.collection = definition.collection;
  return result;
}
function merge(staticItems, customItems, deletedIds) {
  const merged = new Map(staticItems.map(item => [item.id, item]));
  for (const item of customItems) merged.set(item.id, item);
  for (const id of deletedIds) merged.delete(id);
  return [...merged.values()];
}

export const ContentLoader = {
  errors: [],
  async loadJson(relPath) {
    if (!definitions.some(definition => definition.path === relPath)) return null;
    if (cache.has(relPath)) return clone(cache.get(relPath));
    try {
      const response = await fetch(`data/${relPath}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const definition = definitions.find(entry => entry.path === relPath);
      const key = definition.key || 'items';
      if (!data || typeof data !== 'object' || !Array.isArray(data[key])) throw new Error(`Thiếu mảng ${key}`);
      const normalized = data[key].map(item => normalize(item, definition));
      const validation = Validator.validateQuestionBank(normalized);
      if (!validation.valid) throw new Error(validation.errors.join('; '));
      const result = { ...data, [key]: normalized };
      cache.set(relPath, result);
      this.errors = this.errors.filter(error => error.path !== relPath);
      return clone(result);
    } catch (error) {
      this.errors = this.errors.filter(entry => entry.path !== relPath);
      this.errors.push({ path: relPath, message: error.message });
      console.warn(`Không tải được ${relPath}: ${error.message}`);
      return null;
    }
  },
  clearCache() { cache.clear(); this.errors = []; },
  getLoadErrors() { return clone(this.errors); },
  getCustomExercises() {
    const data = Storage.get();
    return Array.isArray(data.customExercises) ? clone(data.customExercises) : [];
  },
  getDeletedIds() { const data = Storage.get(); return Array.isArray(data.deletedExerciseIds) ? data.deletedExerciseIds : []; },
  _save(data) {
    try {
      const result = Storage.save(data);
      if (result === false) throw new Error('Không thể lưu vào bộ nhớ trình duyệt. Hãy export bản sao và kiểm tra dung lượng.');
      return { success: true };
    } catch (error) { return { success: false, errors: [error.message] }; }
  },
  saveExercise(exercise) { return this.saveExercises([exercise]); },
  saveExercises(exercises) {
    const validation = Validator.validateQuestionBank(exercises);
    if (!validation.valid) return { success: false, errors: validation.errors };
    const data = Storage.get();
    const custom = Array.isArray(data.customExercises) ? data.customExercises : [];
    const now = new Date().toISOString();
    const saved = exercises.map(item => ({ ...clone(item), skill: inferSkill(item), status: item.status || 'draft', source: item.source || 'manual', version: item.version || 1, createdAt: item.createdAt || now, updatedAt: now }));
    const merged = merge(custom, saved, []);
    // A synchronous save checks every static collection already loaded by the UI.
    const staticItems = [...cache.values()].flatMap(value => value.items || value.rules || []);
    const deleted = (data.deletedExerciseIds || []).filter(id => !saved.some(item => item.id === id));
    const combined = merge(staticItems, merged, deleted);
    const check = Validator.validateQuestionBank(combined);
    if (!check.valid) return { success: false, errors: check.errors };
    data.customExercises = merged;
    data.deletedExerciseIds = deleted;
    const result = this._save(data);
    return { ...result, ...(result.success ? { exercise: saved[0], exercises: saved, count: saved.length } : {}) };
  },
  deleteExercise(id) {
    if (typeof id !== 'string' || !id) return false;
    const data = Storage.get();
    data.customExercises = (data.customExercises || []).filter(item => item.id !== id);
    data.deletedExerciseIds = [...new Set([...(data.deletedExerciseIds || []), id])];
    return this._save(data).success;
  },
  async importExercises(items, { replaceExisting = false } = {}) {
    const valid = Validator.validateQuestionBank(items);
    if (!valid.valid || !items.length) return { success: false, errors: valid.errors.length ? valid.errors : ['Danh sách import rỗng.'] };
    const bank = await this.getAllQuestionBank();
    const conflicts = items.filter(item => bank.some(existing => existing.id === item.id)).map(item => item.id);
    if (conflicts.length && !replaceExisting) return { success: false, conflicts, errors: [`ID đã tồn tại: ${conflicts.join(', ')}. Bật thay thế nếu muốn cập nhật các bài này.`] };
    const normalized = items.map(item => ({ ...item, skill: inferSkill(item), source: item.source || 'import', status: /ai|mock/.test(item.source || '') ? 'draft' : item.status || 'draft' }));
    const check = Validator.validateQuestionBank(merge(bank, normalized, []));
    if (!check.valid) return { success: false, errors: check.errors };
    return this.saveExercises(normalized);
  },
  async _getCollection(definition) {
    if (!definition) return null;
    const fileData = await this.loadJson(definition.path) || { title: definition.topic || `Part ${definition.part}`, part: definition.part, topic: definition.topic, loadError: true };
    const key = definition.key || 'items';
    const matches = item => definition.collection ? item.collection === definition.collection : !item.collection && item.skill === definition.skill && (definition.part === undefined || item.part === definition.part) && (definition.topic === undefined || item.topic === definition.topic);
    // Merge before filtering: changed skill/part/status must hide the previous bundled row.
    const values = merge(fileData[key] || [], this.getCustomExercises(), this.getDeletedIds()).filter(matches).filter(item => item.status === 'approved');
    const validation = Validator.validateQuestionBank(values);
    if (!validation.valid) return { ...fileData, [key]: [], loadError: true, errors: validation.errors };
    return { ...fileData, [key]: values };
  },
  async getListeningData(part) { return this._getCollection(definitions.find(definition => definition.skill === 'listening' && definition.part === Number(part))); },
  async getReadingData(part) { return this._getCollection(definitions.find(definition => definition.skill === 'reading' && definition.part === Number(part))); },
  async getSpeakingData(typeId) { return this._getCollection(definitions.find(definition => definition.skill === 'speaking' && definition.part === Number(typeId))); },
  async getWritingData(typeId) { return this._getCollection(definitions.find(definition => definition.skill === 'writing' && definition.part === Number(typeId))); },
  async _getTopic(skill, topic) {
    const definition = definitions.find(entry => entry.skill === skill && entry.topic === topic);
    if (definition) return this._getCollection(definition);
    const key = skill === 'grammar' ? 'rules' : 'items';
    const items = (await this.getAllQuestionBank({ approvedOnly: true })).filter(item => item.skill === skill && item.topic === topic);
    return { title: topic, topic, [key]: items };
  },
  async getVocabData(topic) { return this._getTopic('vocabulary', topic); },
  async getGrammarData(topic) { return this._getTopic('grammar', topic); },
  async getMockTestData() { return this._getCollection(definitions.find(definition => definition.collection)); },
  async getTopics(skill) {
    const bank = await this.getAllQuestionBank({ approvedOnly: true });
    return [...new Set(bank.filter(item => item.skill === skill).map(item => item.topic).filter(Boolean))];
  },
  async getAllQuestionBank({ approvedOnly = false } = {}) {
    const results = await Promise.all(definitions.map(definition => this.loadJson(definition.path)));
    const staticItems = results.flatMap((data, index) => data ? data[definitions[index].key || 'items'] : []);
    const values = merge(staticItems, this.getCustomExercises(), this.getDeletedIds());
    const valid = values.filter(item => Validator.validateQuestion(item).valid);
    return approvedOnly ? valid.filter(item => item.status === 'approved') : valid;
  }
};
