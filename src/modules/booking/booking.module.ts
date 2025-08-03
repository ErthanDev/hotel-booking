import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schema/booking.schema';
import { Room, RoomSchema } from '../rooms/schema/room.schema';
import { CacheModule } from '../cache/cache.module';
import { MomoPaymentModule } from '../momo-payment/momo-payment.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema }
    ]),
    CacheModule,
    MomoPaymentModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule { }
