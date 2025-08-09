import { Controller, Post, Req } from '@nestjs/common';
import { ZalopayService } from './zalopay.service';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';

@Controller('zalopay')
export class ZalopayController {
  constructor(private readonly zalopayService: ZalopayService) { }

  @Post('/callback')
  @Public()
  @ResponseMessage('Create zalopay payment successfully')
  callback(@Req() req) {
    this.zalopayService.callBackZaloPay(req);
  }
}
