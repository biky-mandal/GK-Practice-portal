import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { allowedOrigins, config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import { notFoundHandler } from './middleware/notFound.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import testRoutes from './routes/testRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import examRoutes from './routes/examRoutes.js';
import attemptRoutes from './routes/attemptRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import adminManageRoutes from './routes/adminManageRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import flagRoutes from './routes/flagRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';

export const app: Express = express();

// The API runs behind nginx, so trust its forwarded client IP (rate limits, logs).
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));
// Admin question uploads can exceed the default 1mb limit.
// Razorpay signs the raw body, so the webhook must skip JSON parsing.
app.use('/api/purchases/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/admin/questions/bulk-import', express.json({ limit: '10mb' }));
app.use('/api/admin/questions/drafts', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Server healthy', data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tests', testRoutes);
// Older routers expose question content and answer keys; the app does not use them, so only admins may.
app.use('/api/questions', requireAuth, requireAdmin, questionRoutes);
app.use('/api/exams', requireAuth, requireAdmin, examRoutes);
app.use('/api/attempts', requireAuth, requireAdmin, attemptRoutes);
app.use('/api/admin/manage', adminManageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/reviews', reviewRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
