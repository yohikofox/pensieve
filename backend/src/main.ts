import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import * as express from 'express';
import { AppModule } from './app.module';
import { getRabbitMQOptions } from './modules/knowledge/infrastructure/rabbitmq/rabbitmq.config';

async function bootstrap() {
  // bodyParser: false — Better Auth (ADR-029) needs raw Node.js request for /api/auth routes
  // We manually re-enable body parsing for all non-auth routes below
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  // Re-enable body parsing for all routes except /api/auth (handled by Better Auth)
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/auth')) return next();
    express.json()(req, res, next);
  });
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/auth')) return next();
    express.urlencoded({ extended: true })(req, res, next);
  });
  app.useLogger(app.get(Logger));

  // Enable CORS for admin frontend and mobile app
  app.enableCors({
    origin: [
      'http://localhost:3001', // Admin frontend
      'http://localhost:3002', // Web frontend (if needed)
      /^capacitor:\/\/localhost/, // Mobile Capacitor
      /^ionic:\/\/localhost/, // Mobile Ionic
    ],
    credentials: true,
  });

  // Connect RabbitMQ microservice for job consumption (Story 4.1 - AC3)
  // Hybrid app: HTTP API + Message Queue
  app.connectMicroservice(getRabbitMQOptions());

  // Start both HTTP server and microservice
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);

  const pinoLogger = app.get(Logger);
  pinoLogger.log(`HTTP Server running on port ${process.env.PORT ?? 3000}`);
  pinoLogger.log('RabbitMQ Consumer connected and listening for jobs');
}
void bootstrap();
