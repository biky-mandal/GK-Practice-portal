import crypto from 'node:crypto';
import { Question } from '../models/Question.js';
import { validateReferenceImage } from '../models/referenceImage.js';
import { normalizeCategories } from '../models/questionCategories.js';
import { normalizeExams } from '../models/questionExams.js';
import { listQuestionExams } from './questionExamService.js';
import { LANGUAGES } from '../models/questionLanguages.js';
import { firstText, toBilingual, toBilingualList, type LocalizedContent } from './questionI18n.js';
import { QuestionType, LifecycleStatus, ReviewStatus, AnswerMode, type QuestionAdminDTO, type QuestionPracticeDTO, type QuestionResultDTO } from '../models/questionDomain.js';
import { ApiError } from '../utils/ApiError.js';

const normalizeQuestionType = (value?: string): QuestionType => {
  const mapped = String(value ?? QuestionType.SINGLE_CORRECT).trim();
  if (Object.values(QuestionType).includes(mapped as QuestionType)) {
    return mapped as QuestionType;
  }

  switch (mapped.toLowerCase()) {
    case 'single':
    case 'single_correct':
      return QuestionType.SINGLE_CORRECT;
    case 'multiple':
    case 'multiple_correct':
      return QuestionType.MULTIPLE_CORRECT;
    case 'numeric':
    case 'numerical':
      return QuestionType.NUMERICAL_ANSWER;
    case 'descriptive':
      return QuestionType.DESCRIPTIVE;
    default:
      return QuestionType.SINGLE_CORRECT;
  }
};

const normalizeAnswerMode = (value?: string): AnswerMode => {
  const mapped = String(value ?? 'single').trim().toLowerCase();
  switch (mapped) {
    case 'single':
    case 'single_select':
      return AnswerMode.SINGLE_SELECT;
    case 'multiple':
    case 'multi':
    case 'multiple_select':
      return AnswerMode.MULTIPLE_SELECT;
    case 'typed':
      return AnswerMode.TYPED;
    case 'matching':
      return AnswerMode.MATCHING;
    case 'ordering':
      return AnswerMode.ORDERING;
    case 'descriptive':
      return AnswerMode.DESCRIPTIVE;
    default:
      return AnswerMode.SINGLE_SELECT;
  }
};

const normalizeDifficulty = (value?: string): string => {
  const mapped = String(value ?? 'medium').trim().toLowerCase();
  return mapped === 'easy' ? 'Easy' : mapped === 'hard' ? 'Hard' : 'Medium';
};

const QUESTION_ID_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const generateQuestionId = (): string =>
  Array.from({ length: 12 }, () => QUESTION_ID_CHARACTERS.charAt(crypto.randomInt(QUESTION_ID_CHARACTERS.length))).join('');

export const resolveQuestionId = (source: Record<string, any>): string => {
  const suppliedId = [source.id, source.questionId].find((value) => typeof value === 'string' && value.trim());
  return typeof suppliedId === 'string' ? suppliedId.trim() : generateQuestionId();
};

