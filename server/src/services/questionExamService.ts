import { QuestionExam } from '../models/QuestionExam.js';
import { Question } from '../models/Question.js';
import { QuestionDraft } from '../models/QuestionDraft.js';
import { DEFAULT_EXAM_ALIASES, DEFAULT_QUESTION_EXAMS, setQuestionExams } from '../models/questionExams.js';
import { ApiError } from '../utils/ApiError.js';

const draftExamPaths = [
  'record.exams', 'record.classification.exams', 'record.classification.exam',
  'record.classification.examCategories', 'record.examCompatibility.eligibleExamIds'
];

export const listQuestionExams = async () => {
  // Deleted entries remain in the registry so removing the final exam never reseeds it.
  if (await QuestionExam.estimatedDocumentCount() === 0) {
    for (const [order, exam] of DEFAULT_QUESTION_EXAMS.entries()) {
      await QuestionExam.updateOne({ name: exam.name }, {
        $setOnInsert: { name: exam.name, order, aliases: DEFAULT_EXAM_ALIASES.filter(([, name]) => name === exam.name).map(([alias]) => alias) }
      }, { upsert: true, collation: { locale: 'en', strength: 2 } });
    }
  }
  // Add the new exam to existing installations, retaining renamed entries and deletion tombstones.
  await QuestionExam.updateOne({
    $or: [{ name: 'Assam Police and Forest' }, { aliases: 'Assam Police and Forest' }]
  }, {
    $setOnInsert: {
      name: 'Assam Police and Forest',
      aliases: ['Assam Police and Forest', 'assampolice', 'policeforest'],
      order: 1
    }
  }, { upsert: true, collation: { locale: 'en', strength: 2 } });
  const docs = await QuestionExam.find({ isDeleted: false }).sort({ order: 1, name: 1 }).exec();
  setQuestionExams(docs);
  return docs;
};

const assertUnique = async (name: string, exceptId?: string) => {
  const existing = await QuestionExam.findOne({ name }).collation({ locale: 'en', strength: 2 }).exec();
  if (existing && String(existing._id) !== exceptId) throw new ApiError(409, 'An exam with this name already exists.');
};

export const createQuestionExam = async (name: string) => {
  await listQuestionExams();
  const deleted = await QuestionExam.findOne({ name, isDeleted: true }).collation({ locale: 'en', strength: 2 }).exec();
  if (deleted) {
    deleted.name = name;
    deleted.isDeleted = false;
    await deleted.save();
    await listQuestionExams();
    return deleted;
  }
  await assertUnique(name);
  const last = await QuestionExam.findOne().sort({ order: -1 }).exec();
  const doc = await QuestionExam.create({ name, order: (last?.order ?? -1) + 1 });
  await listQuestionExams();
  return doc;
};

export const renameQuestionExam = async (id: string, name: string) => {
  const doc = await QuestionExam.findOne({ _id: id, isDeleted: false }).exec();
  if (!doc) throw new ApiError(404, 'Exam not found.');
  await assertUnique(name, id);
  const oldName = doc.name;
  if (oldName !== name) {
    await Question.updateMany({ exams: oldName }, { $set: { 'exams.$[exam]': name } }, { arrayFilters: [{ exam: oldName }] });
    await Question.updateMany({ 'classification.exam': oldName }, { $set: { 'classification.exam.$[exam]': name } }, { arrayFilters: [{ exam: oldName }] });
    for (const path of draftExamPaths) {
      await QuestionDraft.updateMany({ [path]: oldName }, { $set: { [`${path}.$[exam]`]: name } }, { arrayFilters: [{ exam: oldName }] });
    }
    doc.aliases = [...new Set([...doc.aliases, oldName])];
    doc.name = name;
    await doc.save();
  }
  await listQuestionExams();
  return doc;
};

export const deleteQuestionExam = async (id: string) => {
  const doc = await QuestionExam.findOne({ _id: id, isDeleted: false }).exec();
  if (!doc) throw new ApiError(404, 'Exam not found.');
  await Question.updateMany({ $or: [{ exams: doc.name }, { 'classification.exam': doc.name }] }, {
    $pull: { exams: doc.name, 'classification.exam': doc.name }
  });
  for (const path of draftExamPaths) {
    await QuestionDraft.updateMany({ [path]: doc.name }, { $pull: { [path]: doc.name } });
  }
  doc.isDeleted = true;
  await doc.save();
  await listQuestionExams();
};
