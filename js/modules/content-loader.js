/**
 * Content Loader Module - Data Loader, Cache & Custom Exercise Manager
 */
import { Storage } from './storage.js';
import { Validator } from './validation.js';

const cache = new Map();

export const ContentLoader = {
  /**
   * Fetch JSON file from path with cache
   */
  async loadJson(relPath) {
    if (cache.has(relPath)) {
      return cache.get(relPath);
    }

    try {
      const response = await fetch(`data/${relPath}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} when fetching ${relPath}`);
      }
      const data = await response.json();
      cache.set(relPath, data);
      return data;
    } catch (err) {
      console.warn(`ContentLoader: Failed to load data/${relPath}:`, err.message);
      return null;
    }
  },

  /**
   * Get all custom exercises from Storage
   */
  getCustomExercises() {
    const data = Storage.get();
    return Array.isArray(data.customExercises) ? data.customExercises : [];
  },

  /**
   * Add or update an exercise in custom storage
   */
  saveExercise(exercise) {
    const validResult = Validator.validateQuestion(exercise);
    if (!validResult.valid) {
      return { success: false, errors: validResult.errors };
    }

    const data = Storage.get();
    if (!Array.isArray(data.customExercises)) data.customExercises = [];

    const existingIdx = data.customExercises.findIndex(x => x.id === exercise.id);
    exercise.updatedAt = new Date().toISOString();

    if (existingIdx !== -1) {
      data.customExercises[existingIdx] = exercise;
    } else {
      if (!exercise.createdAt) exercise.createdAt = new Date().toISOString();
      data.customExercises.push(exercise);
    }

    Storage.save(data);
    return { success: true, exercise };
  },

  /**
   * Delete an exercise
   */
  deleteExercise(exerciseId) {
    const data = Storage.get();
    if (!Array.isArray(data.customExercises)) return false;

    const initialLen = data.customExercises.length;
    data.customExercises = data.customExercises.filter(x => x.id !== exerciseId);

    if (data.customExercises.length !== initialLen) {
      Storage.save(data);
      return true;
    }
    return false;
  },

  /**
   * Fetch listening data for a specific part (1, 2, 3, 4) merged with custom questions
   */
  async getListeningData(part) {
    const fileMap = {
      1: 'listening/part-1.json',
      2: 'listening/part-2.json',
      3: 'listening/part-3.json',
      4: 'listening/part-4.json'
    };

    const filePath = fileMap[part];
    let fileData = filePath ? await this.loadJson(filePath) : null;
    if (!fileData) {
      fileData = { part, title: `Part ${part}`, items: [] };
    }

    // Merge with approved custom listening exercises for this part
    const custom = this.getCustomExercises().filter(
      x => x.skill === 'listening' && parseInt(x.part, 10) === parseInt(part, 10) && x.status === 'approved'
    );

    return {
      ...fileData,
      items: [...(fileData.items || []), ...custom]
    };
  },

  /**
   * Fetch reading data for a specific part (5, 6, 7) merged with custom questions
   */
  async getReadingData(part) {
    const fileMap = {
      5: 'reading/part-5.json',
      6: 'reading/part-6.json',
      7: 'reading/part-7.json'
    };

    const filePath = fileMap[part];
    let fileData = filePath ? await this.loadJson(filePath) : null;
    if (!fileData) {
      fileData = { part, title: `Part ${part}`, items: [] };
    }

    const custom = this.getCustomExercises().filter(
      x => x.skill === 'reading' && parseInt(x.part, 10) === parseInt(part, 10) && x.status === 'approved'
    );

    return {
      ...fileData,
      items: [...(fileData.items || []), ...custom]
    };
  },

  /**
   * Fetch speaking data
   */
  async getSpeakingData(typeId) {
    const fileMap = {
      1: 'speaking/read-aloud.json',
      2: 'speaking/describe-picture.json',
      3: 'speaking/respond-questions.json',
      4: 'speaking/opinion.json'
    };
    const filePath = fileMap[typeId];
    return filePath ? await this.loadJson(filePath) : null;
  },

  /**
   * Fetch writing data
   */
  async getWritingData(typeId) {
    const fileMap = {
      1: 'writing/sentence.json',
      2: 'writing/email.json',
      3: 'writing/essay.json'
    };
    const filePath = fileMap[typeId];
    return filePath ? await this.loadJson(filePath) : null;
  },

  /**
   * Fetch vocabulary topic
   */
  async getVocabData(topic) {
    return await this.loadJson(`vocabulary/${topic}.json`);
  },

  /**
   * Fetch grammar topic
   */
  async getGrammarData(topic) {
    return await this.loadJson(`grammar/${topic}.json`);
  },

  /**
   * Fetch mock test
   */
  async getMockTestData() {
    return await this.loadJson('mock-tests/test-01.json');
  },

  /**
   * Get all active and draft questions across all categories for Admin Question Bank
   */
  async getAllQuestionBank() {
    const all = [];

    // Load from static JSON files
    const staticFiles = [
      'listening/part-1.json',
      'listening/part-2.json',
      'listening/part-3.json',
      'listening/part-4.json',
      'reading/part-5.json',
      'reading/part-6.json',
      'reading/part-7.json'
    ];

    for (const f of staticFiles) {
      const data = await this.loadJson(f);
      if (data && Array.isArray(data.items)) {
        data.items.forEach(item => {
          all.push({
            ...item,
            source: item.source || 'system',
            status: item.status || 'approved'
          });
        });
      }
    }

    // Add custom & AI exercises from localStorage
    const custom = this.getCustomExercises();
    custom.forEach(item => {
      // Avoid duplicate by ID if static file also had it
      if (!all.some(x => x.id === item.id)) {
        all.push(item);
      }
    });

    return all;
  }
};
