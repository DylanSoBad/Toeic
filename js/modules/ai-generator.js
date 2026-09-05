/** AI client: validate complete responses, persist drafts, and require explicit review. */
import { ContentLoader } from './content-loader.js';
import { Validator } from './validation.js';

const fingerprint = item => [item.passage, item.transcript, item.q, item.question, item.text, item.word, item.title, ...(item.questions || []).map(question => question.q)].filter(Boolean).join(' ').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const allowedConfig = ['skill', 'part', 'topic', 'level', 'count', 'language', 'targetScore', 'questionType', 'errorTypes', 'recentMistakes', 'vocabulary', 'additionalRequirements', 'useMock'];
const configCopy = config => Object.fromEntries(allowedConfig.filter(key => config[key] !== undefined).map(key => [key, config[key]]));
export const AiGenerator = {
  drafts: [],
  async generateQuestions(config) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70000);
    try {
      const safeConfig = configCopy(config || {});
      const response = await fetch('/api/ai-generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safeConfig), signal: controller.signal
      });
      let data;
      try { data = await response.json(); } catch { return { success: false, error: 'Máy chủ trả dữ liệu không phải JSON hợp lệ.' }; }
      if (!response.ok || !data?.success) return { success: false, error: typeof data?.error === 'string' ? data.error : data?.error?.message || `Lỗi máy chủ (${response.status})` };
      if (!Array.isArray(data.items) || data.items.length !== Number(safeConfig.count || 3)) return { success: false, error: 'AI trả sai cấu trúc hoặc số lượng bài; không bài nào được nhập.' };
      if (data.isMock && !safeConfig.useMock) return { success: false, error: 'Máy chủ trả dữ liệu mô phỏng cho yêu cầu AI thật. Hãy cấu hình API key hoặc chủ động chọn thử nghiệm.' };
      const now = new Date().toISOString();
      const items = data.items.map(item => ({
        ...item, status: 'draft', source: data.isMock ? 'ai-mock' : 'ai',
        model: data.model || (data.isMock ? 'mock' : 'unspecified'),
        generationConfig: safeConfig, reviewedAt: null, createdAt: now, updatedAt: now
      }));
      const validation = Validator.validateQuestionBank(items);
      if (!validation.valid) return { success: false, error: 'Toàn bộ lô bị từ chối: ' + validation.errors.join('; '), errors: validation.errors };
      const bank = await ContentLoader.getAllQuestionBank();
      const ids = new Set(bank.flatMap(item => [item.id, ...(item.questions || []).map(child => child.id)]));
      const seenPrompts = new Set(bank.map(fingerprint));
      for (const item of items) {
        if ([item.id, ...(item.questions || []).map(child => child.id)].some(id => ids.has(id))) return { success: false, error: 'AI tạo ID đã tồn tại; không ghi đè ngân hàng.' };
        const key = fingerprint(item);
        if (seenPrompts.has(key)) return { success: false, error: 'Phát hiện nội dung trùng trong lô hoặc ngân hàng. Hãy tạo lại với yêu cầu khác.' };
        seenPrompts.add(key);
        item.validationResult = { valid: true, checkedAt: now, checks: ['schema', 'ids', 'options', 'duplicate-content'] };
      }
      const saved = ContentLoader.saveExercises(items);
      if (!saved.success) return { success: false, error: saved.errors.join('; '), errors: saved.errors };
      this.drafts = this.getDrafts();
      return { success: true, items: saved.exercises, isMock: Boolean(data.isMock), warning: data.warning || (data.isMock ? 'Dữ liệu mô phỏng để kiểm thử luồng; không phải kết quả AI thật.' : 'Hãy kiểm tra đáp án và nội dung trước khi duyệt. Validation cấu trúc không chứng minh nội dung đúng.') };
    } catch (error) {
      return { success: false, error: error.name === 'AbortError' ? 'Tạo bài vượt thời gian chờ. Hãy thử lại với ít bài hơn.' : 'Không thể tạo bài: ' + error.message };
    } finally { clearTimeout(timer); }
  },
  getDrafts() {
    this.drafts = ContentLoader.getCustomExercises().filter(item => item.status === 'draft' && /^(ai|mock)/.test(item.source || ''));
    return this.drafts;
  },
  updateDraft(item) {
    return ContentLoader.saveExercise({ ...item, status: 'draft', reviewedAt: null });
  },
  removeDraft(id) {
    const item = this.getDrafts().find(draft => draft.id === id);
    if (!item) return { success: false, errors: ['Không tìm thấy bản nháp.'] };
    const result = ContentLoader.saveExercise({ ...item, status: 'rejected', reviewedAt: new Date().toISOString() });
    this.getDrafts();
    return result;
  },
  approveDraft(id) {
    const item = this.getDrafts().find(draft => draft.id === id);
    if (!item) return { success: false, errors: ['Không tìm thấy bản nháp.'] };
    const now = new Date().toISOString();
    const result = ContentLoader.saveExercise({ ...item, status: 'approved', reviewedAt: now, approvedAt: now, validationResult: { valid: true, checkedAt: now } });
    this.getDrafts();
    return result;
  },
  approveAllDrafts() {
    const now = new Date().toISOString();
    const items = this.getDrafts().map(item => ({ ...item, status: 'approved', reviewedAt: now, approvedAt: now, validationResult: { valid: true, checkedAt: now } }));
    if (!items.length) return { success: false, count: 0, errors: ['Không có bản nháp để duyệt.'] };
    const result = ContentLoader.saveExercises(items);
    this.getDrafts();
    return { ...result, count: result.success ? items.length : 0, approvedItems: result.success ? items : [] };
  }
};
