import { Module } from '@nestjs/common';
import { MomoPaymentService } from './momo-payment.service';
import { MomoPaymentController } from './momo-payment.controller';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from '../transactions/schema/transaction.schema';
import { UtilsModule } from '../utils/utils.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { Booking, BookingSchema } from '../booking/schema/booking.schema';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Booking.name, schema: BookingSchema }
    ]),
    UtilsModule,
    TransactionsModule,
  ],
  controllers: [MomoPaymentController],
  providers: [MomoPaymentService],
  exports: [MomoPaymentService]
})
export class MomoPaymentModule { }
