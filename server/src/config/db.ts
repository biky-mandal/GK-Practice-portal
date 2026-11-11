import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from './logger.js';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error({ error }, 'MongoDB connection failed');
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};
