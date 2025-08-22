import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { HttpModule } from '@nestjs/axios';
import * as https from 'https';
import * as http from 'http';
@Module({
  imports: [
    TransactionsModule,
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 8000,            
        maxRedirects: 2,
        httpsAgent: new https.Agent({ keepAlive: true, family: 4 }), 
        httpAgent: new http.Agent({ keepAlive: true, family: 4 }),   
        proxy: false as any,
        validateStatus: () => true, 
      }),
    }),
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule { }
