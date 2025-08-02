import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
    private readonly OTP_TTL = 60;
    constructor(
        @InjectRedis() private readonly redis: Redis,
        @InjectQueue('otp') private readonly otpQueue: Queue,

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

    async validateOtp(nameAction: string, email: string, otp: string): Promise<boolean> {
        const key = `${nameAction}:${email}`;
        const cachedData = await this.redis.get(key);
        if (!cachedData) {
            console
            return false;
        }
        const { otp: cachedOtp } = JSON.parse(cachedData);
        return cachedOtp === otp;
    }
}
