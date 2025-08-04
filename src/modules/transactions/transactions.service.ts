import { Injectable, Logger } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Transaction, TransactionDocument, TransactionStatus } from './schema/transaction.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../booking/schema/booking.schema';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
  ) { }


  async checkStatusTransaction() {
    this.logger.log('Checking transaction statuses...');
    const now = new Date();

    const expiredBookings = await this.bookingModel.find({
      status: { $in: [OccupancyStatus.PENDING] },
      expiredAt: { $lte: now },
    });

    if (!expiredBookings.length) return;

    const bookingUpdates: any[] = [];
    const transactionUpdates: any[] = [];

    for (const booking of expiredBookings) {
      const transaction = await this.transactionModel.findOne({
        bookingId: booking._id,
      });

      let newStatus: OccupancyStatus;

      if (transaction?.status === TransactionStatus.SUCCESS) {
        newStatus = OccupancyStatus.CONFIRMED;
      } else {
        newStatus = OccupancyStatus.FAILED;
        if (transaction && transaction.status == TransactionStatus.FAILED) {
          continue
        }
        else {
          transactionUpdates.push({
            updateOne: {
              filter: { providerTransactionId: booking.bookingId },
              update: { $set: { status: TransactionStatus.FAILED } },
            },
          });
        }
      }

      bookingUpdates.push({
        updateOne: {
          filter: { _id: booking._id },
          update: { $set: { status: newStatus } },
        },
      });
    }

    if (bookingUpdates.length > 0) {
      this.logger.debug(`Updating ${bookingUpdates.length} bookings to status ${OccupancyStatus.FAILED}`);
      await this.bookingModel.bulkWrite(bookingUpdates);
    }

    if (transactionUpdates.length > 0) {
      this.logger.debug(`Updating ${transactionUpdates.length} transactions to status ${TransactionStatus.FAILED}`);
      await this.transactionModel.bulkWrite(transactionUpdates);
    }
  }

}
