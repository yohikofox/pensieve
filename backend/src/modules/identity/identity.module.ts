import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { UsersController } from './infrastructure/controllers/users.controller';
import { UserFeaturesService } from './application/services/user-features.service';
import { User } from '../shared/infrastructure/persistence/typeorm/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AuthController, UsersController],
  providers: [UserFeaturesService],
  exports: [UserFeaturesService],
})
export class IdentityModule {}