export const normalizeQuestionImport = (input: Record<string, any>): Record<string, any> => {
  const source = input ?? {};
  const content = source.content ?? {};
  const classification = source.classification ?? {};
  const exams = normalizeExams(classification.exams, classification.exam, source.exams,
    classification.examCategories, source.examCompatibility?.eligibleExamIds);
  const answerKey = source.answerKey ?? {};
  const questionType = normalizeQuestionType(content.questionType ?? source.questionType ?? source.questionFormat?.type);
  const answerMode = normalizeAnswerMode(source.questionFormat?.answerMode ?? content.answerMode ?? source.answerMode ?? 'single');
  const options = Array.isArray(content.options) && content.options.length
    ? content.options
    : Array.isArray(source.options)
      ? source.options
      : [];

  const questionTextBi = toBilingual(content.questionText ?? source.questionText ?? content.title);
  const optionBi = options.map((option: any) => toBilingual(option?.text ?? option));
  const explanationBi = toBilingual(answerKey.explanation ?? answerKey.modelAnswer);
  const misconceptionsBi = toBilingualList(answerKey.commonMisconceptions);
  const optionExplanationBi = options.map((option: any, index: number) => {
    const optionId = option?.id ?? String.fromCharCode(65 + index);
    const entry = answerKey.optionExplanations?.find((item: any) => item.optionId === optionId);
    return toBilingual(entry?.explanation ?? option?.explanation);
  });

  // A language is available only when the question text and every option exist in it.
  const localized: Record<string, LocalizedContent> = {};
  for (const language of LANGUAGES) {
    const text = questionTextBi[language];
    const texts = optionBi.map((entry: any) => entry[language]);
    if (!text || !texts.length || texts.some((value: string | undefined) => !value)) continue;
    localized[language] = {
      questionText: text,
      options: texts as string[],
      explanation: explanationBi[language] ?? '',
      optionExplanations: optionExplanationBi.map((entry: any) => entry[language] ?? ''),
      commonMisconceptions: misconceptionsBi[language] ?? []
    };
  }

  const normalizedOptions = options.map((option: any, index: number) => ({
    id: option?.id ?? String.fromCharCode(65 + index),
    text: firstText(optionBi[index]),
    label: option?.label ?? String.fromCharCode(65 + index),
    isCorrect: Boolean(option?.isCorrect ?? answerKey.correctOptionIds?.includes(option?.id ?? String.fromCharCode(65 + index))),
    explanation: firstText(optionExplanationBi[index]) || undefined,
    order: typeof option?.order === 'number' ? option.order : index + 1
  }));

  const normalizedContent = {
    statement: firstText(questionTextBi),
    passage: content.passage ?? null,
    options: normalizedOptions,
    statements: Array.isArray(content.subQuestions) ? content.subQuestions : [],
    media: Array.isArray(content.media) ? content.media : [],
    translations: Array.isArray(content.translations) ? content.translations : [],
    title: content.title ?? source.title ?? ''
  };

  const normalizedClassification = {
    category: Array.isArray(classification.examCategories) && classification.examCategories.length ? classification.examCategories[0] : source.category ?? 'General Knowledge',
    subject: Array.isArray(classification.subjects) && classification.subjects.length ? classification.subjects[0] : source.subject ?? 'General Studies',
    topic: Array.isArray(classification.topics) && classification.topics.length ? classification.topics[0] : source.topic ?? 'General',
    subTopic: Array.isArray(classification.subtopics) && classification.subtopics.length ? classification.subtopics[0] : undefined,
    tags: Array.isArray(content.tags) ? content.tags : Array.isArray(classification.tags) ? classification.tags : [],
    exam: exams,
    difficulty: normalizeDifficulty(classification.difficulty ?? source.difficulty) as any,
    level: classification.cognitiveLevel ?? source.level ?? 'application'
  };

  const normalizedAnswerKey = {
    correctOptionIds: Array.isArray(answerKey.correctOptionIds) ? answerKey.correctOptionIds : [],
    correctStatementIds: Array.isArray(answerKey.correctStatementCombination) ? answerKey.correctStatementCombination : [],
    acceptedAnswers: Array.isArray(answerKey.acceptedAnswers) ? answerKey.acceptedAnswers : [],
    modelAnswer: answerKey.modelAnswer ?? null,
    evaluationRubric: Array.isArray(answerKey.evaluationCriteria) ? answerKey.evaluationCriteria : [],
    numericalTolerance: answerKey.numericalTolerance ?? undefined,
    textNormalization: undefined,
    explanation: firstText(explanationBi)
  };

  const workflowStatus = source.status ?? source.workflow?.status ?? 'draft';
  const reviewStatus = source.workflow?.reviewStatus ?? source.reviewStatus ?? 'pending';

  return {
    questionId: resolveQuestionId(source),
    slug: source.slug,
    questionText: firstText(questionTextBi),
    ...(source.referenceImage !== undefined ? { referenceImage: validateReferenceImage(source.referenceImage) } : {}),
    questionType,
    options: normalizedOptions.map((option: any) => option.text),
    correctOption: normalizedOptions.findIndex((option: any) => option.isCorrect === true),
    explanation: firstText(explanationBi),
    category: normalizedClassification.category,
    difficulty: normalizedClassification.difficulty,
    subject: normalizedClassification.subject,
    topic: normalizedClassification.topic,
    categories: normalizeCategories(
      classification.categories,
      source.categories,
      classification.subjects,
      classification.topics,
      source.subject,
      source.topic
    ),
    tags: normalizedClassification.tags,
    languages: Object.keys(localized),
    localized,
    exams,
    content: normalizedContent,
    answerKey: normalizedAnswerKey,
    classification: normalizedClassification,
    questionFormat: {
      type: questionType,
      answerMode,
      hasPassage: Boolean(content.passage || source.passage),
      hasImage: Boolean(content.media?.some((media: any) => media.type === 'image')),
      isDescriptive: questionType === QuestionType.DESCRIPTIVE
    },
    evaluation: {
      method: source.evaluation?.evaluationMethod ?? 'automatic',
      marks: source.evaluation?.marksCorrect ?? source.evaluation?.maxMarks ?? 1,
      negativeMarks: source.evaluation?.marksIncorrect ?? 0,
      partialCredit: {
        enabled: Boolean(source.evaluation?.partialCredit ?? source.questionFormat?.allowPartialCredit ?? false),
        strategy: 'all_or_nothing'
      },
      autoGraded: true,
      manualReviewRequired: false
    },
    learning: source.learning ?? {},
    references: Array.isArray(source.references?.primarySources) ? source.references.primarySources : [],
    workflow: {
      status: workflowStatus,
      reviewStatus,
      createdBy: source.workflow?.createdBy ?? 'admin-import',
      updatedBy: source.workflow?.updatedBy ?? 'admin-import'
    },
    review: {
      reviewerId: source.workflow?.reviewedBy ?? null,
      status: reviewStatus,
      notes: Array.isArray(source.workflow?.reviewNotes) ? source.workflow.reviewNotes.join('; ') : ''
    },
    customMetadata: source.customMetadata ?? {}
  };
};

