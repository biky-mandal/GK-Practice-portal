import { describe, expect, it } from 'vitest';
import { normalizeQuestionImport } from '../services/questionService.js';

describe('Question JSON import normalization', () => {
  it('maps the admin-import schema into the database question shape', () => {
    const payload = {
      id: 'GK-POLITY-0001',
      slug: 'fundamental-rights-equality',
      content: {
        title: 'Fundamental Rights and Equality',
        questionText: 'Which of the following statements about equality before the law is correct?',
        questionType: 'single_correct',
        options: [
          { id: 'A', text: 'It is guaranteed under Article 14 of the Constitution.' },
          { id: 'B', text: 'It is available only to Indian citizens.' }
        ],
        tags: ['constitution', 'fundamental-rights', 'equality']
      },
      answerKey: {
        correctOptionIds: ['A'],
        explanation: 'Article 14 guarantees equality before the law.',
        optionExplanations: [
          { optionId: 'A', isCorrect: true, explanation: 'Article 14 expressly provides these guarantees.' }
        ]
      },
      classification: {
        examCategories: ['UPSC', 'APSC'],
        subjects: ['Indian Polity'],
        topics: ['Fundamental Rights'],
        difficulty: 'medium'
      },
      questionFormat: {
        answerMode: 'single',
        optionSelectionLimit: 1
      },
      evaluation: {
        marksCorrect: 1,
        marksIncorrect: 0,
        negativeMarking: false,
        maxMarks: 1
      },
      workflow: {
        reviewStatus: 'pending'
      }
    };

    const normalized = normalizeQuestionImport(payload);

    expect(normalized.questionId).toBe('GK-POLITY-0001');
    expect(normalized.questionText).toBe('Which of the following statements about equality before the law is correct?');
    expect(normalized.options).toEqual(['It is guaranteed under Article 14 of the Constitution.', 'It is available only to Indian citizens.']);
    expect(normalized.answerKey.correctOptionIds).toEqual(['A']);
    expect(normalized.questionFormat.type).toBe('single_correct');
    expect(normalized.classification.category).toBe('UPSC');
    expect(normalized.classification.subject).toBe('Indian Polity');
    expect(normalized.tags).toEqual(['constitution', 'fundamental-rights', 'equality']);
  });

  it('generates a 12-character alphanumeric ID when an import has no ID', () => {
    const normalized = normalizeQuestionImport({});

    expect(normalized.questionId).toMatch(/^[A-Za-z0-9]{12}$/);
  });
});
