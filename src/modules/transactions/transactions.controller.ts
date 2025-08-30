import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

import { PaymentMethod } from './schema/transaction.schema';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { UserRole } from 'src/constants/user-role';
import { Roles } from 'src/decorators/roles.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) { }

  @Get('revenue/monthly')
  @Roles(UserRole.ADMIN)
  @ResponseMessage('Monthly revenue retrieved successfully')
  async getRevenue(@Query('year') year: number, @Query('paymentMethod') paymentMethod: PaymentMethod) {
    return this.transactionsService.getMonthlyRevenue(year, paymentMethod);
  }
}