export const serializeQuestionAdmin = (question: any): QuestionAdminDTO => ({
  id: String(question._id),
  questionId: question.questionId ?? String(question._id),
  referenceImage: question.referenceImage ?? null,
  content: {
    statement: question.questionText ?? question.content?.statement ?? '',
    options: question.content?.options ?? question.options ?? [],
    passage: question.content?.passage ?? null,
    statements: question.content?.statements ?? [],
    media: question.content?.media ?? [],
    translations: question.content?.translations ?? []
  },
  answerKey: question.answerKey ?? {},
  workflow: {
    status: question.workflow?.status ?? LifecycleStatus.PUBLISHED,
    reviewStatus: question.review?.status ?? ReviewStatus.ACCEPTED
  },
  classification: question.classification ?? {
    subject: question.subject,
    category: question.category,
    topic: question.topic,
    tags: question.tags ?? []
  }
});

export const serializeQuestionPractice = (question: any): QuestionPracticeDTO => ({
  id: String(question._id),
  content: {
    statement: question.questionText ?? question.content?.statement ?? '',
    options: question.content?.options ?? question.options ?? [],
    passage: question.content?.passage ?? null,
    statements: question.content?.statements ?? [],
    media: question.content?.media ?? []
  },
  classification: question.classification ?? {
    subject: question.subject,
    category: question.category,
    topic: question.topic,
    tags: question.tags ?? []
  },
  questionFormat: question.questionFormat ?? {
    type: question.questionFormat?.type ?? QuestionType.SINGLE_CORRECT,
    answerMode: 'single_select'
  },
  learning: question.learning ?? {},
  references: question.references ?? []
});

