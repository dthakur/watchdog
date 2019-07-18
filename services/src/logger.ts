import { LoggerService, Injectable } from '@nestjs/common';

// no colors
@Injectable()
export default class CustomLogger implements LoggerService {
  log(message: string) {
    console.log(message);
  }

  error(message: string, trace: string) {
    console.error(message);
    console.trace(trace);
  }

  warn(message: string) {
    console.warn(message);
  }

  debug(message: string) {
    console.debug(message);
  }

  verbose(message: string) {
    console.trace(message);
  }
}
