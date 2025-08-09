import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from './schema/transaction.schema';
import { TransactionGateway } from './gateway/transaction.gateway';
import { Booking, BookingSchema } from '../booking/schema/booking.schema';



@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Booking.name, schema: BookingSchema }

    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionGateway],
  exports: [TransactionGateway, TransactionsService]
})
export class TransactionsModule { }
