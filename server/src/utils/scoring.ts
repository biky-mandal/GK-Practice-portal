export type ScoringRule = {
  correct: number;
  incorrect: number;
  unanswered: number;
  maxMarks: number | 'perQuestion';
};

export const defaultScoringRule: ScoringRule = {
  correct: 1,
  incorrect: 0,
  unanswered: 0,
  maxMarks: 'perQuestion'
};

export const calculateAttemptScore = (
  selectedAnswers: Record<string, number>,
  correctOptionMap: Record<string, number>,
  questionCount: number,
  scoringRule: ScoringRule = defaultScoringRule
) => {
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (let index = 0; index < questionCount; index += 1) {
    const questionId = Object.keys(correctOptionMap)[index];
    const answer = selectedAnswers[questionId];
    const correctOption = correctOptionMap[questionId];

    if (answer === undefined || answer === null) {
      unansweredCount += 1;
      continue;
    }

    if (answer === correctOption) {
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }
  }

  const rawScore = correctCount * scoringRule.correct + incorrectCount * scoringRule.incorrect + unansweredCount * scoringRule.unanswered;
  const maxMarks = scoringRule.maxMarks === 'perQuestion' ? questionCount : scoringRule.maxMarks;
  const percentage = maxMarks > 0 ? (rawScore / maxMarks) * 100 : 0;

  return {
    score: rawScore,
    correctCount,
    incorrectCount,
    unansweredCount,
    percentage: Number(percentage.toFixed(2))
  };
};
