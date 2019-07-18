import { Controller, Post } from '@nestjs/common';
import _ from 'lodash';
import Checker from './checker';

@Controller('monitors')
export default class MonitorController {
  constructor(private readonly checker: Checker) {}

  @Post()
  async run() {
    return this.checker.run();
  }
}
