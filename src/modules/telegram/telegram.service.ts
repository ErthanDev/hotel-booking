import { Injectable, Logger } from '@nestjs/common';

import TelegramBot from 'node-telegram-bot-api';
import moment from 'moment-timezone';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TransactionsService } from '../transactions/transactions.service';
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot;
  private chatId: string;
  private readonly botToken: string;
  ;

  constructor(
    private readonly configService: ConfigService,
    private readonly transactionsService: TransactionsService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim() ?? ''
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID')?.trim() ?? ''
    this.bot = new TelegramBot(this.botToken, { polling: false });

  }

  async sendDailyRevenue() {
    const todayVN = moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD');

    const revenue = await this.transactionsService.getRevenueForDate(todayVN);

    const message = `📊 Doanh thu ngày ${todayVN} là: ${revenue.toLocaleString('vi-VN')} VND`;

    try {
      await this.bot.sendMessage(this.chatId, message);
      this.logger.log('Đã gửi báo cáo doanh thu hàng ngày');
    } catch (error) {
      this.logger.error('Lỗi gửi tin nhắn Telegram:', error);
    }
  }

}
