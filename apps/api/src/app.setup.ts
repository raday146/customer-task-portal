import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

/** Shared configuration used by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  return app;
}
