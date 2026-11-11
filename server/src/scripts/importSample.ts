import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Question } from '../models/Question.js';
import { normalizeQuestionImport } from '../services/questionService.js';
import { listQuestionExams } from '../services/questionExamService.js';

const file = process.argv[2] ?? new URL('./data/sample-question.json', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

const run = async () => {
  const raw = JSON.parse(await readFile(decodeURIComponent(file), 'utf8'));
  const items = Array.isArray(raw) ? raw : [raw];

  await mongoose.connect(config.MONGO_URI);
  await listQuestionExams();
  for (const item of items) {
    const doc = normalizeQuestionImport(item);
    await Question.updateOne({ questionId: doc.questionId }, { $set: { ...doc, isActive: true } }, { upsert: true });
    console.log(`Imported ${doc.questionId}`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
