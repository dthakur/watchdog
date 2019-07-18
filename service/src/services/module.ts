import { Module } from '@nestjs/common';

import ServicesController from './controller';
import Repository from '../repository';
import CustomLogger from '../logger';
import Settings from '../settings';

@Module({
  providers: [Repository, CustomLogger, Settings],
  controllers: [ServicesController],
})
export class ServicesModule {}
