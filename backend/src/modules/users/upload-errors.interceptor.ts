import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { catchError, type Observable, throwError } from 'rxjs';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

/** Traduz o erro de limite do multer (413 genérico) para FILE_TOO_LARGE. Deve envolver o FileInterceptor. */
@Injectable()
export class UploadErrorsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof PayloadTooLargeException
              ? new AppException(ErrorCode.FILE_TOO_LARGE, { cause: error })
              : error,
          ),
        ),
      );
  }
}
