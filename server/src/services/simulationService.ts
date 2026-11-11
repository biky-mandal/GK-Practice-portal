import { Category } from '../models/Category.js';
import type { Types } from 'mongoose';
import { Question, type IQuestion } from '../models/Question.js';
import { refreshCategories } from './categoryService.js';
import { ApiError } from '../utils/ApiError.js';

type SimulationQuestion = Pick<IQuestion, 'questionId' | 'questionText' | 'options' | 'correctOption' | 'explanation' | 'localized' | 'referenceImage'> & { _id: Types.ObjectId };
type SimulationQuestionPreview = Pick<IQuestion, 'questionId' | 'questionText' | 'options' | 'correctOption' | 'localized'> & { _id: Types.ObjectId };

interface SimulationCategory {
  id: string;
  name: string;
  count: number;
  active: number;
  remaining: number;
  canReset: boolean;
}

type SimulationMode = 'landscape' | 'portrait';

const historyFields = (mode: SimulationMode) => mode === 'portrait'
  ? { used: 'shortsSimulationUsedQuestionIds', revision: 'shortsSimulationRevision' } as const
  : { used: 'simulationUsedQuestionIds', revision: 'simulationRevision' } as const;

export const listSimulationCategories = async (mode: SimulationMode = 'landscape') => {
  const { used } = historyFields(mode);
  await refreshCategories();
  return Category.aggregate<SimulationCategory>([
    { $sort: { order: 1, name: 1 } },
    { $lookup: {
      from: Question.collection.name,
      localField: 'name',
      foreignField: 'categories',
      let: { used: { $ifNull: [`$${used}`, []] } },
      pipeline: [
        { $group: {
          _id: null,
          count: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 0, 1] } },
          remaining: { $sum: { $cond: [
            { $or: [{ $eq: ['$isActive', false] }, { $in: ['$_id', '$$used'] }] },
            0, 1
          ] } }
        } }
      ],
      as: 'stats'
    } },
    { $set: { stats: { $arrayElemAt: ['$stats', 0] } } },
    { $project: {
      _id: 0, id: { $toString: '$_id' }, name: 1,
      count: { $ifNull: ['$stats.count', 0] },
      active: { $ifNull: ['$stats.active', 0] },
      remaining: { $ifNull: ['$stats.remaining', 0] },
      canReset: { $gt: [{ $size: { $ifNull: [`$${used}`, []] } }, 0] }
    } }
  ]);
};

export const listAvailableSimulationQuestions = async (name: string, mode: SimulationMode = 'landscape') => {
  const fields = historyFields(mode);
  const category = await Category.findOne({ name }).select(fields.used).lean().exec();
  if (!category) throw new ApiError(404, 'Category not found.');
  const docs = await Question.find({
    categories: name,
    isActive: { $ne: false },
    _id: { $nin: category[fields.used] ?? [] }
  }).select('questionId questionText options correctOption localized').sort({ questionId: 1, _id: 1 }).lean().exec();

  return docs.map((doc: SimulationQuestionPreview) => {
    const localized = doc.localized as Record<string, { questionText?: string; options?: string[] } | undefined> | undefined;
    const english = localized?.en;
    const assamese = localized?.as;
    const correctOption = Math.min(Math.max(0, doc.correctOption ?? 0), Math.max(0, (english?.options ?? doc.options ?? []).length - 1));
    return {
      id: String(doc._id),
      questionId: doc.questionId ?? null,
      questionText: english?.questionText || doc.questionText,
      assameseQuestionText: assamese?.questionText || '',
      options: english?.options ?? doc.options ?? [],
      assameseOptions: assamese?.options ?? [],
      correctAnswer: (english?.options ?? doc.options ?? [])[correctOption] ?? '',
      assameseCorrectAnswer: assamese?.options?.[correctOption] ?? ''
    };
  });
};

// Compare-and-swap also serializes competing admins and resets across server instances.
export const reserveSimulationQuestions = async (name: string, count: number, mode: SimulationMode = 'landscape', questionIds?: string[]) => {
  const fields = historyFields(mode);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const category = await Category.findOne({ name }).select(`${fields.used} ${fields.revision}`).lean().exec();
    if (!category) throw new ApiError(404, 'Category not found.');
    let selected: SimulationQuestion[];
    if (questionIds) {
      const documents = await Question.find({
        categories: name,
        isActive: { $ne: false },
        _id: { $in: questionIds, $nin: category[fields.used] ?? [] }
      }).select(`questionId questionText options correctOption explanation localized${mode === 'landscape' ? ' referenceImage' : ''}`).lean().exec();
      if (documents.length !== questionIds.length) {
        throw new ApiError(409, 'One or more selected questions are no longer available. Refresh the question list and try again.');
      }
      const byId = new Map(documents.map((doc) => [String(doc._id), doc]));
      selected = questionIds.map((id) => byId.get(id) as SimulationQuestion);
    } else {
      selected = await Question.aggregate<SimulationQuestion>([
        { $match: {
          categories: name, isActive: { $ne: false },
          _id: { $nin: category[fields.used] ?? [] }
        } },
        { $sample: { size: count } },
        { $project: { questionId: 1, questionText: 1, options: 1, correctOption: 1, explanation: 1, localized: 1, ...(mode === 'landscape' ? { referenceImage: 1 } : {}) } }
      ]);
    }
    if (!selected.length) throw new ApiError(409, 'No unused active questions remain. Reset this subject to use its questions again.');
    const revision = category[fields.revision] ?? 0;
    const result = await Category.updateOne({
      _id: category._id,
      name,
      ...(revision === 0
        ? { $or: [{ [fields.revision]: 0 }, { [fields.revision]: { $exists: false } }] }
        : { [fields.revision]: revision })
    }, {
      $addToSet: { [fields.used]: { $each: selected.map((doc) => doc._id) } },
      $inc: { [fields.revision]: 1 }
    });
    if (result.modifiedCount) return selected;
  }
  throw new ApiError(409, 'Simulation history changed while starting. Please try again.');
};

export const resetSimulationHistory = async (name: string, mode: SimulationMode = 'landscape') => {
  const fields = historyFields(mode);
  const result = await Category.updateOne({ name }, {
    $set: { [fields.used]: [] },
    $inc: { [fields.revision]: 1 }
  }).exec();
  if (!result.matchedCount) throw new ApiError(404, 'Category not found.');
};
