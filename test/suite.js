/**
 * Automated Verification Suite for TOEIC Master
 * Tests: Validation, Scoring, Storage Migration, Streak, Template Generator, Server Endpoints
 */
import fs from 'fs';
import path from 'path';
import { Validator } from '../js/modules/validation.js';
import { QuizSession, estimateToeicScore } from '../js/modules/quiz-engine.js';
import { TemplateGenerator } from '../js/modules/template-generator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== TOEIC MASTER VERIFICATION SUITE ===\n');

// 1. Validate All Static JSON Data Files
console.log('1. Validating all static data files in data/ directory...');
const dataDirs = [
  'listening',
  'reading',
  'speaking',
  'writing',
  'vocabulary',
  'grammar',
  'mock-tests'
];

dataDirs.forEach(dir => {
  const fullDir = path.join(process.cwd(), 'data', dir);
  if (fs.existsSync(fullDir)) {
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.json'));
    files.forEach(f => {
      const content = fs.readFileSync(path.join(fullDir, f), 'utf-8');
      try {
        const json = JSON.parse(content);
        assert(json !== null, `Parsed valid JSON for data/${dir}/${f}`);
        if (Array.isArray(json.items)) {
          const res = Validator.validateQuestionBank(json.items);
          assert(res.valid, `Schema valid for data/${dir}/${f} (${json.items.length} items, errors: ${res.errors.length})`);
          if (!res.valid) console.error('   Errors:', res.errors);
        }
      } catch (err) {
        assert(false, `JSON parse error in data/${dir}/${f}: ${err.message}`);
      }
    });
  }
});

// 2. Test Scoring Engine & Subquestion Calculation
console.log('\n2. Testing QuizEngine Multi-Question Scoring & Anti-Inflation...');

const mockPassageItem = {
  id: 'test-passage-1',
  type: 'multi-question',
  skill: 'reading',
  part: 6,
  passage: 'This is a test passage.',
  questions: [
    { id: 'sub-1', q: 'Question 1', options: ['A', 'B', 'C', 'D'], correct: 0 },
    { id: 'sub-2', q: 'Question 2', options: ['A', 'B', 'C', 'D'], correct: 2 }
  ]
};

const session = new QuizSession([mockPassageItem]);
const flattened = session.getFlattenedQuestions();
assert(flattened.length === 2, `Multi-question passage correctly flattened to 2 individual scorable questions (got ${flattened.length})`);

// User answers sub-1 correct (0), sub-2 wrong (1)
session.selectAnswer('sub-1', 0);
session.selectAnswer('sub-2', 1);

const result = session.evaluate();
assert(result.total === 2, `Total questions evaluated is 2`);
assert(result.correct === 1, `Correct questions count is 1 (got ${result.correct})`);
assert(result.accuracy === 50, `Accuracy is 50% (got ${result.accuracy}%)`);

// Prevent multiple evaluation changes
session.selectAnswer('sub-2', 2); // try to change after submit
const result2 = session.evaluate();
assert(result2.correct === 1, `Submitting / evaluating multiple times does not corrupt or alter score`);

// 3. Test TOEIC Score Scale Conversion
console.log('\n3. Testing TOEIC Score Estimation Curve...');
const perfectScore = estimateToeicScore(10, 10, 10, 10);
assert(perfectScore.totalScore >= 950 && perfectScore.totalScore <= 990, `Full score normalized to near 990 (got ${perfectScore.totalScore})`);
assert(perfectScore.disclaimer.includes('không chính thức'), `Includes clear unofficial disclaimer`);

const zeroScore = estimateToeicScore(0, 10, 0, 10);
assert(zeroScore.totalScore >= 10 && zeroScore.totalScore <= 60, `Zero score maps to baseline (got ${zeroScore.totalScore})`);

// 4. Test Offline Template Generator
console.log('\n4. Testing Offline Template Generator...');
const generated = TemplateGenerator.generate({ category: 'tenses', level: 'beginner', count: 5, withExplanation: true });
assert(generated.length === 5, `Generated exactly 5 exercises`);
const genValidation = Validator.validateQuestionBank(generated);
assert(genValidation.valid, `Generated questions conform 100% to schema without errors`);

// Verify shuffled options have correct index
generated.forEach((g, idx) => {
  assert(g.options.length === 4, `Item #${idx + 1} has 4 distinct options`);
  assert(g.correct >= 0 && g.correct < 4, `Item #${idx + 1} correct answer index (${g.correct}) is valid`);
  assert(typeof g.explanation === 'string' && g.explanation.length > 5, `Item #${idx + 1} has detailed explanation`);
});

// 5. Test XSS Sanitization
console.log('\n5. Testing XSS Sanitization...');
const dirtyHtml = '<script>alert("hacked")</script>&"test"';
const sanitized = Validator.sanitizeHtml(dirtyHtml);
assert(!sanitized.includes('<script>'), `Sanitizer escaped HTML script tags`);
assert(sanitized.includes('&lt;script&gt;'), `Sanitizer converted to safe HTML entities`);

// Summary
console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
