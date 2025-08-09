import { Injectable, Logger } from '@nestjs/common';
import { Outbox, OutboxDocument } from './schema/outbox.schema';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxStatus } from 'src/constants/outbox-status.enum';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class OutboxPublisher {
    private readonly logger = new Logger(OutboxPublisher.name);

    constructor(
        @InjectModel(Outbox.name) private readonly outboxModel: Model<OutboxDocument>,
        private cacheService: CacheService,

    ) { }

    @Cron(CronExpression.EVERY_SECOND)
    async publishNew() {
        this.logger.log('Publishing new outbox events...');
        const events = await this.outboxModel.find({ status: OutboxStatus.NEW }).limit(100);
        if (!events.length) {
            this.logger.log('No new outbox events to publish.');
            return;
        }
        this.logger.log(`Found ${events.length} new outbox events to publish.`);
        for (const evt of events) {
            if (evt.type === 'BookingCreated') {
                await this.cacheService.addToOutbox(evt.payload.bookingId, evt.payload.amount);

                await this.outboxModel.updateOne({ _id: evt._id }, { $set: { status: OutboxStatus.PUBLISHED } });
            }
        }
    }
}
