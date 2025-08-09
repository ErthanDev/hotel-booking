import { Module } from '@nestjs/common';
import { OutboxController } from './outbox.controller';
import { OutboxPublisher } from './outbox.publisher';
import { MongooseModule } from '@nestjs/mongoose';
import { Outbox, OutboxSchema } from './schema/outbox.schema';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Outbox.name, schema: OutboxSchema }]),
    CacheModule,
  ],
  controllers: [OutboxController],
  providers: [OutboxPublisher],
  exports: [OutboxPublisher],
})
export class OutboxModule { }
