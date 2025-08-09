import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { NAME_QUEUE } from 'src/constants/name-queue.enum';


type OtpValidationResult = {
    success: boolean;
    retryAfter?: number;
};

@Injectable()
export class CacheService {
    private readonly OTP_TTL = 300;
    private readonly TTL = 60 * 60 * 24
    constructor(
        @InjectRedis() private readonly redis: Redis,
        @InjectQueue('otp') private readonly otpQueue: Queue,
        @InjectQueue('payment') private readonly paymentQueue: Queue,
    ) { }

    async generateOtp(
        nameAction: string,
        email: string,
        time: number,
        nameQueue: string,
    ): Promise<void> {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redis.set(
            `${nameAction}:${email}`,
            JSON.stringify({ email, time, otp }),
            'EX',
            this.OTP_TTL,
        );
        await this.otpQueue.add(`${nameQueue}`, { email, otp }, {
            removeOnFail: false,
        });
    }

    async getValueOtp(nameAction: string, email: string): Promise<{ email: string | null; otp: string | null; time: number | null }> {
        const cachedData = await this.redis.get(`${nameAction}:${email}`);
        if (!cachedData) {
            return {
                email: null,
                otp: null,
                time: null,
            };
        }
        return {
            email: JSON.parse(cachedData).email || null,
            otp: JSON.parse(cachedData).otp || null,
            time: JSON.parse(cachedData).time || null,
        };
    }

    async deleteOtp(nameAction: string, email: string): Promise<void> {
        const key = `${nameAction}:${email}`;

        await this.redis.del(key);
    }

    async validateOtp(nameAction: string, email: string, otp: string): Promise<OtpValidationResult> {
        const otpKey = `${nameAction}:${email}`;
        const failCountKey = `otp:fail:${nameAction}:${email}`;
        const blockKey = `otp:block:${nameAction}:${email}`;
        const blockLevelKey = `otp:blockLevel:${nameAction}:${email}`;

        const isBlocked = await this.redis.get(blockKey);
        if (isBlocked) {
            const ttl = await this.redis.ttl(blockKey); // giây còn lại
            return { success: false, retryAfter: ttl > 0 ? ttl : undefined };
        }

        const cachedData = await this.redis.get(otpKey);
        if (!cachedData) return { success: false };

        const { otp: cachedOtp } = JSON.parse(cachedData);
        const isMatch = cachedOtp === otp;

        if (isMatch) {
            await this.redis.del(failCountKey, blockKey, blockLevelKey);
            return { success: true };
        }

        // Xử lý sai
        let failCount = parseInt((await this.redis.get(failCountKey)) || '0');
        failCount++;
        await this.redis.set(failCountKey, failCount, 'EX', 3600);

        const blockLevel = parseInt((await this.redis.get(blockLevelKey)) || '0');

        if (blockLevel === 0 && failCount >= 5) {
            await this.redis.set(blockKey, '1', 'EX', 60);
            await this.redis.set(blockLevelKey, '1');
            return { success: false, retryAfter: 60 };
        }

        if (blockLevel === 1 && failCount >= 6) {
            await this.redis.set(blockKey, '1', 'EX', 120);
            await this.redis.set(blockLevelKey, '2');
            return { success: false, retryAfter: 120 };
        }

        if (blockLevel === 2 && failCount >= 7) {
            await this.redis.set(blockKey, '1', 'EX', 900); // 15 phút
            await this.redis.set(blockLevelKey, '3');
            return { success: false, retryAfter: 900 };
        }

        return { success: false };
    }




    async lockRoom(roomId: string, checkIn: Date, checkOut: Date) {
        const checkInStr = checkIn.toISOString();
        const checkOutStr = checkOut.toISOString();
        const lockKey = `room_lock:${roomId}:${checkInStr}:${checkOutStr}`;
        await this.redis.set(lockKey, 'LOCKED', 'EX', 5 * 60);
    }


    async isRoomTimeLocked(roomId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
        const keys = await this.redis.keys(`room_lock:${roomId}:*`);

        for (const key of keys) {
            const [_, __, ___, lockedCheckInStr, lockedCheckOutStr] = key.split(':');
            const lockedCheckIn = new Date(lockedCheckInStr);
            const lockedCheckOut = new Date(lockedCheckOutStr);

            const isOverlap =
                checkIn < lockedCheckOut && checkOut > lockedCheckIn;

            if (isOverlap) return true;
        }

        return false;
    }

