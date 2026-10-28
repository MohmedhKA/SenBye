import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { startCloser } from './services/closer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());

  // Static uploads directory (proxy forwarded from client :5173/uploads -> :4000/uploads)
  app.use('/uploads', express.static(uploadsDir));

  // Mount API router
  app.use('/api', apiRouter);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

// Start server if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  const stopCloser = startCloser();

  const server = app.listen(config.port, () => {
    console.log(`SenBye server running on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    console.log('Shutting down server...');
    stopCloser();
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
