import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { AppError } from './errors/AppError.js';

// Route imports
import authRouter from './modules/auth/routes.js';
import usersRouter from './modules/users/routes.js';
import categoriesRouter from './modules/categories/routes.js';
import productsRouter from './modules/products/routes.js';
import inventoryRouter from './modules/inventory/routes.js';
import salesRouter from './modules/sales/routes.js';
import dashboardRouter from './modules/dashboard/routes.js';
import reportsRouter from './modules/reports/routes.js';
import auditRouter from './modules/audit/routes.js';

export const app = express();

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount modules
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/sales', salesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit-logs', auditRouter);

// 404 handler
app.use('*', (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// Global error handler
app.use(errorHandler);
