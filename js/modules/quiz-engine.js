/**
 * Quiz Engine Module - Scoring, Multi-Question Evaluation & TOEIC Score Conversion
 */

// Official TOEIC score conversion estimate table (approximate scaled score for 20 questions)
// Raw correct / 20 -> estimated Listening (5-495), Reading (5-495), Total (10-990)
export function estimateToeicScore(correctListening, totalListening, correctReading, totalReading) {
  // Normalize listening to 100-question scale
  const lRate = totalListening > 0 ? correctListening / totalListening : 0;
  const rRate = totalReading > 0 ? correctReading / totalReading : 0;

  // Conversion curves approximating ETS scaling
  function rateToScaled(rate) {
    if (rate <= 0.05) return 5;
    if (rate <= 0.15) return 20 + Math.round(rate * 200);
    if (rate <= 0.35) return 60 + Math.round((rate - 0.15) * 450);
    if (rate <= 0.60) return 150 + Math.round((rate - 0.35) * 550);
    if (rate <= 0.85) return 290 + Math.round((rate - 0.60) * 600);
    return 440 + Math.round((rate - 0.85) * 366);
  }

  const estL = Math.min(Math.max(rateToScaled(lRate), 5), 495);
  const estR = Math.min(Math.max(rateToScaled(rRate), 5), 495);
  // Round to nearest 5
  const round5 = n => Math.round(n / 5) * 5;

  return {
    listeningScore: round5(estL),
    readingScore: round5(estR),
    totalScore: round5(estL) + round5(estR),
    disclaimer: 'Điểm số ước tính không chính thức dựa trên thang chuẩn hóa TOEIC rút gọn.'
  };
}

export class QuizSession {
  constructor(items = [], options = {}) {
    this.rawItems = items;
    this.options = options;
    this.answers = new Map(); // key: questionId or subQuestionId -> selectedOptionIndex
    this.submitted = false;
    this.startTime = Date.now();
    this.endTime = null;
  }

  /**
   * Flatten items to count total scorable questions (subquestions counted individually)
   */
  getFlattenedQuestions() {
    const list = [];
    this.rawItems.forEach((item, itemIdx) => {
      if (item.type === 'multi-question' && Array.isArray(item.questions)) {
        item.questions.forEach((sub, subIdx) => {
          list.push({
            id: sub.id || `${item.id}-q${subIdx}`,
            parentId: item.id,
            parentType: item.type,
            parentSkill: item.skill,
            passage: item.passage || item.audio || item.transcript,
            audioUrl: item.audioUrl || null,
            subIndex: subIdx,
            totalSubInGroup: item.questions.length,
            q: sub.q,
            options: sub.options,
            correct: sub.correct,
            explanation: sub.explanation || item.explanation,
            skill: item.skill
          });
        });
      } else {
        list.push({
          id: item.id || `q-${itemIdx}`,
          parentId: null,
          parentType: 'single-choice',
          parentSkill: item.skill,
          passage: null,
          audioUrl: item.audioUrl || null,
          subIndex: 0,
          totalSubInGroup: 1,
          q: item.q || item.question || item.audio || item.transcript,
          options: item.options || [],
          correct: item.correct,
          explanation: item.explanation,
          skill: item.skill
        });
      }
    });
    return list;
  }

  selectAnswer(questionId, optionIndex) {
    if (this.submitted) return; // Disallow changes after submission
    this.answers.set(questionId, optionIndex);
  }

  getAnswer(questionId) {
    return this.answers.get(questionId);
  }

  /**
   * Evaluates the current session results
   * Guaranteed: can be called multiple times without duplicate side effects
   */
  evaluate() {
    const flattened = this.getFlattenedQuestions();
    let correctCount = 0;
    let answeredCount = 0;
    let unansweredCount = 0;

    let lTotal = 0, lCorrect = 0;
    let rTotal = 0, rCorrect = 0;

    const breakdown = flattened.map(q => {
      const selected = this.answers.get(q.id);
      const isAnswered = typeof selected === 'number';
      const isCorrect = isAnswered && selected === q.correct;

      if (isAnswered) answeredCount++;
      else unansweredCount++;

      if (isCorrect) correctCount++;

      // Track by skill
      if (q.skill === 'listening') {
        lTotal++;
        if (isCorrect) lCorrect++;
      } else if (q.skill === 'reading') {
        rTotal++;
        if (isCorrect) rCorrect++;
      }

      return {
        id: q.id,
        q: q.q,
        options: q.options,
        selected: selected,
        correct: q.correct,
        isCorrect: isCorrect,
        isAnswered: isAnswered,
        explanation: q.explanation,
        skill: q.skill
      };
    });

    const total = flattened.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const estimated = estimateToeicScore(lCorrect, lTotal, rCorrect, rTotal);

    if (!this.submitted) {
      this.submitted = true;
      this.endTime = Date.now();
    }

    const durationSeconds = this.endTime ? Math.round((this.endTime - this.startTime) / 1000) : 0;

    return {
      total,
      correct: correctCount,
      answered: answeredCount,
      unanswered: unansweredCount,
      accuracy,
      listening: { total: lTotal, correct: lCorrect },
      reading: { total: rTotal, correct: rCorrect },
      estimatedScore: estimated,
      durationSeconds,
      breakdown
    };
  }
}
