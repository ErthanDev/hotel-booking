import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod, Transaction, TransactionDocument, TransactionStatus } from './schema/transaction.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../booking/schema/booking.schema';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
import moment from 'moment-timezone';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly cacheService: CacheService,
  ) { }


  async checkStatusTransaction() {
    this.logger.log('Checking transaction statuses...');
    const now = new Date();

    const expiredBookings = await this.bookingModel.find({
      status: { $in: [OccupancyStatus.PENDING, OccupancyStatus.PAYMENT_URL] },
      expiredAt: { $lte: now },
    }).select('_id status bookingId userEmail');

    if (!expiredBookings.length) return;

    const bookingUpdates: any[] = [];
    const transactionUpdates: any[] = [];
    const affectedUsers = new Set<string>();

    for (const booking of expiredBookings) {
      const tx = await this.transactionModel.findOne({ bookingId: booking._id }).select('status providerTransactionId');

      let newStatus: OccupancyStatus;
      let shouldUpdateTx = false;

      if (tx?.status === TransactionStatus.SUCCESS) {
        newStatus = OccupancyStatus.CONFIRMED;
      } else {
        newStatus = OccupancyStatus.FAILED;
        if (!tx || tx.status !== TransactionStatus.FAILED) {
          shouldUpdateTx = true;
        }
      }

      if (shouldUpdateTx) {
        transactionUpdates.push({
          updateOne: {
            filter: { providerTransactionId: booking.bookingId },
            update: { $set: { status: TransactionStatus.FAILED } },
          },
        });
      }

      if (booking.status !== newStatus) {
        bookingUpdates.push({
          updateOne: {
            filter: { _id: booking._id },
            update: { $set: { status: newStatus } },
          },
        });
        if (booking.userEmail) affectedUsers.add(booking.userEmail);
      }
    }

    if (bookingUpdates.length) {
      this.logger.debug(`Updating ${bookingUpdates.length} bookings`);
      await this.bookingModel.bulkWrite(bookingUpdates);
    }

    if (transactionUpdates.length) {
      this.logger.debug(`Updating ${transactionUpdates.length} transactions`);
      await this.transactionModel.bulkWrite(transactionUpdates);
    }

    if (affectedUsers.size) {
      await Promise.all(
        [...affectedUsers].map((email) => this.cacheService.invalidateMyBookingsCache(email))
      );
      this.logger.debug(`Invalidated my_bookings cache for ${affectedUsers.size} users`);
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

  async getMonthlyRevenue(year: number, method?: PaymentMethod) {
    const TZ = 'Asia/Ho_Chi_Minh';
    if (!year || year < 1970 || year > 3000) {
      year = new Date().getFullYear();
    }
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

    const match: any = {
      status: TransactionStatus.SUCCESS,
      createdAt: { $gte: start, $lt: end },
    };
    if (method) match.method = method;

    const rows = await this.transactionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt',
              timezone: TZ,
            },
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, month: '$_id', revenue: 1, count: 1 } },
      { $sort: { month: 1 } },
    ]);

    const result: { month: string; revenue: number; count: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const r = rows.find((x) => x.month === key);
      result.push({ month: key, revenue: r?.revenue ?? 0, count: r?.count ?? 0 });
    }
    return result;
  }
}
