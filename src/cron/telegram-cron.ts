import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { TelegramService } from "src/modules/telegram/telegram.service";

@Injectable()
export class TelegramCron {
    private readonly logger = new Logger(TelegramCron.name);
    constructor(
        private readonly telegramService: TelegramService,
    ) {

    }

    @Cron('59 16 * * *')
    async sendDailyRevenue() {
        try {
            this.logger.log('Running daily revenue report...');
            await this.telegramService.sendDailyRevenue();
            this.logger.log('Daily revenue report sent successfully.');
        } catch (error) {
            this.logger.error('Error sending daily revenue:', error);
        }
    }
}