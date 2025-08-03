import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from './schema/transaction.schema';
import { TransactionGateway } from './gateway/transaction.gateway';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema }
    ]),

  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionGateway],
  exports: [TransactionGateway]
})
export class TransactionsModule { }
