import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import CustomLogger from './logger';
import * as express from 'express';
import compression from 'compression';

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLogger() // removes colors for gcloud
  });

  app.enableCors();
  app.use(compression());
  app.use('/', express.static('./public'));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe());

  return app;
}

main().then(app => {
  app.listen(process.env.PORT || 8080);
});
