import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron } from "@nestjs/schedule";
import { Model } from "mongoose";
import { OccupancyStatus } from "src/constants/occupancy-status.enum";
import { Booking, BookingDocument } from "src/modules/booking/schema/booking.schema";
import { Transaction, TransactionDocument } from "src/modules/transactions/schema/transaction.schema";
import { TransactionsService } from "src/modules/transactions/transactions.service";

@Injectable()
export class BookingCron {
    private readonly logger = new Logger(BookingCron.name);
    constructor(
        private readonly transactionsService: TransactionsService,
    ) {
    }

    @Cron('*/5 * * * *')
    async handleBookingExpiration() {
        this.logger.log('Running booking expiration check...');
        try {
            await this.transactionsService.checkStatusTransaction();
            this.logger.log('Booking expiration check completed successfully.');
        } catch (error) {
            this.logger.error('Error during booking expiration check:', error);
        }

    }
}