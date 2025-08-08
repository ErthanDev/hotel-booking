import { Controller, Get, Post, Req } from '@nestjs/common';
import { MomoPaymentService } from './momo-payment.service';
import { Public } from 'src/decorators/public.decorator';

@Controller('momo-payment')
export class MomoPaymentController {
  constructor(private readonly momoPaymentService: MomoPaymentService) { }

  // @Post('create-payment-link')
  // @Public()
  // async createPaymentLink(amount: number, bookingId: string) {
  //   return this.momoPaymentService.createLinkPayment();
  // }

  @Get('callback')
  @Public()
  async handleCallback(@Req() req: any) {
    const { body } = req;
    return this.momoPaymentService.handlePaymentCallback(body);
  }
}
