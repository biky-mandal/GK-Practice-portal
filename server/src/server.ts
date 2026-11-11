import { connectDatabase } from './config/db.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import app from './app.js';
import { attachPracticeSocket } from './ws/practiceSocket.js';
import { refreshCategories } from './services/categoryService.js';
import { backfillCategories } from './services/questionService.js';
import { migrateUserIndexes } from './services/userService.js';
import { migrateLegacyPurchases } from './services/entitlementService.js';
import { listQuestionExams } from './services/questionExamService.js';
import { AccountDeletionAudit } from './models/AccountDeletionAudit.js';
import { AccountDeletionChallenge } from './models/AccountDeletionChallenge.js';

const startServer = async () => {
  try {
    await connectDatabase();
    await Promise.all([AccountDeletionChallenge.init(), AccountDeletionAudit.init()]);
    await listQuestionExams();
    await migrateUserIndexes().catch((error) => logger.warn({ error }, 'User index migration failed'));
    await refreshCategories().catch((error) => logger.warn({ error }, 'Category load failed'));
    await backfillCategories().catch((error) => logger.warn({ error }, 'Category backfill failed'));
    await migrateLegacyPurchases().catch((error) => logger.warn({ error }, 'Legacy purchase migration failed'));
    const server = app.listen(config.PORT, () => {
      logger.info(`Server listening on port ${config.PORT}`);
    });
    attachPracticeSocket(server);
  } catch (error) {
    logger.error({ error }, 'Unable to start server');
    process.exit(1);
  }
};

startServer();

const shutdown = async () => {
  logger.info('Shutting down gracefully');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
