import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRabbitMQOptions } from './modules/knowledge/infrastructure/rabbitmq/rabbitmq.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Connect RabbitMQ microservice for job consumption (Story 4.1 - AC3)
  // Hybrid app: HTTP API + Message Queue
  app.connectMicroservice(getRabbitMQOptions());

  // Start both HTTP server and microservice
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);

  console.log(`🚀 HTTP Server running on port ${process.env.PORT ?? 3000}`);
  console.log(`🐰 RabbitMQ Consumer connected and listening for jobs`);
}
bootstrap();
