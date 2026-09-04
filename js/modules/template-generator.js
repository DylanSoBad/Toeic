/**
 * Template Generator Module - Offline Practice Exercise Generator
 * Generates valid TOEIC exercises without needing AI or internet connection.
 */
import { Validator } from './validation.js';

// Template pools
const TENSE_TEMPLATES = [
  {
    template: 'Mr. Henderson _____ the quarterly financial report yesterday afternoon.',
    correct: 'reviewed',
    distractors: ['review', 'reviewing', 'reviews'],
    explanation: 'Dấu hiệu thời gian "yesterday afternoon" yêu cầu thì quá khứ đơn (V2/ed). "reviewed" là dạng quá khứ chính xác.',
    topic: 'tenses',
    level: 'beginner'
  },
  {
    template: 'The IT department _____ the servers every Sunday at midnight.',
    correct: 'updates',
    distractors: ['updated', 'updating', 'have updated'],
    explanation: '"every Sunday" chỉ lịch trình/thói quen lặp lại, cần thì hiện tại đơn với chủ ngữ số ít: "updates".',
    topic: 'tenses',
    level: 'beginner'
  },
  {
    template: 'By the time the manager arrived, the team _____ the presentation slides.',
    correct: 'had completed',
    distractors: ['completes', 'has completed', 'will complete'],
    explanation: 'Cấu trúc "By the time + quá khứ đơn, quá khứ hoàn thành (had + V3)". Hành động hoàn thành trước khi quản lý đến.',
    topic: 'tenses',
    level: 'intermediate'
  },
  {
    template: 'The construction crew _____ on the new subway line since last November.',
    correct: 'has been working',
    distractors: ['works', 'worked', 'will work'],
    explanation: '"since last November" diễn tả hành động bắt đầu từ quá khứ và kéo dài liên tục đến hiện tại → Hiện tại hoàn thành tiếp diễn.',
    topic: 'tenses',
    level: 'intermediate'
  },
  {
    template: 'Next week, our regional director _____ three international branch offices.',
    correct: 'will visit',
    distractors: ['visited', 'visits', 'visiting'],
    explanation: '"Next week" là dấu hiệu tương lai rõ ràng → Dùng thì tương lai đơn "will visit".',
    topic: 'tenses',
    level: 'beginner'
  }
];

const WORD_FORM_TEMPLATES = [
  {
    template: 'Please review the attached contract _____ before signing.',
    correct: 'carefully',
    distractors: ['careful', 'carefulness', 'care'],
    explanation: 'Cần một trạng từ (adverb đuôi -ly) để bổ nghĩa cho động từ "review". "carefully" = một cách cẩn thận.',
    topic: 'word-form',
    level: 'beginner'
  },
  {
    template: 'The CEO expressed great _____ with the marketing department\'s achievements.',
    correct: 'satisfaction',
    distractors: ['satisfied', 'satisfying', 'satisfactorily'],
    explanation: 'Sau tính từ "great" cần một danh từ (noun). "satisfaction" = sự hài lòng.',
    topic: 'word-form',
    level: 'intermediate'
  },
  {
    template: 'The logistics company offers an _____ delivery service for urgent parcels.',
    correct: 'efficient',
    distractors: ['efficiently', 'efficiency', 'efficaciousness'],
    explanation: 'Đứng trước danh từ "delivery service" cần một tính từ (adjective). "efficient" = hiệu quả, nhanh chóng.',
    topic: 'word-form',
    level: 'intermediate'
  },
  {
    template: 'Candidates are asked to submit their _____ by the end of the business day.',
    correct: 'applications',
    distractors: ['apply', 'applicable', 'applied'],
    explanation: 'Sau tính từ sở hữu "their" cần một danh từ số nhiều làm tân ngữ: "applications" = các đơn ứng tuyển.',
    topic: 'word-form',
    level: 'beginner'
  },
  {
    template: 'We need to _____ the existing production process to reduce carbon emissions.',
    correct: 'modify',
    distractors: ['modification', 'modified', 'modifying'],
    explanation: 'Cấu trúc "need to + V(bare)" đòi hỏi động từ nguyên mẫu: "modify" = điều chỉnh, sửa đổi.',
    topic: 'word-form',
    level: 'intermediate'
  }
];

const PASSIVE_TEMPLATES = [
  {
    template: 'All safety guidelines must be strictly _____ by laboratory personnel.',
    correct: 'followed',
    distractors: ['following', 'follow', 'follows'],
    explanation: 'Dạng bị động của động từ khuyết thiếu: "must be + V3/ed". "followed" là dạng bị động đúng.',
    topic: 'passive',
    level: 'beginner'
  },
  {
    template: 'The conference room _____ for the executive board meeting right now.',
    correct: 'is being prepared',
    distractors: ['prepares', 'prepared', 'has prepared'],
    explanation: 'Dấu hiệu "right now" + nghĩa bị động → Hiện tại tiếp diễn bị động: "is/are being + V3/ed".',
    topic: 'passive',
    level: 'intermediate'
  },
  {
    template: 'The original agreement was _____ by both corporate attorneys last month.',
    correct: 'drafted',
    distractors: ['draft', 'drafting', 'drafts'],
    explanation: 'Bị động quá khứ đơn: "was/were + V3/ed". "drafted" = được soạn thảo.',
    topic: 'passive',
    level: 'intermediate'
  },
  {
    template: 'All defective merchandise will be _____ free of charge within 30 days.',
    correct: 'replaced',
    distractors: ['replacing', 'replace', 'replacement'],
    explanation: 'Bị động tương lai đơn: "will be + V3/ed". "replaced" = được thay thế.',
    topic: 'passive',
    level: 'beginner'
  }
];

