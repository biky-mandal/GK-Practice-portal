export enum QuestionType {
  SINGLE_CORRECT = 'single_correct',
  MULTIPLE_CORRECT = 'multiple_correct',
  STATEMENT_BASED = 'statement_based',
  ASSERTION_REASON = 'assertion_reason',
  MATCH_FOLLOWING = 'match_following',
  SEQUENCE_ORDERING = 'sequence_ordering',
  PASSAGE_BASED = 'passage_based',
  IMAGE_BASED = 'image_based',
  NUMERICAL_ANSWER = 'numerical_answer',
  FILL_IN_THE_BLANK = 'fill_in_the_blank',
  DESCRIPTIVE = 'descriptive'
}

export enum QuestionDifficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export enum LifecycleStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum ReviewStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  NEEDS_CHANGES = 'needs_changes'
}

export enum EvaluationMethod {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  HYBRID = 'hybrid'
}

export enum AnswerMode {
  SINGLE_SELECT = 'single_select',
  MULTIPLE_SELECT = 'multiple_select',
  TYPED = 'typed',
  MATCHING = 'matching',
  ORDERING = 'ordering',
  DESCRIPTIVE = 'descriptive'
}

export enum ExamMode {
  PRACTICE = 'practice',
  MOCK = 'mock',
  SECTIONAL = 'sectional',
  PRELIMS = 'prelims',
  MAINS = 'mains'
}

export interface QuestionOption {
  id: string;
  text: string;
  label?: string;
  isCorrect?: boolean;
  explanation?: string;
  order?: number;
}

export interface QuestionAnswerKey {
  correctOptionIds?: string[];
  correctStatementIds?: string[];
  acceptedAnswers?: string[];
  expectedOrder?: string[];
  matchPairs?: Record<string, string>;
  numericalTolerance?: {
    min?: number;
    max?: number;
    absolute?: number;
    relative?: number;
    precision?: number;
  };
  textNormalization?: {
    trim?: boolean;
    caseSensitive?: boolean;
    removePunctuation?: boolean;
  };
  modelAnswer?: string;
  evaluationRubric?: string[];
}

export interface QuestionExplanation {
  summary?: string;
  detailed?: string;
  stepByStep?: string[];
  misconceptions?: string[];
  referenceIds?: string[];
}

export interface QuestionReference {
  id?: string;
  title?: string;
  source?: string;
  url?: string;
  publisher?: string;
  note?: string;
}

export interface QuestionMedia {
  id?: string;
  type?: 'image' | 'audio' | 'video' | 'document';
  url?: string;
  altText?: string;
  caption?: string;
  attribution?: string;
  thumbnailUrl?: string;
}

export interface QuestionStatement {
  id: string;
  text: string;
  label?: string;
}

export interface QuestionPassage {
  id?: string;
  title?: string;
  text: string;
  source?: string;
  language?: string;
}

export interface QuestionTranslation {
  locale: string;
  statement?: string;
  explanation?: string;
  options?: Record<string, string>;
  note?: string;
}

export interface QuestionClassification {
  subject?: string;
  category?: string;
  topic?: string;
  subTopic?: string;
  tags?: string[];
  exam?: string[];
  difficulty?: QuestionDifficulty;
  level?: string;
}

export interface QuestionFormat {
  type: QuestionType;
  answerMode: AnswerMode;
  hasPassage?: boolean;
  hasImage?: boolean;
  isDescriptive?: boolean;
}

export interface QuestionEvaluation {
  method?: EvaluationMethod;
  marks?: number;
  negativeMarks?: number;
  partialCredit?: {
    enabled?: boolean;
    strategy?: 'all_or_nothing' | 'proportional' | 'custom';
    customThreshold?: number;
  };
  autoGraded?: boolean;
  manualReviewRequired?: boolean;
}

export interface QuestionLearning {
  learningObjective?: string;
  conceptTag?: string[];
  keyIdea?: string[];
  hint?: string;
}

export interface QuestionReview {
  reviewerId?: string;
  reviewedAt?: Date;
  status?: ReviewStatus;
  notes?: string;
}

export interface QuestionReport {
  id?: string;
  reportedBy?: string;
  reason?: string;
  details?: string;
  createdAt?: Date;
  status?: 'open' | 'resolved' | 'dismissed';
}

export interface QuestionRevision {
  revisionId?: string;
  previousRevisionId?: string;
  updatedBy?: string;
  updatedAt?: Date;
  summary?: string;
  changes?: string[];
}

export interface ExamSection {
  id: string;
  title?: string;
  description?: string;
  questionIds?: string[];
  durationMinutes?: number;
  marks?: number;
}

export interface Exam {
  examId: string;
  title: string;
  description?: string;
  instructions?: string[];
  eligibleCategories?: string[];
  eligibleSubjects?: string[];
  sections?: ExamSection[];
  totalDurationMinutes?: number;
  totalMarks?: number;
  questionCount?: number;
  marksForCorrect?: number;
  marksForIncorrect?: number;
  marksForUnanswered?: number;
  negativeMarking?: boolean;
  partialCredit?: boolean;
  published?: boolean;
  createdBy?: string;
  updatedBy?: string;
}

export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  responseText?: string;
  numericAnswer?: number;
  status?: 'answered' | 'unanswered' | 'marked_for_review';
  updatedAt?: Date;
}

export interface TestAttempt {
  attemptId: string;
  userId: string;
  examId?: string;
  status: 'in_progress' | 'submitted' | 'expired';
  startedAt: Date;
  deadline?: Date;
  answers?: AttemptAnswer[];
  markedForReview?: string[];
  submittedAt?: Date;
}

export interface TestResult {
  attemptId: string;
  userId: string;
  score?: number;
  maxMarks?: number;
  percentage?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  accuracy?: number;
  questionsReviewed?: number;
  submittedAt?: Date;
}

export interface QuestionAdminDTO {
  id: string;
  questionId?: string;
  referenceImage?: string | null;
  content?: Record<string, unknown>;
  answerKey?: QuestionAnswerKey;
  workflow?: { status?: LifecycleStatus; reviewStatus?: ReviewStatus };
  classification?: QuestionClassification;
}

export interface QuestionPracticeDTO {
  id: string;
  content?: Record<string, unknown>;
  classification?: QuestionClassification;
  questionFormat?: QuestionFormat;
  learning?: QuestionLearning;
  references?: QuestionReference[];
}

export interface QuestionResultDTO {
  id: string;
  result?: TestResult;
  answerKey?: QuestionAnswerKey;
  explanation?: QuestionExplanation;
  references?: QuestionReference[];
}
