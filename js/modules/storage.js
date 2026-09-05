/** Versioned local storage. One read/modify/write transaction per recorded action. */
const STORAGE_KEY = 'toeic_master_data';
const CURRENT_VERSION = 3;
const listeners = new Set();
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const count = value => Math.max(0, Math.floor(Number(value) || 0));

function getDefaultState() {
  return {
    version: CURRENT_VERSION, totalLessons: 0, totalAnswered: 0, totalCorrect: 0,
    totalSubmitted: 0, totalUnanswered: 0, streak: 0, lastActiveDate: null,
    dailyLessons: {}, learnedWords: {}, skillListening: 0, skillReading: 0,
    skillSpeaking: 0, skillWriting: 0, mockTests: 0, history: [],
    customExercises: [], deletedExerciseIds: [], processedAttemptIds: [],
    activeAttempts: {}, profile: null, dailyPlans: {}, reviewIds: []
  };
}

export const Storage = {
  init() { return this.get(); },

  get() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const oldRaw = localStorage.getItem('toeic_progress');
      if (!oldRaw) return getDefaultState();
      let legacy;
      try { legacy = JSON.parse(oldRaw); }
      catch { throw new Error('Dữ liệu tiến độ cũ không đọc được. Hãy xuất bản sao trước khi đặt lại dữ liệu.'); }
      const migrated = this.migrate(legacy, 1);
      this.save(migrated);
      return migrated;
    }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error('Dữ liệu học tập bị lỗi JSON; dữ liệu gốc được giữ nguyên.'); }
    if (!object(parsed)) throw new Error('Dữ liệu học tập không đúng cấu trúc; dữ liệu gốc được giữ nguyên.');
    if (Number(parsed.version) > CURRENT_VERSION) {
      throw new Error('Dữ liệu thuộc phiên bản mới hơn. Hãy cập nhật ứng dụng trước khi chỉnh sửa.');
    }
    const normalized = this.migrate(parsed, parsed.version || 1);
    if (parsed.version !== CURRENT_VERSION) this.save(normalized);
    return normalized;
  },

  save(data) {
    if (!object(data)) throw new Error('Không thể lưu dữ liệu học tập không hợp lệ.');
    const next = { ...data, version: CURRENT_VERSION, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error('Không thể lưu: bộ nhớ trình duyệt đầy hoặc bị chặn. Hãy xuất dữ liệu và giải phóng bộ nhớ.'); }
    this.notify(next);
    return next;
  },

  update(mutator) {
    const data = this.get();
    const result = mutator(data);
    if (result === false) return false;
    this.save(data);
    return result === undefined ? data : result;
  },

  migrate(oldData) {
    if (!object(oldData)) return getDefaultState();
    // Keep unknown fields as well as existing content and counters. Migration never invents activity dates.
    const fresh = { ...getDefaultState(), ...oldData, version: CURRENT_VERSION };
    for (const key of ['totalLessons', 'totalAnswered', 'totalCorrect', 'totalSubmitted', 'totalUnanswered',
      'streak', 'skillListening', 'skillReading', 'skillSpeaking', 'skillWriting', 'mockTests']) fresh[key] = count(fresh[key]);
    for (const key of ['dailyLessons', 'learnedWords', 'activeAttempts', 'dailyPlans']) {
      if (!object(fresh[key])) fresh[key] = {};
    }
    for (const key of ['history', 'customExercises', 'deletedExerciseIds', 'processedAttemptIds', 'reviewIds']) {
      if (!Array.isArray(fresh[key])) fresh[key] = [];
    }
    fresh.processedAttemptIds = [...new Set([...fresh.processedAttemptIds,
      ...fresh.history.map(item => item?.attemptId || item?.id).filter(id => typeof id === 'string')])];
    fresh.totalSubmitted = Math.max(fresh.totalSubmitted, fresh.totalAnswered);
    fresh.lastActiveDate = /^\d{4}-\d{2}-\d{2}$/.test(fresh.lastActiveDate || '') ? fresh.lastActiveDate : null;
    if (!object(fresh.profile)) fresh.profile = null;
    return fresh;
  },

  subscribe(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  },
  notify(data) {
    for (const fn of listeners) {
      try { fn(data); } catch (error) { console.error('Không thể cập nhật giao diện tiến độ:', error); }
    }
  },
  clear() {
    const fresh = this.save(getDefaultState());
    localStorage.removeItem('toeic_progress');
    return fresh;
  }
};

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) {
    try { Storage.notify(Storage.get()); } catch (error) { console.error(error.message); }
  }
});
