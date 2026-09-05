/**
 * Grammar Module - Renders Grammar Lessons, Formulas & Examples
 */
import { ContentLoader } from './content-loader.js';
import { Progress, localDateKey } from './progress.js';
import { Validator } from './validation.js';

export const GrammarUI = {
  startedAt: 0,
  async init(topic = 'tenses') {
    this.startedAt = Date.now();
    const container = document.getElementById('grammarContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang tải bài học ngữ pháp...</p></div>`;

    const data = await ContentLoader.getGrammarData(topic);
    const rules = data ? data.rules || [] : [];

    this.render(data, rules);
  },

  render(data, rules) {
    const container = document.getElementById('grammarContent');
    if (!container) return;

    if (!rules || rules.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"></div>
          <h3>Chưa có bài học ngữ pháp cho chủ đề này</h3>
        </div>
      `;
      return;
    }

    let html = `
      <div class="grammar-container card animate-fadeIn">
        <div class="grammar-header">
          <h2>${Validator.sanitizeHtml(data.title || 'Ngữ pháp TOEIC')}</h2>
          <button class="btn btn-secondary btn-sm" id="btnMarkGrammarDone">
            ✓ Đánh dấu đã học bài này
          </button>
        </div>

        <div class="rules-list">
    `;

    rules.forEach((rule, idx) => {
      html += `
        <div class="rule-card">
          <div class="rule-title">
            <span class="rule-num">${idx + 1}</span>
            <h3>${Validator.sanitizeHtml(rule.title)}</h3>
          </div>

          ${rule.formula ? `
            <div class="rule-formula">
              <strong>Công thức:</strong> <code>${Validator.sanitizeHtml(rule.formula)}</code>
            </div>
          ` : ''}

          ${rule.usage ? `
            <div class="rule-usage">
              <strong>Cách dùng:</strong> ${Validator.sanitizeHtml(rule.usage)}
            </div>
          ` : ''}

          ${Array.isArray(rule.examples) && rule.examples.length > 0 ? `
            <div class="rule-examples">
              <strong>Ví dụ:</strong>
              <ul>
                ${rule.examples.map(ex => `<li>${Validator.sanitizeHtml(ex)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${rule.keywords ? `
            <div class="rule-keywords">
              <strong>Dấu hiệu nhận biết:</strong> <span class="keywords-pill">${Validator.sanitizeHtml(rule.keywords)}</span>
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    const btnDone = document.getElementById('btnMarkGrammarDone');
    if (btnDone) {
      btnDone.onclick = () => {
        try {
          Progress.completeLesson('grammar', { id: `grammar-${data.topic || data.title}-${localDateKey()}`,
            topic: data.topic, durationSeconds: Math.max(0, Math.round((Date.now() - this.startedAt) / 1000)) });
          btnDone.className = 'btn btn-success btn-sm';
          btnDone.innerHTML = '✓ Đã ghi nhận bài học hôm nay!';
          btnDone.disabled = true;
        } catch (error) { alert(error.message); }
      };
    }
  }
};