const CONDITIONAL_TEMPLATES = [
  {
    template: 'If the weather improves tomorrow, the company picnic _____ as scheduled.',
    correct: 'will proceed',
    distractors: ['proceeded', 'had proceeded', 'would proceed'],
    explanation: 'Câu điều kiện loại 1 (có thật ở tương lai): Mệnh đề If dùng hiện tại đơn ("improves"), mệnh đề chính dùng "will + V(bare)".',
    topic: 'conditionals',
    level: 'beginner'
  },
  {
    template: 'If we had known about the flight delay, we _____ another travel route.',
    correct: 'would have chosen',
    distractors: ['will choose', 'chose', 'choose'],
    explanation: 'Câu điều kiện loại 3 (trái ngược quá khứ): "If + had + V3, would have + V3".',
    topic: 'conditionals',
    level: 'advanced'
  },
  {
    template: 'If I were the purchasing director, I _____ a long-term contract with that supplier.',
    correct: 'would negotiate',
    distractors: ['negotiated', 'will negotiate', 'have negotiated'],
    explanation: 'Câu điều kiện loại 2 (giả định trái ngược hiện tại): "If + were, would + V(bare)".',
    topic: 'conditionals',
    level: 'intermediate'
  }
];

const VOCAB_TEMPLATES = [
  {
    template: 'The board approved a substantial _____ to upgrade warehouse automation equipment.',
    correct: 'expenditure',
    distractors: ['itinerary', 'prescription', 'commute'],
    explanation: '"expenditure" = khoản chi tiêu lớn để nâng cấp tự động hóa kho hàng. Các từ khác không phù hợp ngữ cảnh tài chính doanh nghiệp.',
    topic: 'business-vocab',
    level: 'intermediate'
  },
  {
    template: 'Employees are entitled to a full travel _____ for all approved business trips.',
    correct: 'reimbursement',
    distractors: ['diagnosis', 'resignation', 'vaccination'],
    explanation: '"travel reimbursement" = khoản hoàn trả chi phí công tác. "reimbursement" là collocation chuẩn trong TOEIC.',
    topic: 'office-vocab',
    level: 'intermediate'
  },
  {
    template: 'The corporate merger will allow both firms to expand their market _____ significantly.',
    correct: 'share',
    distractors: ['ticket', 'baggage', 'appointment'],
    explanation: '"market share" = thị phần. Collocation quen thuộc trong ngữ cảnh kinh doanh.',
    topic: 'business-vocab',
    level: 'intermediate'
  }
];

// Helper to shuffle an array
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const TemplateGenerator = {
  /**
   * Generate an array of exercises based on template choices
   */
  generate({ category = 'all', level = 'all', count = 5, withExplanation = true } = {}) {
    const pool = [];

    if (category === 'all' || category === 'tenses') pool.push(...TENSE_TEMPLATES);
    if (category === 'all' || category === 'word-form') pool.push(...WORD_FORM_TEMPLATES);
    if (category === 'all' || category === 'passive') pool.push(...PASSIVE_TEMPLATES);
    if (category === 'all' || category === 'conditionals') pool.push(...CONDITIONAL_TEMPLATES);
    if (category === 'all' || category === 'vocab') pool.push(...VOCAB_TEMPLATES);

    let filtered = pool;
    if (level && level !== 'all') {
      const match = pool.filter(x => x.level === level);
      if (match.length > 0) filtered = match;
    }

    const safeCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);
    const shuffledPool = shuffleArray(filtered);
    const selected = [];

    for (let i = 0; i < safeCount; i++) {
      const tmpl = shuffledPool[i % shuffledPool.length];

      // Assemble options and shuffle
      const allOptions = [tmpl.correct, ...tmpl.distractors];
      const shuffledOptions = shuffleArray(allOptions);
      const correctIndex = shuffledOptions.indexOf(tmpl.correct);

      const exercise = {
        id: `offline-gen-${Date.now()}-${i + 1}`,
        version: 1,
        skill: 'reading',
        part: 5,
        type: 'single-choice',
        topic: tmpl.topic,
        level: tmpl.level,
        q: tmpl.template,
        options: shuffledOptions,
        correct: correctIndex,
        explanation: withExplanation ? tmpl.explanation : 'Đáp án đúng theo cấu trúc ngữ pháp TOEIC chuẩn.',
        source: 'template-generator',
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Validate before including
      const validation = Validator.validateQuestion(exercise);
      if (validation.valid) {
        selected.push(exercise);
      } else {
        console.error('TemplateGenerator validation error:', validation.errors);
      }
    }

    return selected;
  }
};
