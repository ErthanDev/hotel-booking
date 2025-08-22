import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import moment from 'moment-timezone';
import { TransactionsService } from '../transactions/transactions.service';
import { AppException } from 'src/common/exception/app.exception';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly apiBase: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly transactionsService: TransactionsService,
    private readonly httpService: HttpService,
  ) {
    this.botToken = (this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '').trim();
    this.chatId = (this.configService.get<string>('TELEGRAM_CHAT_ID') ?? '').trim();
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;

    if (!this.botToken || !this.chatId) {
      this.logger.warn('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.');
    }
  }

  private async sendMessageRaw(text: string, options?: { [k: string]: any }) {
    try {
      if (!this.botToken || !this.chatId) {
        throw new AppException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Telegram bot token or chat id is not configured.',
          errorCode: 'TELEGRAM_NOT_CONFIGURED',
        });
      }

      const url = `${this.apiBase}/sendMessage`;
      const payload = {
        chat_id: this.chatId,
        text,
        ...options,
      };

      const resp = await firstValueFrom(this.httpService.post(url, payload));
      this.logger.debug(`Telegram API responded with status ${resp.status}`);
      return resp.data;
    } catch (err) {
      const e: any = err;
      this.logger.error('Error sending Telegram message', JSON.stringify({
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
      }));

      const description = e?.response?.data?.description ?? e?.message ?? 'Unknown error';
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Failed to send Telegram message: ${description}`,
        errorCode: 'TELEGRAM_SEND_MESSAGE_FAILED',
      });
    }
  }

  async sendDailyRevenue() {
    const todayVN = moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD');
    const revenue = await this.transactionsService.getRevenueForDate(todayVN);

    const message = `📊 Doanh thu ngày ${todayVN} là: ${revenue.toLocaleString('vi-VN')} VND`;
    this.logger.debug(`Sending daily revenue message to Telegram: ${message}`);

    try {
      await this.sendMessageRaw(message);
      this.logger.debug('Sent daily revenue message to Telegram successfully.');
    } catch (error) {
      this.logger.error('Failed to send daily revenue to Telegram:', (error as any).message);
      throw error;
    }
  }
}
