import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.logger.log(
            `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`,
          );
        },
        error: (err) => {
          const status = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
          this.logger.warn(`${req.method} ${req.originalUrl} ${status} ${Date.now() - started}ms`);
        },
      }),
    );
  }
}
