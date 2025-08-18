import { Injectable, Logger } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PaymentMethod, Transaction, TransactionDocument, TransactionStatus } from './schema/transaction.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../booking/schema/booking.schema';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
import moment from 'moment-timezone';

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
      status: { $in: [OccupancyStatus.PENDING, OccupancyStatus.PAYMENT_URL] },
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

  async getRevenueForDate(date: string): Promise<number> {
    this.logger.log(`Calculating revenue for date (VN): ${date}`);


    const tz = 'Asia/Ho_Chi_Minh';

    const startOfDayUTC = moment.tz(date, tz).startOf('day').utc().toDate();

    const endOfDayUTC = moment.tz(date, tz).endOf('day').utc().toDate();

    const endOfDayUTCExclusive = moment.tz(date, tz).add(1, 'day').startOf('day').utc().toDate();

    this.logger.log(`From: ${startOfDayUTC.toISOString()} - To: ${endOfDayUTC.toISOString()}`);

    const totalRevenue = await this.transactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDayUTC, $lte: endOfDayUTCExclusive },
          status: TransactionStatus.SUCCESS,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);
    this.logger.debug(`Total revenue for date ${date}: ${totalRevenue[0]?.total || 0}`);
    return totalRevenue[0]?.total || 0;
  }


  async cancelTransaction(providerTransactionId: string) {
    this.logger.log(`Cancelling transaction with ID: ${providerTransactionId}`);
    await this.transactionModel.updateOne(
      { providerTransactionId },
      { $set: { status: TransactionStatus.CANCELLED } },
    );
    this.logger.log(`Transaction ${providerTransactionId} cancelled successfully.`);
  }

  async createTransactionWithCashMethod(bookingId: string, totalPrice: number, method: PaymentMethod): Promise<Transaction> {
    this.logger.log(`Creating transaction with cash method for booking ID: ${bookingId}`);
    const newTransaction = new this.transactionModel({
      providerTransactionId: bookingId,
      amount: totalPrice,
      status: TransactionStatus.SUCCESS,
      method,
    });

    const savedTransaction = await newTransaction.save();
    this.logger.log(`Transaction created successfully with ID: ${savedTransaction._id}`);
    return savedTransaction;
  }
}
