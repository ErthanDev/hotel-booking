import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilsService {
    removeEmptyValues(obj: Record<string, any>): Record<string, any> {
        return Object.fromEntries(
            Object.entries(obj).filter(([_, value]) => value !== '')
        );
    }

    generateRandom(
        length: number,
        includeUppercase: boolean = false,
    ): string {
        const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const chars = includeUppercase
            ? lowercaseChars + uppercaseChars
            : lowercaseChars;

        let randomString = '';
        for (let i = 0; i < length; i++) {
            randomString += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return randomString;
    }

}