export const serializeQuestionResult = (question: any): QuestionResultDTO => ({
  id: String(question._id),
  result: {
    attemptId: '',
    userId: '',
    score: 0,
    maxMarks: 0,
    percentage: 0,
    correctCount: 0,
    incorrectCount: 0,
    unansweredCount: 0,
    accuracy: 0,
    questionsReviewed: 0,
    submittedAt: new Date()
  },
  answerKey: question.answerKey ?? {},
  explanation: { summary: question.explanation ?? '', detailed: question.explanation ?? '' },
  references: question.references ?? []
});

export const validateQuestionPayload = (payload: Record<string, any>) => {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError(400, 'Question payload is required.');
  }

  const questionType = payload.questionFormat?.type ?? payload.type ?? QuestionType.SINGLE_CORRECT;
  if (!Object.values(QuestionType).includes(questionType)) {
    throw new ApiError(400, `Unsupported question type: ${String(questionType)}`);
  }

  if (questionType === QuestionType.SINGLE_CORRECT) {
    const correctOptionIds = payload.answerKey?.correctOptionIds ?? [];
    if (correctOptionIds.length !== 1) {
      throw new ApiError(400, 'Single correct questions require exactly one correct option.');
    }
  }

  if (questionType === QuestionType.MULTIPLE_CORRECT) {
    const correctOptionIds = payload.answerKey?.correctOptionIds ?? [];
    if (correctOptionIds.length < 1) {
      throw new ApiError(400, 'Multiple correct questions require at least one correct option.');
    }
  }

  if (questionType === QuestionType.NUMERICAL_ANSWER) {
    const acceptedAnswers = payload.answerKey?.acceptedAnswers ?? [];
    if (acceptedAnswers.length === 0 && !payload.answerKey?.numericalTolerance) {
      throw new ApiError(400, 'Numerical questions require accepted answers or tolerance settings.');
    }
  }

  if (questionType === QuestionType.DESCRIPTIVE) {
    if (!payload.answerKey?.modelAnswer && !payload.answerKey?.evaluationRubric) {
      throw new ApiError(400, 'Descriptive questions require model answer or evaluation rubric metadata.');
    }
  }

  return true;
};

export const createQuestionRecord = async (payload: Record<string, any>, createdBy?: string) => {
  await listQuestionExams();
  const normalizedPayload = normalizeQuestionImport(payload);
  validateQuestionPayload(normalizedPayload);

  const statement = normalizedPayload.questionText ?? normalizedPayload.content?.statement ?? '';
  if (!statement.trim()) {
    throw new ApiError(400, 'Question statement is required.');
  }

  const question = await Question.create({
    ...normalizedPayload,
    questionId: normalizedPayload.questionId ?? generateQuestionId(),
    questionText: statement,
    options: normalizedPayload.options ?? [],
    correctOption: normalizedPayload.correctOption ?? 0,
    explanation: normalizedPayload.explanation ?? '',
    category: normalizedPayload.classification?.category ?? 'General Knowledge',
    subject: normalizedPayload.classification?.subject ?? 'General Studies',
    topic: normalizedPayload.classification?.topic ?? 'General',
    tags: normalizedPayload.tags ?? [],
    content: normalizedPayload.content ?? {
      statement,
      options: []
    },
    answerKey: normalizedPayload.answerKey ?? {},
    classification: normalizedPayload.classification ?? {
      category: 'General Knowledge',
      subject: 'General Studies',
      topic: 'General',
      tags: []
    },
    questionFormat: normalizedPayload.questionFormat ?? {
      type: QuestionType.SINGLE_CORRECT,
      answerMode: AnswerMode.SINGLE_SELECT
    },
    evaluation: normalizedPayload.evaluation ?? {
      method: 'automatic',
      marks: 1,
      negativeMarks: 0,
      partialCredit: { enabled: false, strategy: 'all_or_nothing' }
    },
    learning: normalizedPayload.learning ?? {},
    references: normalizedPayload.references ?? [],
    workflow: {
      ...(normalizedPayload.workflow ?? {}),
      status: normalizedPayload.workflow?.status ?? LifecycleStatus.DRAFT,
      reviewStatus: normalizedPayload.workflow?.reviewStatus ?? ReviewStatus.PENDING,
      createdBy: createdBy ?? normalizedPayload.workflow?.createdBy ?? 'system',
      updatedBy: createdBy ?? normalizedPayload.workflow?.updatedBy ?? 'system'
    },
    review: {
      ...(normalizedPayload.review ?? {}),
      reviewerId: normalizedPayload.review?.reviewerId ?? createdBy ?? 'system',
      status: normalizedPayload.review?.status ?? ReviewStatus.PENDING,
      notes: normalizedPayload.review?.notes ?? ''
    },
    customMetadata: normalizedPayload.customMetadata ?? {}
  });

  return question;
};

