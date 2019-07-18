import { Module, HttpModule } from '@nestjs/common';

import Repository from '../repository';
import CustomLogger from '../logger';
import Settings from '../settings';
import MonitorController from './controller';
import Checker from './checker';

@Module({
  imports: [
    HttpModule.register({
      timeout: 3000,
      maxRedirects: 5,
    }),
  ],
  providers: [Repository, CustomLogger, Settings, Checker],
  controllers: [MonitorController],
})
export class MonitorModule {}
