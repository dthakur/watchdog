import { Module } from '@nestjs/common';
import { ServicesModule } from './services/module';
import { MonitorModule } from './monitor/module';

@Module({
  imports: [
    ServicesModule,
    MonitorModule
  ],
})
export class AppModule {}
