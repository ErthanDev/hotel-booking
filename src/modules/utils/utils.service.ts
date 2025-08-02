import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilsService {
    removeEmptyValues(obj: Record<string, any>): Record<string, any> {
        return Object.fromEntries(
            Object.entries(obj).filter(([_, value]) => value !== '')
        );
    }
}
