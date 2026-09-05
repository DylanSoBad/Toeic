/** Shared, non-mutating validation for imported, generated and bundled content. */
const SKILLS = ['listening', 'reading', 'speaking', 'writing', 'vocabulary', 'grammar', 'mock'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const STATUSES = ['approved', 'draft', 'rejected'];
const TEXT_FIELDS = ['q', 'question', 'passage', 'transcript', 'audio', 'explanation', 'text', 'sample', 'hint', 'email', 'topicText', 'word', 'meaning', 'phonetic', 'example', 'title', 'formula', 'usage', 'keywords', 'tips', 'translation', 'topic', 'source', 'questionType', 'grammarPoint', 'vocabularyTopic', 'trapType', 'collection', 'model'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const normalized = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export const Validator = {
  sanitizeHtml(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  isSafeMediaUrl(value) {
    if (value == null || value === '') return true;
    if (typeof value !== 'string' || value.length > 2048 || /[\s\\\x00-\x1f]/.test(value)) return false;
    if (/^https?:\/\//i.test(value)) {
      try { const url = new URL(value); return !url.username && !url.password; } catch { return false; }
    }
    return !value.startsWith('//') && !value.includes('..') && !/^[^/]*:/.test(value);
  },

  validateQuestion(item) {
    const errors = [];
    if (!record(item)) return { valid: false, errors: ['Bài tập phải là một object, không được là null hoặc mảng.'] };
    const seen = new Set();
    const walk = (value, depth = 0) => {
      if (!value || typeof value !== 'object') return;
      if (depth > 8 || seen.has(value)) { errors.push('Dữ liệu quá sâu hoặc có tham chiếu vòng.'); return; }
      seen.add(value);
      for (const key of Object.keys(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) errors.push('Trường không được phép: ' + key);
        walk(value[key], depth + 1);
      }
      seen.delete(value);
    };
    walk(item);
    const checkId = (value, label) => {
      if (!hasText(value) || !/^[\p{L}\p{N}][\p{L}\p{N}_.:-]{0,159}$/u.test(value)) errors.push(label + ': ID chỉ được chứa chữ, số, dấu gạch ngang, gạch dưới, dấu chấm hoặc dấu hai chấm (tối đa 160 ký tự).');
    };
    checkId(item.id, 'Bài tập');
    // Bundled v1 vocabulary and grammar records have no explicit skill.
    const skill = item.skill ?? (hasText(item.word) && hasText(item.meaning) ? 'vocabulary' : hasText(item.title) && (hasText(item.usage) || hasText(item.formula)) ? 'grammar' : undefined);
    if (!SKILLS.includes(skill)) errors.push('skill phải là một trong: ' + SKILLS.join(', '));
    if (item.version !== undefined && (!Number.isInteger(item.version) || item.version < 1)) errors.push('version phải là số nguyên dương.');
    if (item.level !== undefined && !LEVELS.includes(item.level)) errors.push('level không hợp lệ.');
    if (item.status !== undefined && !STATUSES.includes(item.status)) errors.push('status phải là approved, draft hoặc rejected.');
    if (item.part !== undefined) {
      const parts = { listening: [1, 2, 3, 4], reading: [5, 6, 7], speaking: [1, 2, 3, 4], writing: [1, 2, 3] };
      if (!Number.isInteger(item.part) || (parts[skill] && !parts[skill].includes(item.part))) errors.push('part không phù hợp với kỹ năng.');
    }
    for (const field of TEXT_FIELDS) {
      if (item[field] !== undefined && (typeof item[field] !== 'string' || item[field].length > 30000)) errors.push(field + ' phải là văn bản tối đa 30000 ký tự.');
    }
    for (const field of ['audioUrl', 'imageUrl']) if (!this.isSafeMediaUrl(item[field])) errors.push(field + ' phải là đường dẫn media tương đối hoặc URL http/https hợp lệ.');
    if (item.examples !== undefined && (!Array.isArray(item.examples) || item.examples.length > 50 || item.examples.some(x => !hasText(x)))) errors.push('examples phải là mảng văn bản không rỗng (tối đa 50 ví dụ).');
    const validateChoice = (question, label) => {
      if (!record(question)) { errors.push(label + ' phải là object.'); return; }
      if (![question.q, question.question, question.transcript, question.audio].some(hasText)) errors.push(label + ' thiếu nội dung câu hỏi.');
      for (const field of ['q', 'question', 'explanation']) if (question[field] !== undefined && (typeof question[field] !== 'string' || question[field].length > 30000)) errors.push(label + ': ' + field + ' phải là văn bản.');
      if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) {
        errors.push(label + ' cần từ 2 đến 6 lựa chọn.');
      } else {
        if (question.options.some(x => !hasText(x) || x.length > 10000)) errors.push(label + ': lựa chọn phải là văn bản không rỗng, tối đa 10000 ký tự.');
        const validOptions = question.options.filter(hasText).map(normalized);
        if (new Set(validOptions).size !== validOptions.length) errors.push(label + ': có lựa chọn trùng lặp.');
        if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options.length) errors.push(label + ': correct phải là chỉ số nguyên hợp lệ trong options (bắt đầu từ 0).');
      }
      if (question.correctAnswer !== undefined && question.correctAnswer !== question.correct) errors.push(label + ': correctAnswer mâu thuẫn với correct; hãy dùng trường correct.');
    };
    const isMulti = item.type === 'multi-question' || item.questions !== undefined;
    const isChoice = item.type === 'single-choice' || item.options !== undefined;
    const allowedTypes = ['single-choice', 'multi-question', 'flashcard', 'grammar-rule', 'open-response', 'read-aloud', 'describe-picture', 'respond-questions', 'opinion', 'sentence', 'email', 'essay'];
    if (item.type !== undefined && !allowedTypes.includes(item.type)) errors.push('type không được hỗ trợ.');
    if (isMulti) {
      if (item.type && item.type !== 'multi-question') errors.push('Bài có questions phải dùng type multi-question.');
      if (![item.passage, item.transcript, item.audio, item.audioUrl].some(hasText)) errors.push('Bài nhóm thiếu passage hoặc transcript/audio.');
      if (!Array.isArray(item.questions) || !item.questions.length || item.questions.length > 50) errors.push('questions phải chứa từ 1 đến 50 câu con.');
      else {
        const ids = new Set([item.id]);
        item.questions.forEach((question, index) => {
          const label = 'Câu con ' + (index + 1);
          if (record(question)) {
            checkId(question.id, label);
            if (ids.has(question.id)) errors.push(label + ': ID trùng lặp ' + question.id);
            ids.add(question.id);
          }
          validateChoice(question, label);
        });
      }
    } else if (isChoice) validateChoice(item, 'Câu hỏi');
    else if (skill === 'vocabulary') {
      if (!hasText(item.word) || !hasText(item.meaning)) errors.push('Từ vựng phải có word và meaning.');
    } else if (skill === 'grammar') {
      if (!hasText(item.title) || ![item.usage, item.formula].some(hasText)) errors.push('Bài ngữ pháp cần title và usage hoặc formula.');
    } else if (skill === 'speaking') {
      if (!hasText(item.text)) errors.push('Speaking cần đề bài trong trường text.');
    } else if (skill === 'writing') {
      if (![item.question, item.hint, item.topicText].some(hasText)) errors.push('Writing cần question, hint hoặc topicText.');
    } else errors.push('Bài tập thiếu cấu trúc câu hỏi được hỗ trợ.');
    return { valid: errors.length === 0, errors };
  },

  validateQuestionBank(items) {
    if (!Array.isArray(items) || items.length > 5000) return { valid: false, errors: ['Ngân hàng phải là mảng tối đa 5000 bài tập.'], totalChecked: 0 };
    const errors = [];
    const ids = new Set();
    items.forEach((item, index) => {
      const result = this.validateQuestion(item);
      errors.push(...result.errors.map(error => '[Bài ' + (index + 1) + '] ' + error));
      const family = record(item) ? [item, ...(Array.isArray(item.questions) ? item.questions : [])] : [];
      for (const question of family) {
        if (!record(question) || typeof question.id !== 'string') continue;
        if (ids.has(question.id)) errors.push('ID trùng trong ngân hàng: ' + question.id);
        ids.add(question.id);
      }
    });
    return { valid: errors.length === 0, errors, totalChecked: items.length };
  }
};
