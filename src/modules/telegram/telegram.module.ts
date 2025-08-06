import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    TransactionsModule
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule { }
