import { HttpException, HttpStatus } from '@nestjs/common';

interface AppExceptionOptions {
    message: string;
    errorCode: string;
    statusCode?: HttpStatus;
    meta?: Record<string, any>;
}

export class AppException extends HttpException {
    constructor(options: AppExceptionOptions) {
        super(
            {
                message: options.message,
                errorCode: options.errorCode,
                statusCode: options.statusCode ?? HttpStatus.BAD_REQUEST,
                meta: options.meta ?? null,
            },
            options.statusCode ?? HttpStatus.BAD_REQUEST,
        );
    }
}