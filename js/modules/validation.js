/**
 * Validation Module - Strict Schema Validation & HTML Sanitization
 */

export const Validator = {
  /**
   * Basic XSS protection: escape dangerous HTML characters
   */
  sanitizeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Validates a single question item against schema
   * Returns: { valid: boolean, errors: string[] }
   */
  validateQuestion(item) {
    const errors = [];

    if (!item || typeof item !== 'object') {
      return { valid: false, errors: ['Dữ liệu câu hỏi phải là một đối tượng (object)'] };
    }

    if (!item.id || typeof item.id !== 'string' || !item.id.trim()) {
      errors.push('Câu hỏi thiếu trường ID duy nhất hoặc ID không hợp lệ');
    }

    const validSkills = ['listening', 'reading', 'speaking', 'writing', 'vocabulary', 'grammar', 'mock'];
    if (item.skill && !validSkills.includes(item.skill.toLowerCase())) {
      errors.push(`Kỹ năng "${item.skill}" không hợp lệ. Cho phép: ${validSkills.join(', ')}`);
    }

    // Determine type: single-choice or multi-question
    const isMulti = item.type === 'multi-question' || Array.isArray(item.questions);

    if (isMulti) {
      // Must have passage or audio/transcript
      const hasContent = item.passage || item.audio || item.transcript;
      if (!hasContent || typeof hasContent !== 'string' || !hasContent.trim()) {
        errors.push(`Câu hỏi nhóm ID "${item.id || 'N/A'}" thiếu nội dung đoạn văn (passage) hoặc đoạn nghe (audio/transcript)`);
      }

      if (!Array.isArray(item.questions) || item.questions.length === 0) {
        errors.push(`Câu hỏi nhóm ID "${item.id || 'N/A'}" không có danh sách câu hỏi con (questions)`);
      } else {
        item.questions.forEach((sub, subIdx) => {
          if (!sub.q || typeof sub.q !== 'string' || !sub.q.trim()) {
            errors.push(`Câu hỏi con #${subIdx + 1} của ID "${item.id}" thiếu nội dung câu hỏi (q)`);
          }
          if (!Array.isArray(sub.options) || sub.options.length < 2) {
            errors.push(`Câu hỏi con #${subIdx + 1} của ID "${item.id}" phải có tối thiểu 2 phương án lựa chọn`);
          } else {
            if (typeof sub.correct !== 'number' || sub.correct < 0 || sub.correct >= sub.options.length) {
              errors.push(`Câu hỏi con #${subIdx + 1} của ID "${item.id}" có chỉ số đáp án đúng (correct: ${sub.correct}) nằm ngoài danh sách lựa chọn`);
            }
          }
        });
      }
    } else if (item.type === 'single-choice' || Array.isArray(item.options)) {
      // Single-choice question
      const hasPrompt = item.q || item.question || item.audio || item.transcript;
      if (!hasPrompt || typeof hasPrompt !== 'string' || !hasPrompt.trim()) {
        errors.push(`Câu hỏi ID "${item.id || 'N/A'}" thiếu nội dung câu hỏi (q/question) hoặc nghe (audio)`);
      }

      if (!Array.isArray(item.options) || item.options.length < 2) {
        errors.push(`Câu hỏi ID "${item.id || 'N/A'}" phải có mảng options chứa tối thiểu 2 lựa chọn`);
      } else {
        if (typeof item.correct !== 'number' || item.correct < 0 || item.correct >= item.options.length) {
          errors.push(`Câu hỏi ID "${item.id || 'N/A'}" có chỉ số đáp án đúng (${item.correct}) không hợp lệ (options có ${item.options.length} lựa chọn)`);
        }
      }
    } else if (item.skill === 'speaking') {
      if (!item.text && !item.sample) {
        errors.push(`Bài Speaking ID "${item.id || 'N/A'}" thiếu trường text hoặc sample`);
      }
    } else if (item.skill === 'writing') {
      if (!item.question && !item.hint && !item.topicText) {
        errors.push(`Bài Writing ID "${item.id || 'N/A'}" thiếu đề bài hoặc gợi ý`);
      }
    } else if (item.skill === 'vocabulary') {
      if (!item.word || !item.meaning) {
        errors.push(`Từ vựng ID "${item.id || 'N/A'}" thiếu từ (word) hoặc nghĩa (meaning)`);
      }
    } else if (item.skill === 'grammar') {
      if (!item.title) {
        errors.push(`Ngữ pháp ID "${item.id || 'N/A'}" thiếu tiêu đề (title)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Validates a batch or full array of questions, checking duplicate IDs
   * Returns: { valid: boolean, errors: string[], totalChecked: number }
   */
  validateQuestionBank(items) {
    if (!Array.isArray(items)) {
      return { valid: false, errors: ['Ngân hàng câu hỏi phải là một mảng (Array)'], totalChecked: 0 };
    }

    const allErrors = [];
    const seenIds = new Set();

    items.forEach((item, index) => {
      if (!item) {
        allErrors.push(`Mục tại vị trí [${index}] bị null hoặc rỗng`);
        return;
      }

      if (item.id) {
        if (seenIds.has(item.id)) {
          allErrors.push(`Phát hiện ID trùng lặp: "${item.id}" tại vị trí [${index}]`);
        } else {
          seenIds.add(item.id);
        }
      }

      const res = this.validateQuestion(item);
      if (!res.valid) {
        res.errors.forEach(err => allErrors.push(`[Mục ${index + 1}] ${err}`));
      }
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      totalChecked: items.length
    };
  }
};
