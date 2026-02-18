import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { getRabbitMQOptions } from './modules/knowledge/infrastructure/rabbitmq/rabbitmq.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
