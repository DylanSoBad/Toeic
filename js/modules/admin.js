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
let searchKeyword = '';

export const AdminUI = {
  async init() {
    activeSubTab = 'bank';
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
            <h2>⚙️ Quản lý nội dung & Bộ sinh bài tập</h2>
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
            📁 Ngân hàng câu hỏi (${allQuestions.length})
          </button>
          <button class="admin-tab-btn ${activeSubTab === 'template' ? 'active' : ''}" data-subtab="template">
            ⚡ Sinh bài tập mẫu (Offline)
          </button>
          <button class="admin-tab-btn ${activeSubTab === 'ai' ? 'active' : ''}" data-subtab="ai">
            🤖 Tạo bài tập bằng AI
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
    const filtered = allQuestions.filter(item => {
      if (filterSkill !== 'all' && item.skill !== filterSkill) return false;
      if (filterLevel !== 'all' && item.level !== filterLevel) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const str = [
          item.id,
          item.q,
          item.question,
          item.passage,
          item.transcript,
          item.audio,
          item.topic,
          item.explanation,
          ...(Array.isArray(item.options) ? item.options : [])
        ].filter(Boolean).join(' ').toLowerCase();

        if (!str.includes(kw)) return false;
      }
      return true;
    });

    return `
      <div class="bank-controls-bar">
        <div class="filter-group">
          <input type="text" class="form-input search-input" id="bankSearchInput" placeholder="🔍 Tìm kiếm câu hỏi, từ khóa, ID..." value="${Validator.sanitizeHtml(searchKeyword)}">

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
          </select>
        </div>

        <div class="action-buttons-group">
          <button class="btn btn-primary btn-sm" id="btnAddNewExercise">➕ Thêm câu hỏi</button>
          <button class="btn btn-secondary btn-sm" id="btnImportJson">📥 Import JSON</button>
          <button class="btn btn-secondary btn-sm" id="btnExportFilteredJson">📤 Export kết quả</button>
          <button class="btn btn-secondary btn-sm" id="btnExportAllJson">💾 Export tất cả</button>
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
              const summary = item.q || item.question || item.audio || item.transcript || (item.passage ? item.passage.slice(0, 80) + '...' : '') || item.word || item.title || 'N/A';
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
                      ${item.status === 'draft' ? 'Bản nháp' : 'Approved'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div class="item-actions">
                      <button class="btn-icon" data-action="preview" data-id="${item.id}" title="Xem trước & làm thử">👁️</button>
                      <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Chỉnh sửa">✏️</button>
                      <button class="btn-icon" data-action="duplicate" data-id="${item.id}" title="Nhân bản">📋</button>
                      <button class="btn-icon danger" data-action="delete" data-id="${item.id}" title="Xóa">🗑️</button>
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
    const searchInput = document.getElementById('bankSearchInput');
    if (searchInput) {
      searchInput.oninput = () => {
        searchKeyword = searchInput.value;
        this.render();
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
      btn.onclick = () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const item = allQuestions.find(x => x.id === id);
        if (!item) return;

        if (action === 'preview') this.openPreviewModal(item);
        if (action === 'edit') this.openEditModal(item);
        if (action === 'duplicate') this.duplicateItem(item);
        if (action === 'delete') this.deleteItem(item);
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
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allQuestions, null, 2));
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
          <h3>⚡ Bộ sinh bài tập theo mẫu (Hoạt động hoàn toàn Offline)</h3>
          <p>Tạo tức thì các câu hỏi trắc nghiệm chuẩn TOEIC Part 5 & Ngữ pháp mà không cần gọi AI hay kết nối internet.</p>

          <div class="template-form-grid">
            <div class="form-group">
              <label>Dạng bài / Chuyên đề:</label>
              <select class="form-select" id="tmplCategory">
                <option value="all">Tất cả chuyên đề</option>
                <option value="tenses">Các thì trong tiếng Anh (Tenses)</option>
                <option value="word-form">Hình thức từ (Word Form - N/V/Adj/Adv)</option>
                <option value="passive">Câu bị động (Passive Voice)</option>
                <option value="conditionals">Câu điều kiện (Conditionals 0, 1, 2, 3)</option>
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

            <div class="form-group" style="display:flex; align-items:flex-end;">
              <button class="btn btn-primary" id="btnGenerateTemplate" style="width:100%;">
                ⚡ Sinh bài tập ngay
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

        const generated = TemplateGenerator.generate({ category: cat, level: lvl, count: count, withExplanation: true });
        this.renderTemplateResults(generated);
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
            <div class="item-exp">💡 <strong>Giải thích:</strong> ${Validator.sanitizeHtml(it.explanation)}</div>
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
      saveAllBtn.onclick = () => {
        let count = 0;
        items.forEach(it => {
          const res = ContentLoader.saveExercise(it);
          if (res.success) count++;
        });
        alert(`Đã thêm thành công ${count}/${items.length} câu hỏi vào Ngân hàng.`);
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '✓ Đã thêm tất cả';
        this.refreshData();
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
            <h3>🤖 Bộ tạo bài tập bằng Trí tuệ Nhân tạo (AI Generator)</h3>
            <p>Tạo các câu hỏi bài tập TOEIC chuẩn xác theo yêu cầu. Dữ liệu tạo ra được lưu ở dạng <strong>Bản nháp (Draft)</strong> để bạn kiểm tra, làm thử trước khi phê duyệt đưa vào Ngân hàng chính.</p>
          </div>

          <div class="ai-form-grid">
            <div class="form-group">
              <label>Kỹ năng (Skill):</label>
              <select class="form-select" id="aiSkill">
                <option value="reading" selected>Reading</option>
                <option value="listening">Listening</option>
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
              <label>Số lượng câu muốn tạo (1-10):</label>
              <input type="number" class="form-input" id="aiCount" value="3" min="1" max="10">
            </div>

            <div class="form-group">
              <label>Ngôn ngữ giải thích:</label>
              <select class="form-select" id="aiLang">
                <option value="vi" selected>Tiếng Việt</option>
                <option value="en">Tiếng Anh (English)</option>
              </select>
            </div>

            <div class="form-group full-width">
              <label>Ghi chú / Yêu cầu cụ thể thêm cho AI (Tùy chọn):</label>
              <input type="text" class="form-input" id="aiExtra" placeholder="Ví dụ: Tập trung vào liên từ tương quan và câu điều kiện loại 3...">
            </div>
          </div>

          <div class="ai-action-bar">
            <button class="btn btn-primary btn-lg" id="btnSubmitAiGenerate">
              ✨ Bắt đầu sinh câu hỏi bằng AI
            </button>
            <button class="btn btn-secondary btn-lg" id="btnTestAiMock">
              🧪 Thử nghiệm chế độ Mock (Không cần API key)
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
                  <strong>Câu hỏi:</strong> ${Validator.sanitizeHtml(draft.q || draft.question || '')}
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
                  <span class="exp-icon">💡</span>
                  <div class="exp-text"><strong>Đáp án đúng:</strong> ${String.fromCharCode(65 + draft.correct)} - ${Validator.sanitizeHtml(draft.options[draft.correct])}<br><strong>Giải thích:</strong> ${Validator.sanitizeHtml(draft.explanation || '')}</div>
                </div>

                <div class="draft-card-actions">
                  <button class="btn btn-success btn-sm btn-approve-draft" data-id="${draft.id}">
                    ✓ Duyệt câu này
                  </button>
                  <button class="btn btn-secondary btn-sm btn-edit-draft" data-id="${draft.id}">
                    ✏️ Sửa trước khi duyệt
                  </button>
                  <button class="btn btn-secondary btn-sm btn-discard-draft" data-id="${draft.id}">
                    🗑️ Bỏ qua
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
      b.onclick = () => {
        const id = b.getAttribute('data-id');
        const res = AiGenerator.approveDraft(id);
        if (res.success) {
          alert('Đã duyệt và thêm câu hỏi vào Ngân hàng thành công!');
          this.refreshData();
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
      btnApproveAll.onclick = () => {
        const res = AiGenerator.approveAllDrafts();
        alert(`Đã phê duyệt thành công ${res.count} câu hỏi vào Ngân hàng.`);
        this.refreshData();
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
          <h3>👁️ Xem trước câu hỏi: <code>${Validator.sanitizeHtml(item.id)}</code></h3>
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

      if (isMulti) {
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
              ${sub.explanation ? `<div class="explanation-box visible">💡 ${Validator.sanitizeHtml(sub.explanation)}</div>` : ''}
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
          ${item.explanation ? `<div class="explanation-box visible mt-3">💡 <strong>Giải thích:</strong> ${Validator.sanitizeHtml(item.explanation)}</div>` : ''}
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
    const modal = document.getElementById('adminModal');
    const content = document.getElementById('adminModalContent');
    if (!modal || !content) return;

    const isSingle = !item.type || item.type === 'single-choice';

    content.innerHTML = `
      <div class="modal-header">
        <h3>✏️ Chỉnh sửa câu hỏi: <code>${Validator.sanitizeHtml(item.id)}</code></h3>
        <button class="modal-close-btn" id="modalCloseBtn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="editExerciseForm" class="edit-form-layout">
          <div class="form-row">
            <div class="form-group">
              <label>Kỹ năng:</label>
              <select class="form-select" id="editSkill">
                <option value="reading" ${item.skill === 'reading' ? 'selected' : ''}>Reading</option>
                <option value="listening" ${item.skill === 'listening' ? 'selected' : ''}>Listening</option>
              </select>
            </div>
            <div class="form-group">
              <label>Part:</label>
              <input type="number" class="form-input" id="editPart" value="${item.part || 5}">
            </div>
            <div class="form-group">
              <label>Chủ đề:</label>
              <input type="text" class="form-input" id="editTopic" value="${Validator.sanitizeHtml(item.topic || 'general')}">
            </div>
            <div class="form-group">
              <label>Độ khó:</label>
              <select class="form-select" id="editLevel">
                <option value="beginner" ${item.level === 'beginner' ? 'selected' : ''}>Beginner</option>
                <option value="intermediate" ${item.level === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                <option value="advanced" ${item.level === 'advanced' ? 'selected' : ''}>Advanced</option>
              </select>
            </div>
          </div>

          ${item.skill === 'listening' ? `
            <div class="form-group">
              <label>Audio URL (tùy chọn):</label>
              <input type="text" class="form-input" id="editAudioUrl" value="${Validator.sanitizeHtml(item.audioUrl || '')}">
            </div>
            <div class="form-group">
              <label>Transcript / Audio Text:</label>
              <textarea class="form-input" id="editTranscript" rows="2">${Validator.sanitizeHtml(item.transcript || item.audio || '')}</textarea>
            </div>
          ` : ''}

          ${isSingle ? `
            <div class="form-group">
              <label>Nội dung câu hỏi (Q):</label>
              <textarea class="form-input" id="editQ" rows="3">${Validator.sanitizeHtml(item.q || item.question || '')}</textarea>
            </div>

            <div class="form-group">
              <label>Các lựa chọn (Mỗi dòng 1 phương án):</label>
              <textarea class="form-input" id="editOptions" rows="4">${(item.options || []).join('\n')}</textarea>
            </div>

            <div class="form-group">
              <label>Chỉ số đáp án đúng (0 = A, 1 = B, 2 = C, 3 = D):</label>
              <input type="number" class="form-input" id="editCorrect" value="${item.correct || 0}" min="0" max="3">
            </div>
          ` : `
            <div class="form-group">
              <label>Đoạn văn (Passage):</label>
              <textarea class="form-input" id="editPassage" rows="5">${Validator.sanitizeHtml(item.passage || '')}</textarea>
            </div>
          `}

          <div class="form-group">
            <label>Giải thích chi tiết:</label>
            <textarea class="form-input" id="editExplanation" rows="3">${Validator.sanitizeHtml(item.explanation || '')}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modalCloseBtn2">Hủy</button>
        <button class="btn btn-primary" id="btnSaveEdit">💾 Lưu thay đổi</button>
      </div>
    `;

    modal.style.display = 'flex';

    const close1 = document.getElementById('modalCloseBtn');
    const close2 = document.getElementById('modalCloseBtn2');
    if (close1) close1.onclick = () => { modal.style.display = 'none'; };
    if (close2) close2.onclick = () => { modal.style.display = 'none'; };

    const btnSave = document.getElementById('btnSaveEdit');
    if (btnSave) {
      btnSave.onclick = () => {
        const updated = {
          ...item,
          skill: document.getElementById('editSkill').value,
          part: parseInt(document.getElementById('editPart').value, 10),
          topic: document.getElementById('editTopic').value,
          level: document.getElementById('editLevel').value,
          explanation: document.getElementById('editExplanation').value
        };

        if (item.skill === 'listening') {
          const aUrl = document.getElementById('editAudioUrl');
          const aTrans = document.getElementById('editTranscript');
          if (aUrl) updated.audioUrl = aUrl.value.trim() || null;
          if (aTrans) updated.transcript = aTrans.value.trim();
        }

        if (isSingle) {
          updated.q = document.getElementById('editQ').value.trim();
          updated.options = document.getElementById('editOptions').value.split('\n').map(x => x.trim()).filter(Boolean);
          updated.correct = parseInt(document.getElementById('editCorrect').value, 10);
        } else {
          updated.passage = document.getElementById('editPassage').value;
        }

        const validRes = Validator.validateQuestion(updated);
        if (!validRes.valid) {
          alert('Không thể lưu: \n' + validRes.errors.join('\n'));
          return;
        }

        if (isDraft) {
          const drafts = AiGenerator.getDrafts();
          const dIdx = drafts.findIndex(x => x.id === item.id);
          if (dIdx !== -1) drafts[dIdx] = updated;
        } else {
          ContentLoader.saveExercise(updated);
          this.refreshData();
        }

        modal.style.display = 'none';
        this.render();
      };
    }
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
        <h3>📥 Import câu hỏi từ JSON</h3>
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

        <div id="importValidationErrors" style="display:none;" class="error-alert-box"></div>
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
      btnExec.onclick = () => {
        const raw = jsonText.value.trim();
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

        const items = Array.isArray(parsed) ? parsed : (parsed.items || [parsed]);
        const validation = Validator.validateQuestionBank(items);

        if (!validation.valid) {
          errBox.style.display = 'block';
          errBox.innerHTML = `<strong>Phát hiện lỗi dữ liệu (${validation.errors.length} lỗi):</strong><ul>${validation.errors.map(err => `<li>${Validator.sanitizeHtml(err)}</li>`).join('')}</ul>`;
          return;
        }

        // Merge items
        let count = 0;
        items.forEach(it => {
          const res = ContentLoader.saveExercise({
            ...it,
            status: it.status || 'approved',
            source: it.source || 'import'
          });
          if (res.success) count++;
        });

        alert(`Import thành công ${count} câu hỏi vào ngân hàng.`);
        modal.style.display = 'none';
        this.refreshData();
        this.render();
      };
    }
  },

  duplicateItem(item) {
    const copy = JSON.parse(JSON.stringify(item));
    copy.id = `${item.id}-copy-${Date.now()}`;
    copy.q = (copy.q || '') + ' (Bản sao)';
    ContentLoader.saveExercise(copy);
    this.refreshData();
    this.render();
  },

  deleteItem(item) {
    if (confirm(`Bạn có chắc chắn muốn xóa câu hỏi "${item.id}" không?`)) {
      ContentLoader.deleteExercise(item.id);
      // Remove from in-memory list
      allQuestions = allQuestions.filter(x => x.id !== item.id);
      this.render();
    }
  }
};
