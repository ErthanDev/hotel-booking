import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schema/booking.schema';
import { Room, RoomSchema } from '../rooms/schema/room.schema';
import { CacheModule } from '../cache/cache.module';
import { UtilsModule } from '../utils/utils.module';
import { Transaction, TransactionSchema } from '../transactions/schema/transaction.schema';
import { ZalopayModule } from '../zalopay/zalopay.module';
import { Outbox, OutboxSchema } from '../outbox/schema/outbox.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Outbox.name, schema: OutboxSchema },

    ]),
    CacheModule,
    UtilsModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule { }
