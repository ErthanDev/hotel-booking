import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

import { PaymentMethod } from './schema/transaction.schema';
import { Public } from 'src/decorators/public.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) { }

  @Get('revenue/monthly')
  @Public()
  @ResponseMessage('Monthly revenue retrieved successfully')
  async getRevenue(@Query('year') year: number, @Query('paymentMethod') paymentMethod: PaymentMethod) {
    return this.transactionsService.getMonthlyRevenue(year, paymentMethod);
  }
}
