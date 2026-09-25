import { Module } from '@nestjs/common';
import { AvatarStorageService } from './avatar-storage.service.js';
import { UsersController } from './users.controller.js';
import { OnboardingService } from './onboarding.service.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AvatarStorageService, OnboardingService],
})
export class UsersModule {}
