import { Module } from '@nestjs/common';
import { AuthController } from './infrastructure/controllers/auth.controller';

@Module({
  controllers: [AuthController],
})
export class IdentityModule {}
