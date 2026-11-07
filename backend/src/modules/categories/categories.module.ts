import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { CategorySuggesterService } from './category-suggester.service.js';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategorySuggesterService],
  exports: [CategoriesService, CategorySuggesterService],
})
export class CategoriesModule {}
