import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TransactionsModule,
    HttpModule
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule { }
