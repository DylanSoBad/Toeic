/**
 * Admin Module - Question Bank Management, Offline Template Generator & AI Generator UI
 */
import { ContentLoader } from './content-loader.js';
import { Validator } from './validation.js';
import { TemplateGenerator } from './template-generator.js';
import { AiGenerator } from './ai-generator.js';

let activeSubTab = 'bank'; // 'bank' | 'template' | 'ai'
let allQuestions = [];
let filterSkill = 'all';
let filterLevel = 'all';
let filterStatus = 'all';
let filterPart = 'all';
let filterTopic = 'all';
let searchKeyword = '';
let generationContext = {};

function matchesFilters(item) {
  return (filterSkill === 'all' || item.skill === filterSkill)
    && (filterLevel === 'all' || item.level === filterLevel)
    && (filterStatus === 'all' || item.status === filterStatus)
    && (filterPart === 'all' || String(item.part) === filterPart)
    && (filterTopic === 'all' || item.topic === filterTopic)
    && (!searchKeyword.trim() || JSON.stringify(item).toLowerCase().includes(searchKeyword.trim().toLowerCase()));
}

export const AdminUI = {
  setGenerationContext(context = {}) { generationContext = { ...context }; activeSubTab = 'ai'; },
  async init() {
    activeSubTab = Object.keys(generationContext).length ? 'ai' : 'bank';
    const container = document.getElementById('adminContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang nạp ngân hàng câu hỏi...</p></div>`;

    await this.refreshData();
    this.render();
  },

  async refreshData() {
    allQuestions = await ContentLoader.getAllQuestionBank();
  },

  render() {
    const container = document.getElementById('adminContent');
    if (!container) return;

    let html = `
      <div class="admin-dashboard card animate-fadeIn">
        <div class="admin-header">
          <div>
            <h2> Quản lý nội dung & Bộ sinh bài tập</h2>
            <p class="admin-subtitle">Quản lý ngân hàng câu hỏi, tạo bài tập tự động bằng AI hoặc theo mẫu có sẵn.</p>
          </div>
          <div class="admin-stats-summary">
            <span class="stat-pill">Tổng: <strong>${allQuestions.length}</strong> bài</span>
            <span class="stat-pill status-draft">Bản nháp: <strong>${allQuestions.filter(x => x.status === 'draft').length}</strong></span>
          </div>
        </div>

        <!-- Sub-tabs Navigation -->
        <div class="admin-tabs-nav">
          <button class="admin-tab-btn ${activeSubTab === 'bank' ? 'active' : ''}" data-subtab="bank">
             Ngân hàng câu hỏi (${allQuestions.length})
          </button>
          <button class="admin-tab-btn ${activeSubTab === 'template' ? 'active' : ''}" data-subtab="template">
             Sinh bài tập mẫu (Offline)
          </button>
          <button class="admin-tab-btn ${activeSubTab === 'ai' ? 'active' : ''}" data-subtab="ai">
             Tạo bài tập bằng AI
          </button>
        </div>

        <!-- Tab Content View -->
        <div class="admin-tab-body" id="adminTabBody">
    `;

    if (activeSubTab === 'bank') {
      html += this.renderBankView();
    } else if (activeSubTab === 'template') {
      html += this.renderTemplateView();
    } else if (activeSubTab === 'ai') {
      html += this.renderAiView();
    }

    html += `
        </div>
      </div>

      <!-- Preview / Edit Modal Container -->
      <div class="modal-backdrop" id="adminModal" style="display:none;">
        <div class="modal-dialog" id="adminModalContent"></div>
      </div>
    `;

    container.innerHTML = html;
    this.attachSubTabEvents();

    if (activeSubTab === 'bank') {
      this.attachBankEvents();
    } else if (activeSubTab === 'template') {
      this.attachTemplateEvents();
    } else if (activeSubTab === 'ai') {
      this.attachAiEvents();
    }
  },

  attachSubTabEvents() {
    const tabs = document.querySelectorAll('.admin-tab-btn');
    tabs.forEach(tab => {
      tab.onclick = () => {
        activeSubTab = tab.getAttribute('data-subtab');
        this.render();
      };
    });
  },

  // ==========================================
  // VIEW 1: QUESTION BANK LIST & CRUD
  // ==========================================
  renderBankView() {
    // Apply filters
    const filtered = allQuestions.filter(matchesFilters);

    return `
      <div class="bank-controls-bar">
        ${ContentLoader.getLoadErrors().length ? `<div role="alert" class="error-alert-box">Một số bộ dữ liệu chưa tải được: ${ContentLoader.getLoadErrors().map(error => Validator.sanitizeHtml(error.path + ': ' + error.message)).join('<br>')}</div>` : ''}
        <div class="filter-group">
          <input type="text" class="form-input search-input" id="bankSearchInput" placeholder=" Tìm kiếm câu hỏi, từ khóa, ID..." value="${Validator.sanitizeHtml(searchKeyword)}">

          <select class="form-select" id="bankFilterSkill">
            <option value="all" ${filterSkill === 'all' ? 'selected' : ''}>Tất cả kỹ năng</option>
            <option value="listening" ${filterSkill === 'listening' ? 'selected' : ''}>Listening</option>
            <option value="reading" ${filterSkill === 'reading' ? 'selected' : ''}>Reading</option>
            <option value="speaking" ${filterSkill === 'speaking' ? 'selected' : ''}>Speaking</option>
            <option value="writing" ${filterSkill === 'writing' ? 'selected' : ''}>Writing</option>
            <option value="vocabulary" ${filterSkill === 'vocabulary' ? 'selected' : ''}>Từ vựng</option>
            <option value="grammar" ${filterSkill === 'grammar' ? 'selected' : ''}>Ngữ pháp</option>
          </select>

          <select class="form-select" id="bankFilterLevel">
            <option value="all" ${filterLevel === 'all' ? 'selected' : ''}>Tất cả độ khó</option>
            <option value="beginner" ${filterLevel === 'beginner' ? 'selected' : ''}>Beginner</option>
            <option value="intermediate" ${filterLevel === 'intermediate' ? 'selected' : ''}>Intermediate</option>
            <option value="advanced" ${filterLevel === 'advanced' ? 'selected' : ''}>Advanced</option>
          </select>

          <select class="form-select" id="bankFilterStatus">
            <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
            <option value="approved" ${filterStatus === 'approved' ? 'selected' : ''}>Approved (Hoạt động)</option>
            <option value="draft" ${filterStatus === 'draft' ? 'selected' : ''}>Draft (Bản nháp)</option>
            <option value="rejected" ${filterStatus === 'rejected' ? 'selected' : ''}>Đã từ chối</option>
          </select>
          <select class="form-select" id="bankFilterPart" aria-label="Lọc theo Part"><option value="all">Tất cả Part</option>${[1, 2, 3, 4, 5, 6, 7].map(part => `<option value="${part}" ${filterPart === String(part) ? 'selected' : ''}>Part ${part}</option>`).join('')}</select>
          <select class="form-select" id="bankFilterTopic" aria-label="Lọc theo chủ đề"><option value="all">Tất cả chủ đề</option>${[...new Set(allQuestions.map(item => item.topic).filter(Boolean))].map(topic => `<option value="${Validator.sanitizeHtml(topic)}" ${filterTopic === topic ? 'selected' : ''}>${Validator.sanitizeHtml(topic)}</option>`).join('')}</select>
        </div>

        <div class="action-buttons-group">
          <button class="btn btn-primary btn-sm" id="btnAddNewExercise"> Thêm câu hỏi</button>
          <button class="btn btn-secondary btn-sm" id="btnImportJson"> Import JSON</button>
          <button class="btn btn-secondary btn-sm" id="btnExportFilteredJson"> Export kết quả</button>
          <button class="btn btn-secondary btn-sm" id="btnExportAllJson"> Export tất cả</button>
        </div>
      </div>

      <div class="bank-table-wrapper">
        <table class="bank-table">
          <thead>
            <tr>
              <th style="width: 130px;">ID</th>
              <th style="width: 100px;">Kỹ năng</th>
              <th>Nội dung câu hỏi / Tóm tắt</th>
              <th style="width: 110px;">Chủ đề</th>
              <th style="width: 90px;">Độ khó</th>
              <th style="width: 90px;">Trạng thái</th>
              <th style="width: 180px; text-align: right;">Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="7" class="text-center py-4 text-muted">Không tìm thấy câu hỏi nào phù hợp với bộ lọc.</td>
              </tr>
            ` : filtered.map(item => {
              const summary = item.q || item.question || item.audio || item.transcript || item.passage || item.word || item.title || item.text || item.hint || item.topicText || 'N/A';
              const isMulti = item.type === 'multi-question' || Array.isArray(item.questions);
              return `
                <tr>
                  <td><code>${Validator.sanitizeHtml(item.id)}</code></td>
                  <td>
                    <span class="badge ${item.skill === 'listening' ? 'badge-info' : 'badge-accent'}">
                      ${Validator.sanitizeHtml(item.skill || 'reading')} ${item.part ? `P${item.part}` : ''}
                    </span>
                  </td>
                  <td>
                    <div class="bank-question-preview">
                      ${isMulti ? `<span class="multi-indicator">[Đoạn văn + ${item.questions ? item.questions.length : 0} câu hỏi]</span> ` : ''}
                      ${Validator.sanitizeHtml(summary)}
                    </div>
                  </td>
                  <td><span class="tag-topic">${Validator.sanitizeHtml(item.topic || 'General')}</span></td>
                  <td><span class="tag-level">${Validator.sanitizeHtml(item.level || 'intermediate')}</span></td>
                  <td>
                    <span class="status-badge ${item.status === 'draft' ? 'draft' : 'approved'}">
                      ${item.status === 'draft' ? 'Bản nháp' : item.status === 'rejected' ? 'Đã từ chối' : 'Đã duyệt'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div class="item-actions">
                      ${item.status !== 'approved' ? `<button class="btn-icon" data-action="approve" data-id="${Validator.sanitizeHtml(item.id)}" title="Duyệt bài này">✓</button>` : ''}
                      <button class="btn-icon" data-action="preview" data-id="${item.id}" title="Xem trước & làm thử"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/></svg></button>
                      <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Chỉnh sửa"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m4 16 12-12 4 4L8 20l-5 1 1-5m9-9 4 4"/></svg></button>
                      <button class="btn-icon" data-action="duplicate" data-id="${item.id}" title="Nhân bản"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 8h13v13H8zM16 5V2H2v14h3"/></svg></button>
                      <button class="btn-icon danger" data-action="delete" data-id="${item.id}" title="Xóa"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  attachBankEvents() {
    for (const [id, set] of [['bankFilterPart', value => { filterPart = value; }], ['bankFilterTopic', value => { filterTopic = value; }]]) {
      const select = document.getElementById(id);
      if (select) select.onchange = () => { set(select.value); this.render(); };
    }
    const searchInput = document.getElementById('bankSearchInput');
    if (searchInput) {
      searchInput.oninput = () => {
        searchKeyword = searchInput.value;
        this.render();
        const replacement = document.getElementById('bankSearchInput');
        replacement?.focus();
        replacement?.setSelectionRange(searchKeyword.length, searchKeyword.length);
      };
    }

    const filterSkillSelect = document.getElementById('bankFilterSkill');
    if (filterSkillSelect) {
      filterSkillSelect.onchange = () => {
        filterSkill = filterSkillSelect.value;
        this.render();
      };
    }

    const filterLevelSelect = document.getElementById('bankFilterLevel');
    if (filterLevelSelect) {
      filterLevelSelect.onchange = () => {
        filterLevel = filterLevelSelect.value;
        this.render();
      };
    }

    const filterStatusSelect = document.getElementById('bankFilterStatus');
    if (filterStatusSelect) {
      filterStatusSelect.onchange = () => {
        filterStatus = filterStatusSelect.value;
        this.render();
      };
    }

    // Actions delegation
    const actionBtns = document.querySelectorAll('.bank-table button[data-action]');
    actionBtns.forEach(btn => {
      btn.onclick = async () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const item = allQuestions.find(x => x.id === id);
        if (!item) return;

        if (action === 'preview') this.openPreviewModal(item);
        if (action === 'edit') this.openEditModal(item);
        if (action === 'duplicate') this.duplicateItem(item);
        if (action === 'delete') this.deleteItem(item);
        if (action === 'approve') {
          const result = ContentLoader.saveExercise({ ...item, status: 'approved', reviewedAt: new Date().toISOString() });
          if (!result.success) alert(result.errors.join('\n'));
          await this.refreshData(); this.render();
        }
      };
    });

    // Add new
    const btnAdd = document.getElementById('btnAddNewExercise');
    if (btnAdd) {
      btnAdd.onclick = () => this.openAddModal();
    }

    // Import JSON
    const btnImport = document.getElementById('btnImportJson');
    if (btnImport) {
      btnImport.onclick = () => this.openImportModal();
    }

    // Export Filtered
    const btnExportFiltered = document.getElementById('btnExportFilteredJson');
    if (btnExportFiltered) {
      btnExportFiltered.onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allQuestions.filter(matchesFilters), null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `toeic_export_${Date.now()}.json`);
        dl.click();
      };
    }

    // Export All
    const btnExportAll = document.getElementById('btnExportAllJson');
    if (btnExportAll) {
      btnExportAll.onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allQuestions, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `toeic_master_bank_full_${Date.now()}.json`);
        dl.click();
      };
    }
  },

  // ==========================================
  // VIEW 2: OFFLINE TEMPLATE GENERATOR
  // ==========================================
  renderTemplateView() {
    return `
      <div class="template-gen-container">
        <div class="template-gen-header card">
          <h3> Bộ sinh bài tập theo mẫu (Hoạt động hoàn toàn Offline)</h3>
          <p>Bộ mẫu hỗ trợ Reading Part 5 về ngữ pháp và từ vựng. Mỗi câu trong một lần tạo là duy nhất; nếu kho mẫu ít hơn số yêu cầu, hệ thống trả đúng số mẫu hiện có. Đây là bộ quy tắc offline, không phải AI.</p>

          <div class="template-form-grid">
            <div class="form-group">
              <label>Dạng bài / Chuyên đề:</label>
              <select class="form-select" id="tmplCategory">
                <option value="all">Tất cả chuyên đề</option>
                <option value="tenses">Các thì trong tiếng Anh (Tenses)</option>
                <option value="word-form">Hình thức từ (Word Form - N/V/Adj/Adv)</option>
                <option value="passive">Câu bị động (Passive Voice)</option>
                <option value="conditionals">Câu điều kiện (loại 1, 2, 3)</option>
                <option value="vocab">Từ vựng doanh nghiệp & công sở</option>
              </select>
            </div>

            <div class="form-group">
              <label>Độ khó:</label>
              <select class="form-select" id="tmplLevel">
                <option value="all">Tất cả độ khó</option>
                <option value="beginner">Beginner (Cơ bản)</option>
                <option value="intermediate" selected>Intermediate (Trung cấp)</option>
                <option value="advanced">Advanced (Nâng cao)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Số lượng câu muốn tạo:</label>
              <input type="number" class="form-input" id="tmplCount" value="5" min="1" max="20">
            </div>
            <label><input type="checkbox" id="tmplExplanation" checked> Kèm giải thích</label>

            <div class="form-group" style="display:flex; align-items:flex-end;">
              <button class="btn btn-primary" id="btnGenerateTemplate" style="width:100%;">
                 Sinh bài tập ngay
              </button>
            </div>
          </div>
        </div>

        <div id="templateResultBox" class="template-results-area" style="display:none;"></div>
      </div>
    `;
  },

  attachTemplateEvents() {
    const btnGen = document.getElementById('btnGenerateTemplate');
    if (btnGen) {
      btnGen.onclick = () => {
        const cat = document.getElementById('tmplCategory').value;
        const lvl = document.getElementById('tmplLevel').value;
        const count = parseInt(document.getElementById('tmplCount').value, 10) || 5;

        try {
          const generated = TemplateGenerator.generate({ category: cat, level: lvl, count, withExplanation: document.getElementById('tmplExplanation').checked });
          this.renderTemplateResults(generated);
          if (generated.length < count) document.getElementById('templateResultBox').insertAdjacentHTML('afterbegin', `<p role="status">Kho mẫu phù hợp có ${generated.length} câu khác nhau; đã tạo toàn bộ số này.</p>`);
        } catch (error) { alert(error.message); }
      };
    }
  },

  renderTemplateResults(items) {
    const box = document.getElementById('templateResultBox');
    if (!box) return;

    box.style.display = 'block';
    box.innerHTML = `
      <div class="results-header card">
        <h4>Kết quả vừa sinh: <strong>${items.length}</strong> câu hỏi</h4>
        <button class="btn btn-success btn-sm" id="btnSaveAllGeneratedTemplate">
          ✓ Thêm tất cả vào Ngân hàng câu hỏi
        </button>
      </div>

      <div class="generated-items-list">
        ${items.map((it, idx) => `
          <div class="generated-item-card card">
            <div class="item-header">
              <span class="badge badge-accent">Câu #${idx + 1}</span>
              <span class="topic-tag">${Validator.sanitizeHtml(it.topic)}</span>
              <span class="level-tag">${Validator.sanitizeHtml(it.level)}</span>
            </div>
            <div class="item-q"><strong>Đề bài:</strong> ${Validator.sanitizeHtml(it.q)}</div>
            <div class="item-options-preview">
              ${it.options.map((opt, oIdx) => `
                <div class="preview-opt ${oIdx === it.correct ? 'is-correct' : ''}">
                  <strong>${String.fromCharCode(65 + oIdx)}.</strong> ${Validator.sanitizeHtml(opt)}
                  ${oIdx === it.correct ? ' <em>(Đáp án đúng)</em>' : ''}
                </div>
              `).join('')}
            </div>
            <div class="item-exp"> <strong>Giải thích:</strong> ${Validator.sanitizeHtml(it.explanation)}</div>
            <div class="item-footer-actions">
              <button class="btn btn-primary btn-sm btn-save-single-gen" data-idx="${idx}">
                ✓ Thêm câu này vào ngân hàng
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Save single
    const saveSingleBtns = box.querySelectorAll('.btn-save-single-gen');
    saveSingleBtns.forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.getAttribute('data-idx'), 10);
        const item = items[idx];
        const res = ContentLoader.saveExercise(item);
        if (res.success) {
          b.disabled = true;
          b.className = 'btn btn-success btn-sm';
          b.innerHTML = '✓ Đã lưu vào ngân hàng';
          this.refreshData();
        } else {
          alert('Lỗi lưu câu hỏi: ' + (res.errors || []).join(', '));
        }
      };
    });

    // Save all
    const saveAllBtn = document.getElementById('btnSaveAllGeneratedTemplate');
    if (saveAllBtn) {
      saveAllBtn.onclick = async () => {
        const result = ContentLoader.saveExercises(items);
        if (!result.success) { alert(result.errors.join('\n')); return; }
        alert(`Đã thêm ${result.count} câu hỏi vào ngân hàng.`);
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '✓ Đã thêm tất cả';
        await this.refreshData();
      };
    }
  },

  // ==========================================
  // VIEW 3: AI EXERCISE GENERATOR
  // ==========================================
  renderAiView() {
    const drafts = AiGenerator.getDrafts();

    return `
      <div class="ai-gen-container">
        <div class="ai-gen-card card">
          <div class="ai-card-header">
            <h3> Bộ tạo bài tập bằng Trí tuệ Nhân tạo (AI Generator)</h3>
            <p>Tạo bài luyện tập mới và lưu bản nháp để bạn duyệt. Cần kiểm tra đáp án và tính rõ ràng của nội dung; kiểm tra schema không bảo đảm AI trả lời đúng. Mock chỉ dùng thử luồng, không gọi AI thật.</p>
            ${Object.keys(generationContext).length ? '<p class="badge badge-info">Đã nhận ngữ cảnh luyện tập từ kết quả học của bạn.</p>' : ''}
          </div>

          <div class="ai-form-grid">
            <div class="form-group">
              <label>Kỹ năng (Skill):</label>
              <select class="form-select" id="aiSkill">
                <option value="reading" selected>Reading</option>
                <option value="listening">Listening</option>
                <option value="speaking">Speaking</option>
                <option value="writing">Writing</option>
                <option value="vocabulary">Vocabulary</option>
                <option value="grammar">Grammar</option>
              </select>
            </div>

            <div class="form-group">
              <label>Phần thi (Part):</label>
              <select class="form-select" id="aiPart">
                <option value="5" selected>Part 5: Hoàn thành câu (Incomplete Sentences)</option>
                <option value="6">Part 6: Hoàn thành đoạn văn (Text Completion)</option>
                <option value="7">Part 7: Đọc hiểu (Reading Comprehension)</option>
                <option value="1">Part 1: Mô tả hình ảnh (Photographs)</option>
                <option value="2">Part 2: Hỏi & Đáp (Question-Response)</option>
                <option value="3">Part 3: Hội thoại</option>
                <option value="4">Part 4: Bài nói</option>
              </select>
            </div>

            <div class="form-group">
              <label>Chủ đề (Topic):</label>
              <select class="form-select" id="aiTopic">
                <option value="business" selected>Kinh doanh & Đàm phán (Business)</option>
                <option value="office">Môi trường văn phòng (Office)</option>
                <option value="travel">Du lịch & Đặt chỗ (Travel)</option>
                <option value="finance">Tài chính & Ngân sách (Finance)</option>
                <option value="personnel">Tuyển dụng & Nhân sự (Personnel)</option>
                <option value="customer-service">Chăm sóc khách hàng (Customer Service)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Mục tiêu điểm số (Target TOEIC Score):</label>
              <select class="form-select" id="aiTargetScore">
                <option value="250-450">250 - 450 (Cơ bản / Elementary)</option>
                <option value="450-650" selected>450 - 650 (Trung cấp / Intermediate)</option>
                <option value="650-750">650 - 750 (Khá / Upper-Intermediate)</option>
                <option value="750-990">750 - 990 (Nâng cao / Advanced)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Số bài / nhóm câu muốn tạo (1-10):</label>
              <input type="number" class="form-input" id="aiCount" value="3" min="1" max="10">
            </div>

            <div class="form-group">
              <label>Ngôn ngữ giải thích:</label>
              <select class="form-select" id="aiLang">
                <option value="vi" selected>Tiếng Việt</option>
                <option value="en">Tiếng Anh (English)</option>
              </select>
            </div>
            <div class="form-group"><label for="aiLevel">Độ khó:</label><select id="aiLevel" class="form-select"><option value="beginner">Beginner</option><option value="intermediate" selected>Intermediate</option><option value="advanced">Advanced</option></select></div>
            <div class="form-group"><label for="aiErrors">Dạng lỗi cần ôn (phân cách bằng dấu phẩy):</label><input id="aiErrors" class="form-input" maxlength="500" placeholder="word-form, inference, vocabulary"></div>

            <div class="form-group full-width">
              <label>Ghi chú / Yêu cầu cụ thể thêm cho AI (Tùy chọn):</label>
              <input type="text" class="form-input" id="aiExtra" placeholder="Ví dụ: Tập trung vào liên từ tương quan và câu điều kiện loại 3...">
            </div>
          </div>

          <div class="ai-action-bar">
            <button class="btn btn-primary btn-lg" id="btnSubmitAiGenerate">
               Bắt đầu sinh câu hỏi bằng AI
            </button>
            <button class="btn btn-secondary btn-lg" id="btnTestAiMock">
               Thử nghiệm chế độ Mock (Không cần API key)
            </button>
          </div>

          <div id="aiLoadingIndicator" style="display:none;" class="loading-box">
            <div class="spinner"></div>
            <p>Đang gửi yêu cầu đến server AI và phân tích chuẩn ngữ pháp TOEIC. Vui lòng đợi trong giây lát...</p>
          </div>
        </div>

        <!-- Draft Review Section -->
        <div class="draft-review-section card" id="aiDraftReviewSection">
          <div class="draft-header">
            <h4>Hộp thư nháp kiểm duyệt (${drafts.length} câu đang chờ duyệt)</h4>
            ${drafts.length > 0 ? `
              <button class="btn btn-success btn-sm" id="btnApproveAllDrafts">
                ✓ Phê duyệt tất cả & Lưu vào Ngân hàng
              </button>
            ` : ''}
          </div>

          <div class="draft-list" id="aiDraftList">
            ${drafts.length === 0 ? `
              <div class="empty-drafts-hint">
                <p>Chưa có câu hỏi nháp nào. Hãy bấm "Bắt đầu sinh câu hỏi bằng AI" ở trên để tạo câu hỏi mới.</p>
              </div>
            ` : drafts.map((draft, idx) => `
              <div class="draft-item-card card" id="draft-card-${draft.id}">
                <div class="item-header">
                  <span class="badge badge-warning">Bản nháp #${idx + 1}</span>
                  <span class="topic-tag">${Validator.sanitizeHtml(draft.topic || 'General')}</span>
                  <span class="level-tag">${Validator.sanitizeHtml(draft.level || 'intermediate')}</span>
                  <span class="source-tag">${Validator.sanitizeHtml(draft.source || 'ai')}</span>
                </div>

                <div class="item-q">
                  <strong>Nội dung:</strong> ${Validator.sanitizeHtml(draft.q || draft.question || draft.text || draft.word || draft.title || 'Bài theo đoạn')}
                </div>

                <div class="interactive-preview-options">
                  <span class="opt-hint">Bấm thử để kiểm tra đáp án:</span>
                  <div class="options-grid">
                    ${(draft.options || []).map((opt, oIdx) => `
                      <button class="option-btn draft-test-opt" data-draft-id="${draft.id}" data-opt-idx="${oIdx}">
                        <span class="option-label">${String.fromCharCode(65 + oIdx)}</span>
                        <span class="option-text">${Validator.sanitizeHtml(opt)}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>

                <div class="explanation-box visible">
                  <span class="exp-icon"></span>
                  <div class="exp-text">${Array.isArray(draft.options) ? `<strong>Đáp án đúng:</strong> ${String.fromCharCode(65 + draft.correct)} - ${Validator.sanitizeHtml(draft.options[draft.correct])}` : `<strong>${draft.questions ? `Nhóm ${draft.questions.length} câu hỏi` : 'Bài tự luyện / kiến thức'}.</strong><button class="btn btn-secondary btn-sm btn-preview-draft" data-id="${Validator.sanitizeHtml(draft.id)}">Xem đầy đủ nội dung & bài mẫu</button>`}<br><strong>Giải thích:</strong> ${Validator.sanitizeHtml(draft.explanation || '')}</div>
                </div>

                <div class="draft-card-actions">
                  <button class="btn btn-success btn-sm btn-approve-draft" data-id="${draft.id}">
                    ✓ Duyệt câu này
                  </button>
                  <button class="btn btn-secondary btn-sm btn-edit-draft" data-id="${draft.id}">
                     Sửa trước khi duyệt
                  </button>
                  <button class="btn btn-secondary btn-sm btn-discard-draft" data-id="${draft.id}">
                     Bỏ qua
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  attachAiEvents() {
    const skillInput = document.getElementById('aiSkill');
    const partInput = document.getElementById('aiPart');
    const syncParts = () => {
      const previous = Number(partInput.value);
      const parts = { reading:[5,6,7], listening:[1,2,3,4], speaking:[1,2,3,4], writing:[1,2,3], vocabulary:[1], grammar:[1] }[skillInput.value];
      const labels = { speaking:['Đọc to','Mô tả tình huống','Trả lời câu hỏi','Nêu ý kiến'], writing:['Viết câu','Trả lời email','Bài luận'], vocabulary:['Flashcard'], grammar:['Quy tắc & ví dụ'] };
      partInput.innerHTML = parts.map(part => `<option value="${part}">${labels[skillInput.value]?.[part - 1] || `Part ${part}`}</option>`).join('');
      if (parts.includes(previous)) partInput.value = String(previous);
    };
    if (generationContext.skill) skillInput.value = generationContext.skill;
    syncParts();
    if (generationContext.part) partInput.value = String(generationContext.part);
    skillInput.onchange = syncParts;
    if (generationContext.level) document.getElementById('aiLevel').value = generationContext.level;
    if (generationContext.topic) document.getElementById('aiTopic').value = generationContext.topic;
    document.getElementById('aiErrors').value = (generationContext.errorTypes || []).join(', ');
    if (generationContext.targetScore) {
      const target = document.getElementById('aiTargetScore');
      const option = document.createElement('option'); option.value = String(generationContext.targetScore); option.textContent = 'Mục tiêu của bạn: ' + generationContext.targetScore; target.append(option); target.value = option.value;
    }
    document.querySelectorAll('.btn-preview-draft').forEach(button => { button.onclick = () => { const draft = AiGenerator.getDrafts().find(item => item.id === button.dataset.id); if (draft) this.openPreviewModal(draft); }; });
    const btnSubmit = document.getElementById('btnSubmitAiGenerate');
    const btnMock = document.getElementById('btnTestAiMock');
    const loader = document.getElementById('aiLoadingIndicator');

    const runGen = async (useMock = false) => {
      const config = {
        skill: document.getElementById('aiSkill').value,
        part: parseInt(document.getElementById('aiPart').value, 10),
        topic: document.getElementById('aiTopic').value,
        targetScore: document.getElementById('aiTargetScore').value,
        count: parseInt(document.getElementById('aiCount').value, 10) || 3,
        language: document.getElementById('aiLang').value,
        level: document.getElementById('aiLevel').value,
        errorTypes: document.getElementById('aiErrors').value.split(',').map(value => value.trim()).filter(Boolean),
        recentMistakes: generationContext.recentMistakes || [],
        vocabulary: generationContext.vocabulary || [],
        additionalRequirements: document.getElementById('aiExtra').value,
        useMock: useMock
      };

      loader.style.display = 'block';
      if (btnSubmit) btnSubmit.disabled = true;
      if (btnMock) btnMock.disabled = true;

      const result = await AiGenerator.generateQuestions(config);

      loader.style.display = 'none';
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnMock) btnMock.disabled = false;

      if (!result.success) {
        alert('Lỗi tạo bài tập AI: ' + result.error);
        return;
      }

      if (result.warning) {
        alert('Lưu ý: ' + result.warning);
      }

      this.render();
    };

    if (btnSubmit) btnSubmit.onclick = () => runGen(false);
    if (btnMock) btnMock.onclick = () => runGen(true);

    // Interactive testing in drafts
    const testOpts = document.querySelectorAll('.draft-test-opt');
    testOpts.forEach(btn => {
      btn.onclick = () => {
        const draftId = btn.getAttribute('data-draft-id');
        const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        const draft = AiGenerator.getDrafts().find(x => x.id === draftId);
        if (!draft) return;

        const parentCard = document.getElementById(`draft-card-${draftId}`);
        if (!parentCard) return;

        const siblingBtns = parentCard.querySelectorAll('.draft-test-opt');
        siblingBtns.forEach((b, idx) => {
          b.classList.remove('selected', 'correct', 'wrong');
          if (idx === draft.correct) b.classList.add('correct');
          else if (idx === optIdx && optIdx !== draft.correct) b.classList.add('wrong');
        });
      };
    });

    // Approve single
    const approveBtns = document.querySelectorAll('.btn-approve-draft');
    approveBtns.forEach(b => {
      b.onclick = async () => {
        const id = b.getAttribute('data-id');
        const res = AiGenerator.approveDraft(id);
        if (res.success) {
          alert('Đã duyệt và thêm câu hỏi vào Ngân hàng thành công!');
          await this.refreshData();
          this.render();
        } else {
          alert('Lỗi: ' + (res.errors || []).join(', '));
        }
      };
    });

    // Discard single
    const discardBtns = document.querySelectorAll('.btn-discard-draft');
    discardBtns.forEach(b => {
      b.onclick = () => {
        const id = b.getAttribute('data-id');
        AiGenerator.removeDraft(id);
        this.render();
      };
    });

    // Edit before approve
    const editDraftBtns = document.querySelectorAll('.btn-edit-draft');
    editDraftBtns.forEach(b => {
      b.onclick = () => {
        const id = b.getAttribute('data-id');
        const draft = AiGenerator.getDrafts().find(x => x.id === id);
        if (draft) this.openEditModal(draft, true);
      };
    });

    // Approve all
    const btnApproveAll = document.getElementById('btnApproveAllDrafts');
    if (btnApproveAll) {
      btnApproveAll.onclick = async () => {
        const res = AiGenerator.approveAllDrafts();
        alert(res.success ? `Đã phê duyệt ${res.count} bài.` : (res.errors || []).join('\n'));
        await this.refreshData();
        this.render();
      };
    }
  },

  // ==========================================
  // MODALS: PREVIEW, EDIT, ADD, IMPORT
  // ==========================================
  openPreviewModal(item) {
    const modal = document.getElementById('adminModal');
    const content = document.getElementById('adminModalContent');
    if (!modal || !content) return;

    let selectedIdx = null;

    const renderPreviewInner = () => {
      const isMulti = item.type === 'multi-question' || Array.isArray(item.questions);
      let html = `
        <div class="modal-header">
          <h3> Xem trước câu hỏi: <code>${Validator.sanitizeHtml(item.id)}</code></h3>
          <button class="modal-close-btn" id="modalCloseBtn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="preview-meta-tags">
            <span class="badge badge-accent">${Validator.sanitizeHtml(item.skill || 'reading')}</span>
            <span class="tag-topic">${Validator.sanitizeHtml(item.topic || 'general')}</span>
            <span class="tag-level">${Validator.sanitizeHtml(item.level || 'intermediate')}</span>
            <span class="status-badge ${item.status === 'draft' ? 'draft' : 'approved'}">${item.status}</span>
          </div>
      `;

      if (item.audioUrl) {
        html += `
          <div class="real-audio-player my-2">
            <audio controls src="${Validator.sanitizeHtml(item.audioUrl)}"></audio>
          </div>
        `;
      }

      if (item.transcript || item.audio) {
        html += `
          <div class="preview-transcript-box">
            <strong>Transcript/Audio text:</strong>
            <p>${Validator.sanitizeHtml(item.transcript || item.audio)}</p>
          </div>
        `;
      }

      if (!isMulti && !Array.isArray(item.options)) {
        const labels = { text:'Đề bài',question:'Yêu cầu',sample:'Bài mẫu',translation:'Bản dịch',tips:'Gợi ý',hint:'Gợi ý',email:'Email gốc',topicText:'Chủ đề',word:'Từ',meaning:'Nghĩa',phonetic:'Phiên âm',example:'Ví dụ',title:'Tiêu đề',formula:'Công thức',usage:'Cách dùng',keywords:'Dấu hiệu' };
        html += Object.entries(labels).filter(([key]) => item[key]).map(([key,label]) => `<section class="preview-field"><strong>${label}</strong><p class="learn-passage">${Validator.sanitizeHtml(item[key])}</p></section>`).join('');
        if (item.examples) html += `<ul>${item.examples.map(example => `<li>${Validator.sanitizeHtml(example)}</li>`).join('')}</ul>`;
      } else if (isMulti) {
        if (item.passage) {
          html += `
            <div class="passage-box">
              <strong>Đoạn văn đọc hiểu:</strong>
              <div class="passage-text">${Validator.sanitizeHtml(item.passage)}</div>
            </div>
          `;
        }

        html += `<div class="subquestions-list">`;
        (item.questions || []).forEach((sub, subIdx) => {
          html += `
            <div class="subquestion-card">
              <div class="subquestion-title"><strong>Câu ${subIdx + 1}:</strong> ${Validator.sanitizeHtml(sub.q)}</div>
              <div class="options-grid">
                ${(sub.options || []).map((opt, oIdx) => `
                  <div class="option-btn ${oIdx === sub.correct ? 'correct' : ''}">
                    <span class="option-label">${String.fromCharCode(65 + oIdx)}</span>
                    <span class="option-text">${Validator.sanitizeHtml(opt)}</span>
                    ${oIdx === sub.correct ? ' <em>(Đúng)</em>' : ''}
                  </div>
                `).join('')}
              </div>
              ${sub.explanation ? `<div class="explanation-box visible"> ${Validator.sanitizeHtml(sub.explanation)}</div>` : ''}
            </div>
          `;
        });
        html += `</div>`;
      } else {
        html += `
          <div class="single-question-box">
            <div class="question-text">${Validator.sanitizeHtml(item.q || item.question || item.audio || '')}</div>
            <div class="options-grid">
              ${(item.options || []).map((opt, oIdx) => {
                let cls = 'option-btn';
                if (selectedIdx === oIdx) {
                  cls += oIdx === item.correct ? ' correct' : ' wrong';
                }
                return `
                  <button class="${cls} modal-test-opt" data-opt-idx="${oIdx}">
                    <span class="option-label">${String.fromCharCode(65 + oIdx)}</span>
                    <span class="option-text">${Validator.sanitizeHtml(opt)}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
          ${item.explanation ? `<div class="explanation-box visible mt-3"> <strong>Giải thích:</strong> ${Validator.sanitizeHtml(item.explanation)}</div>` : ''}
        `;
      }

      html += `
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modalCloseBtn2">Đóng</button>
        </div>
      `;

      content.innerHTML = html;

      // Attach opt clicks
      const optBtns = content.querySelectorAll('.modal-test-opt');
      optBtns.forEach(b => {
        b.onclick = () => {
          selectedIdx = parseInt(b.getAttribute('data-opt-idx'), 10);
          renderPreviewInner();
        };
      });

      const close1 = document.getElementById('modalCloseBtn');
      const close2 = document.getElementById('modalCloseBtn2');
      if (close1) close1.onclick = () => { modal.style.display = 'none'; };
      if (close2) close2.onclick = () => { modal.style.display = 'none'; };
    };

    renderPreviewInner();
    modal.style.display = 'flex';
  },

  openEditModal(item, isDraft = false) {
    const modal = document.getElementById('adminModal'), content = document.getElementById('adminModalContent');
    if (!modal || !content) return;
    const esc = value => Validator.sanitizeHtml(String(value ?? ''));
    const skill = item.skill || 'reading';
    const isMulti = Array.isArray(item.questions) || item.type === 'multi-question';
    const isChoice = ['reading', 'listening', 'mock'].includes(skill) || Array.isArray(item.options);
    const field = (key, label, value = '', rows = 2) => `<label class="admin-edit-field">${label}<textarea class="form-input" name="${key}" rows="${rows}">${esc(value)}</textarea></label>`;
    const choiceFields = (question, prefix = '') => field(prefix + 'q', 'Nội dung câu hỏi', question.q || question.question || '') +
      field(prefix + 'options', 'Các phương án — mỗi dòng một phương án', (question.options || []).join('\n'), 4) +
      `<label class="admin-edit-field">Đáp án đúng (A = 0, B = 1, C = 2, D = 3)<input class="form-input" name="${prefix}correct" type="number" min="0" max="5" value="${Number.isInteger(question.correct) ? question.correct : 0}"></label>` +
      field(prefix + 'explanation', 'Giải thích đáp án', question.explanation || '') +
      field(prefix + 'questionType', 'Dạng câu (detail, inference, word-form…)', question.questionType || '', 1);
    content.innerHTML = `<div class="modal-header"><h3>${item.createdAt ? 'Sửa bài tập' : 'Tạo bài tập'}</h3><button class="modal-close-btn" data-close-editor aria-label="Đóng">×</button></div>
      <div class="modal-body"><form id="editExerciseForm">
      <p class="learn-meta">ID: ${esc(item.id)}. Thay đổi được lưu trên trình duyệt; xuất JSON để sao lưu hoặc cập nhật bộ dữ liệu.</p>
      <div class="form-row"><label class="admin-edit-field">Kỹ năng<select class="form-select" name="skill" id="editSkill">${['reading','listening','speaking','writing','vocabulary','grammar'].map(value => `<option value="${value}" ${value === skill ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="admin-edit-field">Part / loại bài<input class="form-input" type="number" name="part" id="editPart" value="${item.part || (skill === 'reading' ? 5 : 1)}" min="1" max="7"></label>
      <label class="admin-edit-field">Chủ đề<input class="form-input" name="topic" id="editTopic" value="${esc(item.topic || 'business')}" maxlength="100"></label>
      <label class="admin-edit-field">Độ khó<select class="form-select" name="level" id="editLevel">${['beginner','intermediate','advanced'].map(value => `<option value="${value}" ${item.level === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div>
      ${isChoice ? `<label class="admin-edit-field">Cấu trúc<select class="form-select" id="editStructure"><option value="single-choice" ${!isMulti ? 'selected' : ''}>Một câu hỏi</option><option value="multi-question" ${isMulti ? 'selected' : ''}>Đoạn văn / đoạn nghe và nhiều câu con</option></select></label>` : ''}
      ${skill === 'listening' ? field('audioUrl','Đường dẫn file audio (tùy chọn)',item.audioUrl || '',1) + field('transcript','Transcript',item.transcript || item.audio || '',5) + field('imageUrl','Đường dẫn hình minh họa (nếu có)',item.imageUrl || '',1) : ''}
      ${isMulti ? field('passage','Đoạn văn đọc hiểu',item.passage || '',5) + (item.questions || []).map((sub,index) => `<fieldset class="admin-sub-editor"><legend>Câu con ${index + 1} · ${esc(sub.id)}</legend>${choiceFields(sub, 'sub-' + index + '-')}${field('sub-' + index + '-grammarPoint','Kiến thức ngữ pháp',sub.grammarPoint || '',1)}<button class="btn btn-outline btn-sm" type="button" data-remove-child="${index}">Xóa câu con</button></fieldset>`).join('') + '<button class="btn btn-secondary" id="addChildQuestion" type="button">+ Thêm câu con</button>' : isChoice ? choiceFields(item) : ''}
      ${skill === 'speaking' ? field('text','Đề bài / đoạn đọc',item.text || '',5) + field('sample','Bài mẫu',item.sample || '',5) + field('translation','Bản dịch',item.translation || '',4) + field('tips','Gợi ý',item.tips || '') : ''}
      ${skill === 'writing' ? field('question','Yêu cầu bài viết',item.question || '',4) + field('hint','Gợi ý',item.hint || '') + field('email','Email gốc (nếu có)',item.email || '',5) + field('topicText','Chủ đề bài luận',item.topicText || '') + field('sample','Bài mẫu',item.sample || '',6) : ''}
      ${skill === 'vocabulary' ? field('word','Từ vựng',item.word || '',1) + field('meaning','Nghĩa tiếng Việt',item.meaning || '',1) + field('phonetic','Phiên âm',item.phonetic || '',1) + field('example','Câu ví dụ',item.example || '') : ''}
      ${skill === 'grammar' ? field('title','Tiêu đề',item.title || '',1) + field('formula','Công thức',item.formula || '') + field('usage','Cách dùng',item.usage || '',4) + field('examples','Ví dụ — mỗi dòng một ví dụ',(item.examples || []).join('\n'),4) + field('keywords','Dấu hiệu nhận biết',item.keywords || '',1) : ''}
      ${isChoice ? field('grammarPoint','Kiến thức ngữ pháp (tùy chọn)',item.grammarPoint || '',1) + field('trapType','Bẫy thường gặp (tùy chọn)',item.trapType || '',1) : ''}
      <div class="learn-error" id="editErrors" role="alert"></div></form></div>
      <div class="modal-footer"><button class="btn btn-secondary" data-close-editor>Hủy</button><button class="btn btn-primary" id="btnSaveEdit">Lưu ${isDraft ? 'bản nháp' : 'bài tập'}</button></div>`;
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Chỉnh sửa bài tập');
    content.querySelectorAll('[data-close-editor]').forEach(button => button.onclick = () => { modal.style.display = 'none'; });
    const gather = () => {
      const form = new FormData(document.getElementById('editExerciseForm'));
      const updated = { ...item, skill: form.get('skill'), topic: form.get('topic').trim(), level: form.get('level') };
      if (['listening','reading','speaking','writing'].includes(updated.skill)) updated.part = Number(form.get('part')); else delete updated.part;
      for (const key of ['audioUrl','transcript','imageUrl','passage','text','sample','translation','tips','question','hint','email','topicText','word','meaning','phonetic','example','title','formula','usage','keywords','grammarPoint','trapType']) if (form.has(key)) updated[key] = form.get(key).trim();
      if (form.has('examples')) updated.examples = form.get('examples').split('\n').map(v => v.trim()).filter(Boolean);
      const readChoice = (original, prefix = '') => ({ ...original, q: form.get(prefix + 'q').trim(), options: form.get(prefix + 'options').split('\n').map(v => v.trim()).filter(Boolean), correct: Number(form.get(prefix + 'correct')), explanation: form.get(prefix + 'explanation').trim(), questionType: form.get(prefix + 'questionType').trim(), ...(form.has(prefix + 'grammarPoint') ? { grammarPoint: form.get(prefix + 'grammarPoint').trim() } : {}) });
      if (isMulti) updated.questions = (item.questions || []).map((sub,index) => readChoice(sub, 'sub-' + index + '-'));
      else if (isChoice) Object.assign(updated, readChoice(updated));
      return updated;
    };
    content.querySelector('#editSkill').onchange = event => {
      const nextSkill = event.target.value;
      const changed = { id: item.id, version: item.version || 1, source: item.source || 'manual', status: item.status || 'approved', skill: nextSkill, level: item.level || 'intermediate', topic: nextSkill === 'grammar' ? 'tenses' : 'business', part: nextSkill === 'reading' ? 5 : 1 };
      if (['reading','listening'].includes(nextSkill)) Object.assign(changed,{ type:'single-choice',q:'',options:['','','',''],correct:0,explanation:'' });
      this.openEditModal(changed,isDraft);
    };
    content.querySelector('#editStructure')?.addEventListener('change', event => {
      const changed = gather(); changed.type = event.target.value;
      if (changed.type === 'multi-question') {
        changed.questions = [{ id: changed.id + '-q1', q: changed.q || '', options: changed.options || ['','','',''], correct: changed.correct || 0, explanation: changed.explanation || '' }];
        delete changed.options; delete changed.correct; delete changed.q;
      } else { Object.assign(changed,changed.questions?.[0] || {q:'',options:['','','',''],correct:0,explanation:''}); changed.id = item.id; delete changed.questions; }
      this.openEditModal(changed,isDraft);
    });
    content.querySelector('#addChildQuestion')?.addEventListener('click', () => {
      const changed = gather(); changed.questions.push({ id: changed.id + '-q-' + crypto.randomUUID().slice(0,8), q:'',options:['','','',''],correct:0,explanation:'' }); this.openEditModal(changed,isDraft);
    });
    content.querySelectorAll('[data-remove-child]').forEach(button => button.onclick = () => {
      const changed = gather(); changed.questions.splice(Number(button.dataset.removeChild),1); this.openEditModal(changed,isDraft);
    });
    content.querySelector('#btnSaveEdit').onclick = async event => {
      const updated = gather();
      const check = Validator.validateQuestion(updated);
      if (!check.valid) { document.getElementById('editErrors').textContent = check.errors.join(' '); return; }
      event.target.disabled = true;
      try {
        const result = isDraft ? AiGenerator.updateDraft(updated) : ContentLoader.saveExercise(updated);
        if (!result.success) { document.getElementById('editErrors').textContent = result.errors.join(' '); return; }
        await this.refreshData(); modal.style.display = 'none'; this.render();
      } catch (error) { document.getElementById('editErrors').textContent = error.message; }
      finally { event.target.disabled = false; }
    };
    content.querySelector('input,textarea,select')?.focus();
  },

  openAddModal() {
    const newItem = {
      id: `custom-${Date.now()}`,
      version: 1,
      skill: 'reading',
      part: 5,
      type: 'single-choice',
      topic: 'general',
      level: 'intermediate',
      q: '',
      options: ['', '', '', ''],
      correct: 0,
      explanation: '',
      source: 'manual',
      status: 'approved'
    };
    this.openEditModal(newItem, false);
  },

  openImportModal() {
    const modal = document.getElementById('adminModal');
    const content = document.getElementById('adminModalContent');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="modal-header">
        <h3> Import câu hỏi từ JSON</h3>
        <button class="modal-close-btn" id="modalCloseBtn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="import-instructions">
          <p>Dán đoạn mã JSON hoặc tải tệp .json chứa một câu hỏi hoặc danh sách câu hỏi. Hệ thống sẽ tự động xác thực schema trước khi nhập.</p>
        </div>

        <div class="form-group">
          <label>Tải tệp .json:</label>
          <input type="file" id="importFileInput" accept=".json" class="form-input">
        </div>

        <div class="form-group">
          <label>Hoặc dán JSON trực tiếp tại đây:</label>
          <textarea class="form-input" id="importJsonText" rows="10" placeholder='[ { "id": "custom-1", "skill": "reading", "part": 5, ... } ]'></textarea>
        </div>

        <label><input type="checkbox" id="importReplaceExisting"> Thay thế bài có ID đã tồn tại (ghi đè nội dung cũ)</label>
        <div id="importValidationErrors" style="display:none;" class="error-alert-box" role="alert"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modalCloseBtn2">Hủy</button>
        <button class="btn btn-primary" id="btnExecuteImport">Xác thực & Import</button>
      </div>
    `;

    modal.style.display = 'flex';

    const close1 = document.getElementById('modalCloseBtn');
    const close2 = document.getElementById('modalCloseBtn2');
    if (close1) close1.onclick = () => { modal.style.display = 'none'; };
    if (close2) close2.onclick = () => { modal.style.display = 'none'; };

    const fileInput = document.getElementById('importFileInput');
    const jsonText = document.getElementById('importJsonText');
    if (fileInput && jsonText) {
      fileInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) { alert('Tệp import tối đa 2 MB.'); return; }
          const reader = new FileReader();
          reader.onload = ev => {
            jsonText.value = ev.target.result;
          };
          reader.readAsText(file);
        }
      };
    }

    const btnExec = document.getElementById('btnExecuteImport');
    const errBox = document.getElementById('importValidationErrors');
    if (btnExec && jsonText && errBox) {
      btnExec.onclick = async () => {
        const raw = jsonText.value.trim();
        if (raw.length > 2 * 1024 * 1024) { errBox.style.display = 'block'; errBox.textContent = 'Dữ liệu import tối đa 2 MB.'; return; }
        if (!raw) {
          alert('Vui lòng nhập JSON hoặc tải tệp lên');
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          errBox.style.display = 'block';
          errBox.innerHTML = `<strong>Lỗi cú pháp JSON:</strong> ${Validator.sanitizeHtml(e.message)}`;
          return;
        }

        const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.rules || [parsed]);
        const validation = Validator.validateQuestionBank(items);

        if (!validation.valid) {
          errBox.style.display = 'block';
          errBox.innerHTML = `<strong>Phát hiện lỗi dữ liệu (${validation.errors.length} lỗi):</strong><ul>${validation.errors.map(err => `<li>${Validator.sanitizeHtml(err)}</li>`).join('')}</ul>`;
          return;
        }

        btnExec.disabled = true;
        try {
          const result = await ContentLoader.importExercises(items, { replaceExisting: document.getElementById('importReplaceExisting').checked });
          if (!result.success) { errBox.style.display = 'block'; errBox.textContent = result.errors.join('\n'); return; }
          alert(`Đã nhập ${result.count} bài. Bản nháp cần được duyệt trước khi luyện.`);
          await this.refreshData(); modal.style.display = 'none'; this.render();
        } finally { btnExec.disabled = false; }
      };
    }
  },

  async duplicateItem(item) {
    const copy = JSON.parse(JSON.stringify(item));
    copy.id = `copy-${crypto.randomUUID()}`;
    if (copy.questions) copy.questions.forEach((q, index) => { q.id = `${copy.id}-q${index + 1}`; });
    copy.status = 'draft'; copy.reviewedAt = null;
    const result = ContentLoader.saveExercise(copy);
    if (!result.success) { alert(result.errors.join('\n')); return; }
    await this.refreshData();
    this.render();
  },

  deleteItem(item) {
    if (confirm(`Bạn có chắc chắn muốn xóa câu hỏi "${item.id}" không?`)) {
      if (!ContentLoader.deleteExercise(item.id)) { alert('Không lưu được thay đổi. Bài chưa bị xóa.'); return; }
      // Remove from in-memory list
      allQuestions = allQuestions.filter(x => x.id !== item.id);
      this.render();
    }
  }
};
