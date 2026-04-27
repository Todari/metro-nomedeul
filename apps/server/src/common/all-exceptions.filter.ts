import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureException } from './sentry';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    // Non-HTTP contexts (e.g. WebSocket) are handled by their own filters/guards.
    if (!ctx.getRequest) {
      return;
    }

    const request = ctx.getRequest<Request | undefined>();
    const response = ctx.getResponse<Response | undefined>();
    if (!request || !response) {
      return;
    }

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const publicMessage = isHttp
      ? this.extractMessage(exception.getResponse())
      : 'Internal server error';

    if (!isHttp || status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${
          exception instanceof Error
            ? (exception.stack ?? exception.message)
            : String(exception)
        }`,
      );
      captureException(exception, { method: request.method, url: request.url });
    }

    response.status(status).json({
      statusCode: status,
      message: publicMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private extractMessage(payload: string | object): string {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const msg = (payload as { message: unknown }).message;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg)) return msg.join(', ');
    }
    return 'Error';
  }
}
