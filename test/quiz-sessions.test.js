import test from 'node:test';
import assert from 'node:assert/strict';
import { QuizSession, safeMediaUrl, renderQuestionContext, estimateToeicScore } from '../js/modules/quiz-engine.js';

const group = { id: 'passage', skill: 'reading', part: 6, topic: 'office', level: 'intermediate',
  passage: 'The company opened a new office yesterday.', questionType: 'text-completion',
  questions: [{ id: 'q1', q: 'When?', options: ['Yesterday', 'Tomorrow'], correct: 0, explanation: 'Yesterday appears in the passage.' },
    { id: 'q2', q: 'The company ___ an office.', options: ['open', 'opened'], correctAnswer: 1, grammarPoint: 'tenses' }] };

test('groups are counted by each subquestion with inherited and specific metadata', () => {
  const session = new QuizSession([group]);
  session.selectAnswer('q1', 0);
  const result = session.evaluate();
  assert.equal(result.total, 2);
  assert.equal(result.correct, 1);
  assert.equal(result.answered, 1);
  assert.equal(result.unanswered, 1);
  assert.equal(result.wrong, 0);
  assert.equal(result.breakdown[1].selected, null);
  assert.equal(result.breakdown[1].grammarPoint, 'tenses');
  assert.equal(result.breakdown[1].parentId, 'passage');
  assert.equal(result.breakdown[1].passage, group.passage);
  assert.equal(result.breakdown[1].part, 6);
  assert.equal(result.breakdown[1].level, 'intermediate');
});

test('two different passages never share selected answers or answer keys', () => {
  const session = new QuizSession([group, { ...group, id: 'other', questions: [
    { id: 'q3', q: 'Who?', options: ['A', 'B'], correct: 1 }, { id: 'q4', q: 'Why?', options: ['A', 'B'], correct: 0 }] }]);
  session.selectAnswer('q1', 0); session.selectAnswer('q2', 1);
  session.selectAnswer('q3', 0); session.selectAnswer('q4', 1);
  const result = session.evaluate();
  assert.equal(result.total, 4); assert.equal(result.correct, 2); assert.equal(result.wrong, 2);
});

test('invalid indices, fractions, NaN, and unknown IDs cannot count as responses', () => {
  const session = new QuizSession([group]);
  for (const invalid of [-1, 2, 0.5, NaN, '0', undefined]) assert.equal(session.selectAnswer('q1', invalid), false);
  assert.equal(session.selectAnswer('unknown', 0), false);
  assert.equal(session.evaluate().answered, 0);
});

test('repeated evaluation and reload preserve the attempt, score and original finish time', () => {
  const session = new QuizSession([group], { id: 'stable-attempt', startTime: Date.now() - 5000 });
  session.selectAnswer('q1', 0);
  const resumed = QuizSession.restore(JSON.parse(JSON.stringify(session.serialize())));
  assert.equal(resumed.id, 'stable-attempt');
  assert.equal(resumed.startTime, session.startTime);
  assert.equal(resumed.getAnswer('q1'), 0);
  resumed.selectAnswer('q2', 1);
  const result = resumed.evaluate();
  assert.equal(resumed.selectAnswer('q2', 0), false);
  result.breakdown[0].isCorrect = false;
  assert.equal(resumed.evaluate().breakdown[0].isCorrect, true);
  const completed = QuizSession.restore(resumed.serialize());
  assert.deepEqual(completed.evaluate(), resumed.evaluate());
});

test('duplicate subquestion IDs and malformed answer keys fail before starting a quiz', () => {
  assert.throws(() => new QuizSession([group, group]), /trùng/);
  assert.throws(() => new QuizSession([{ id: 'bad', options: ['A', 'B'], correct: 0.5 }]), /không hợp lệ/);
});

test('nested groups retain context and use each leaf exactly once', () => {
  const session = new QuizSession([{ ...group, questions: [{ id: 'nested', questions: group.questions }] }]);
  assert.equal(session.questions.length, 2);
  assert.equal(session.questions[0].parentId, 'nested');
  assert.equal(session.questions[0].passage, group.passage);
});

test('audio and transcript are separated; unsafe media protocols cannot reach the player', () => {
  for (const url of ['javascript:alert(1)', 'data:audio/wav;base64,bad', '//third-party/audio.mp3', 'file:///C:/secret', 'https://user:pass@example.com/a.mp3', '\\server\audio.mp3']) {
    assert.equal(safeMediaUrl(url), null);
  }
  assert.equal(safeMediaUrl('/audio/test.mp3'), '/audio/test.mp3');
  assert.equal(safeMediaUrl('https://example.com/test.mp3'), 'https://example.com/test.mp3');
  const session = new QuizSession([{ id: 'listen', skill: 'listening', part: 2, audio: 'Hidden spoken prompt', options: ['A', 'B'], correct: 0, audioUrl: 'javascript:alert(1)' }]);
  const q = session.questions[0];
  assert.notEqual(q.q, q.transcript);
  const html = renderQuestionContext(q);
  assert.match(html, /Chưa có audio/);
  assert.doesNotMatch(html, /<audio/);
  assert.doesNotMatch(html, /<details[^>]+ open/);
  assert.equal(session.evaluate().assisted, true);
});

test('showing a transcript marks listening results as assisted across resume', () => {
  const session = new QuizSession([{ id: 'audio', skill: 'listening', audioUrl: '/audio/example.mp3', transcript: 'Speech', options: ['A', 'B'], correct: 0 }]);
  session.markAssisted('audio');
  assert.equal(QuizSession.restore(session.serialize()).evaluate().listening.assisted, true);
});

test('partial skill data cannot fabricate a total TOEIC score', () => {
  assert.equal(estimateToeicScore(0, 0, 1, 1).totalScore, null);
  assert.match(estimateToeicScore(1, 1, 1, 1).disclaimer, /không chính thức/);
});
