/**
 * Storage Module - LocalStorage Versioning, Migration & Reactive Event Bus
 */
const STORAGE_KEY = 'toeic_master_data';
const CURRENT_VERSION = 2;

// Initial schema structure
function getDefaultState() {
  return {
    version: CURRENT_VERSION,
    totalLessons: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    streak: 0,
    lastActiveDate: null,
    dailyLessons: {}, // { 'YYYY-MM-DD': count }
    learnedWords: {}, // { 'word': true }
    skillListening: 0,
    skillReading: 0,
    skillSpeaking: 0,
    skillWriting: 0,
    mockTests: 0,
    history: [], // [{ id, timestamp, skill, part, total, correct, scorePct, durationSeconds }]
    customExercises: [] // exercises created/imported by user or AI
  };
}

const listeners = [];

export const Storage = {
  init() {
    return this.get();
  },

  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Check for old unversioned key 'toeic_progress'
        const oldRaw = localStorage.getItem('toeic_progress');
        if (oldRaw) {
          const oldData = JSON.parse(oldRaw);
          const migrated = this.migrate(oldData, 1);
          this.save(migrated);
          return migrated;
        }
        const initial = getDefaultState();
        this.save(initial);
        return initial;
      }

      const parsed = JSON.parse(raw);
      if (!parsed.version || parsed.version < CURRENT_VERSION) {
        const migrated = this.migrate(parsed, parsed.version || 1);
        this.save(migrated);
        return migrated;
      }
      return parsed;
    } catch (err) {
      console.error('Storage.get error, resetting fallback state:', err);
      return getDefaultState();
    }
  },

  save(data) {
    try {
      data.version = CURRENT_VERSION;
      data.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.notify(data);
    } catch (err) {
      console.error('Storage.save error:', err);
    }
  },

  migrate(oldData, fromVersion) {
    const fresh = getDefaultState();
    if (!oldData || typeof oldData !== 'object') return fresh;

    // Migrate from v1
    fresh.totalLessons = parseInt(oldData.totalLessons, 10) || 0;
    fresh.totalAnswered = parseInt(oldData.totalAnswered, 10) || 0;
    fresh.totalCorrect = parseInt(oldData.totalCorrect, 10) || 0;
    fresh.streak = parseInt(oldData.streak, 10) || (fresh.totalLessons > 0 ? 1 : 0);
    fresh.learnedWords = typeof oldData.learnedWords === 'object' && oldData.learnedWords !== null ? oldData.learnedWords : {};
    fresh.dailyLessons = typeof oldData.dailyLessons === 'object' && oldData.dailyLessons !== null ? oldData.dailyLessons : {};
    fresh.skillListening = parseInt(oldData.skillListening, 10) || 0;
    fresh.skillReading = parseInt(oldData.skillReading, 10) || 0;
    fresh.skillSpeaking = parseInt(oldData.skillSpeaking, 10) || 0;
    fresh.skillWriting = parseInt(oldData.skillWriting, 10) || 0;
    fresh.mockTests = parseInt(oldData.mockTests, 10) || 0;
    fresh.history = Array.isArray(oldData.history) ? oldData.history : [];
    fresh.customExercises = Array.isArray(oldData.customExercises) ? oldData.customExercises : [];
    fresh.lastActiveDate = oldData.lastActiveDate || (fresh.totalLessons > 0 ? new Date().toISOString().slice(0, 10) : null);

    return fresh;
  },

  subscribe(fn) {
    if (typeof fn === 'function' && !listeners.includes(fn)) {
      listeners.push(fn);
    }
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },

  notify(data) {
    listeners.forEach(fn => {
      try { fn(data); } catch (e) { console.error('Storage listener error:', e); }
    });
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('toeic_progress');
      const fresh = getDefaultState();
      this.save(fresh);
      return fresh;
    } catch (err) {
      console.error('Storage.clear error:', err);
    }
  }
};