    async unlockRoom(roomId: string, checkIn: Date, checkOut: Date) {
        const checkInStr = checkIn.toISOString();
        const checkOutStr = checkOut.toISOString();
        const lockKey = `room_lock:${roomId}:${checkInStr}:${checkOutStr}`;
        await this.redis.del(lockKey);
    }

    // async addToMomoPaymentQueue(data: any) {
    //     await this.momoPaymentQueue.add(`${NAME_QUEUE.HANDLE_CREATE_PAYMENT_URL}`, data, {
    //         removeOnFail: false,
    //     });
    // }

    async addToZaloPayQueue(data: any) {
        await this.paymentQueue.add(`${NAME_QUEUE.HANDLE_CREATE_PAYMENT_URL}`, data, {
            removeOnFail: false,
        });
    }





    async getListRoomTypesCache(limit: number, page: number) {
        const version = await this.getVersionCache(`room_types`);
        const cacheKey = `room_types:list:${version}:${page}:${limit}`;
        const cachedData = await this.redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        return null;
    }

    async setListRoomTypesCache(limit: number, page: number, data: any[]) {
        const version = await this.getVersionCache(`room_types`);
        const cacheKey = `room_types:list:${version}:${page}:${limit}`;
        await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.TTL);
    }

    async invalidateRoomTypesCache() {
        await this.increaseVersionCache(`room_types`);
    }

    async getRoomTypeCacheById(id: string): Promise<any> {
        const key = `room_type:${id}`;
        const cachedData = await this.redis.get(key);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        return null;
    }

    async setRoomTypeCacheById(id: string, data: any) {
        const key = `room_type:${id}`;
        await this.redis.set(key, JSON.stringify(data), 'EX', this.TTL);
    }

    async invalidateRoomTypeCacheById(id: string) {
        const key = `room_type:${id}`;
        await this.redis.del(key);
    }

    async getRoomDetailCacheById(id: string): Promise<any> {
        const key = `room_detail:${id}`;
        const cachedData = await this.redis.get(key);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        return null;
    }

    async setRoomDetailCacheById(id: string, data: any) {
        const key = `room_detail:${id}`;
        await this.redis.set(key, JSON.stringify(data), 'EX', this.TTL);
    }

    async invalidateRoomDetailCacheById(id: string) {
        const key = `room_detail:${id}`;
        await this.redis.del(key);
    }


    async getListCommentsCache(roomId: string, limit: number, page: number): Promise<any> {
        const version = await this.getVersionCache(`comments:${roomId}`);
        const cacheKey = `comments:list:${roomId}:${version}:${page}:${limit}`;
        const cachedData = await this.redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        return null;
    }

    async setListCommentsCache(roomId: string, limit: number, page: number, data: any[]) {
        const version = await this.getVersionCache(`comments:${roomId}`);
        const cacheKey = `comments:list:${roomId}:${version}:${page}:${limit}`;
        await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.TTL);
    }


    invalidateCommentsCache(roomId: string) {
        this.increaseVersionCache(`comments:${roomId}`);
    }
    async increaseVersionCache(
        key: string
    ) {
        const currentVersion = await this.redis.get(`${key}:version`);
        const newVersion = currentVersion ? parseInt(currentVersion) + 1 : 1;
        await this.redis.set(`${key}:version`, newVersion);
        return newVersion;
    }

    async getVersionCache(key: string): Promise<number> {
        const version = await this.redis.get(`${key}:version`);
        return version ? parseInt(version) : 0;
    }

    async cancelTransaction(providerTransactionId: string) {
        await this.paymentQueue.add(`${NAME_QUEUE.CANCEL_TRANSACTION}`, { providerTransactionId }, {
            removeOnFail: false,
        });
    }

    async sendNewPassword(email: string) {
        const newPassword = Math.random().toString(36).slice(-8);
        await this.otpQueue.add(`${NAME_QUEUE.SEND_NEW_PASSWORD}`, { email, newPassword }, {
            removeOnFail: false,
        });
    }
}
