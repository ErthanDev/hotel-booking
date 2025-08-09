import { Module } from '@nestjs/common';
import { ZalopayService } from './zalopay.service';
import { ZalopayController } from './zalopay.controller';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from '../transactions/schema/transaction.schema';
import { Booking, BookingSchema } from '../booking/schema/booking.schema';
import { UtilsModule } from '../utils/utils.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    UtilsModule,
    TransactionsModule,
    BookingModule,
  ],
  controllers: [ZalopayController],
  providers: [ZalopayService],
  exports: [ZalopayService]
})
export class ZalopayModule { }