export const importQuestionRecords = async (records: Record<string, any>[], createdBy?: string) => {
  const prepared = records.map((record) => ({ ...record }));

  for (const record of prepared) {
    validateQuestionPayload(record);
  }

  const results = await Promise.all(prepared.map((record) => createQuestionRecord(record, createdBy)));
  return results;
};

export interface BulkImportSummary {
  total: number;
  created: number;
  updated: number;
  failed: Array<{ index: number; id?: string; error: string }>;
}

// Upserts by questionId; one bad record never blocks the rest.
export const bulkImportQuestions = async (records: unknown[], importedBy: string): Promise<BulkImportSummary> => {
  await listQuestionExams();
  const summary: BulkImportSummary = { total: records.length, created: 0, updated: 0, failed: [] };

  for (const [index, record] of records.entries()) {
    const id = (record as any)?.id ?? (record as any)?.questionId;
    try {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error('Each question must be a JSON object.');
      }

      const doc = normalizeQuestionImport(record as Record<string, any>);
      validateQuestionPayload(doc);

      if (!String(doc.questionText ?? '').trim()) throw new Error('Question text is required.');
      if (!doc.languages.length) throw new Error('Question text and every option must exist in English or Assamese.');
      if (doc.questionType === QuestionType.SINGLE_CORRECT) {
        if (doc.options.length < 2) throw new Error('At least two options are required.');
        if (doc.correctOption < 0) throw new Error('answerKey.correctOptionIds must match an option id.');
      }

      const result = await Question.updateOne(
        { questionId: doc.questionId },
        {
          $set: {
            ...doc,
            isActive: true,
            workflow: { ...doc.workflow, createdBy: importedBy, updatedBy: importedBy }
          }
        },
        { upsert: true }
      );

      if (result.upsertedCount) summary.created += 1;
      else summary.updated += 1;
    } catch (error) {
      summary.failed.push({ index, id, error: error instanceof Error ? error.message : 'Import failed.' });
    }
  }

  return summary;
};

// Tags older questions with categories inferred from their subject/topic.
export const backfillCategories = async () => {
  // Older databases enforce a unique index on questionId alone, which blocks per-language copies.
  await Question.collection.dropIndex('questionId_1').catch(() => undefined);
  await Question.collection.dropIndex('questionId_1_language_1').catch(() => undefined);
  await Question.updateMany({ languages: { $exists: false } }, { $set: { languages: ['en'] } });
  await Question.createIndexes().catch(() => undefined);

  const pending: any[] = await Question.find({ $or: [{ categories: { $exists: false } }, { categories: { $size: 0 } }] })
    .select('subject topic classification')
    .lean()
    .exec();

  const operations = pending
    .map((question) => ({
      id: question._id,
      categories: normalizeCategories(question.classification?.subject, question.classification?.topic, question.subject, question.topic)
    }))
    .filter((entry) => entry.categories.length > 0)
    .map((entry) => ({ updateOne: { filter: { _id: entry.id }, update: { $set: { categories: entry.categories } } } }));

  if (operations.length) await Question.bulkWrite(operations);
  return operations.length;
};
