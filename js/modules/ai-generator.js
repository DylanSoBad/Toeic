/**
 * AI Generator Module - Calls AI API, Manages Drafts & Approval Workflow
 */
import { ContentLoader } from './content-loader.js';
import { Validator } from './validation.js';

export const AiGenerator = {
  drafts: [],

  /**
   * Request questions from server AI endpoint
   */
  async generateQuestions(config) {
    try {
      const response = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        let errJson;
        try { errJson = await response.json(); } catch (e) {}
        const msg = (errJson && errJson.error) || `Lỗi máy chủ (${response.status})`;
        return { success: false, error: msg };
      }

      const data = await response.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Không tạo được câu hỏi' };
      }

      const items = (data.items || []).map(it => ({
        ...it,
        status: 'draft',
        source: data.isMock ? 'ai-mock' : 'ai-generated'
      }));

      // Validate each item
      const validated = items.filter(it => {
        const res = Validator.validateQuestion(it);
        if (!res.valid) {
          console.warn('AI item failed validation:', res.errors, it);
        }
        return res.valid;
      });

      this.drafts = validated;

      return {
        success: true,
        items: validated,
        isMock: data.isMock || false,
        warning: data.warning || null
      };
    } catch (err) {
      console.error('AiGenerator error:', err);
      return { success: false, error: 'Không thể kết nối với server: ' + err.message };
    }
  },

  getDrafts() {
    return this.drafts;
  },

  removeDraft(id) {
    this.drafts = this.drafts.filter(x => x.id !== id);
  },

  /**
   * Approve a single draft item and save it to the question bank
   */
  approveDraft(id) {
    const item = this.drafts.find(x => x.id === id);
    if (!item) return { success: false, error: 'Không tìm thấy câu hỏi trong danh sách nháp' };

    const approvedItem = {
      ...item,
      status: 'approved',
      approvedAt: new Date().toISOString()
    };

    const res = ContentLoader.saveExercise(approvedItem);
    if (res.success) {
      this.removeDraft(id);
    }
    return res;
  },

  /**
   * Approve all current drafts
   */
  approveAllDrafts() {
    const results = [];
    const draftsToApprove = [...this.drafts];

    draftsToApprove.forEach(item => {
      const approvedItem = {
        ...item,
        status: 'approved',
        approvedAt: new Date().toISOString()
      };
      const res = ContentLoader.saveExercise(approvedItem);
      if (res.success) {
        this.removeDraft(item.id);
        results.push(approvedItem);
      }
    });

    return {
      success: true,
      count: results.length,
      approvedItems: results
    };
  }
};
