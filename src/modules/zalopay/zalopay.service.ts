import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, Transaction, TransactionDocument, TransactionStatus } from '../transactions/schema/transaction.schema';
import { Connection, Model } from 'mongoose';
import moment from 'moment';
import * as crypto from 'crypto';
import { map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AppException } from 'src/common/exception/app.exception';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { TransactionGateway } from '../transactions/gateway/transaction.gateway';
import { Booking, BookingDocument } from '../booking/schema/booking.schema';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';

@Injectable()
export class ZalopayService {
    private readonly logger = new Logger(ZalopayService.name);
    private config: any;
    constructor(
        private configService: ConfigService,
        private readonly transactionsGateway: TransactionGateway,
        @InjectModel(Transaction.name)
        private readonly transactionModel: Model<TransactionDocument>,
        private readonly httpService: HttpService,
        @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
        @InjectConnection() private readonly connection: Connection,
    ) {
        this.config = {
            app_id: this.configService.get<string>('ZALOPAY_APP_ID'),
            key1: this.configService.get<string>('ZALOPAY_KEY1'),
            key2: this.configService.get<string>('ZALOPAY_KEY2'),
            endpoint: this.configService.get<string>('ZALOPAY_ENDPOINT')
        };
    }

    async createZaloPayPayment(amount: number, bookingId: string, userEmail?: string) {
        const items = [{}];
        const transID = bookingId;
        const embed_data = {
            redirecturl: this.configService.get<string>('ZALOPAY_REDIRECT_URL'),
            transactionId: transID
        };

        const order = {
            app_id: this.config.app_id,
            app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // translation missing: vi.docs.shared.sample_code.comments.app_trans_id
            app_user: "Infinity Stay Hotel",
            app_time: Date.now(),
            item: JSON.stringify(items),
            embed_data: JSON.stringify(embed_data),
            amount: amount,
            description: `Infinity Stay Hotel - Payment for booking #${transID}`,
            bank_code: "",
            callback_url: `${this.configService.get<string>('ZALOPAY_CALLBACK_URL')}`,
            mac: ""
        };

        const data = this.config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
        order.mac = this.createSecureHash(data, this.config.key1)
        const session = await this.connection.startSession();
        session.startTransaction();
        try {
            const result: any = await this.httpService.post(this.config.endpoint, null, {
                params: order
            }).pipe(map((res: any) => res.data))
                .toPromise();
            if (result.return_code !== 1) {
                throw new AppException({
                    errorCode: 'ZALOPAY_ERROR',
                    message: result.return_message,
                    statusCode: HttpStatus.BAD_REQUEST,
                });
            }

            const transaction = new this.transactionModel({
                providerTransactionId: bookingId,
                amount: amount,
                status: TransactionStatus.PENDING,
                method: PaymentMethod.ZALOPAY,
            });
            await transaction.save({ session });
            if (userEmail) {
                await this.bookingModel.updateOne({
                    bookingId: bookingId,
                }, {
                    paymentUrl: result.order_url,
                    status: OccupancyStatus.PAYMENT_URL
                }, { session });
                this.transactionsGateway.sendPaymentUrl(userEmail, {
                    bookingId,
                    payUrl: result.order_url,
                });
                this.logger.log(`Payment URL sent to user: ${userEmail}`);
            }
            await session.commitTransaction();

            return result;
        }
        catch (error) {
            this.logger.error(`Error creating ZaloPay payment: ${error.message}`, error.stack);
            await session.abortTransaction();
            throw new AppException({
                errorCode: 'ZALOPAY_ERROR',
                message: error.message || 'Failed to create ZaloPay payment',
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            });
        }
        finally {
            session.endSession();
        }
    }

    createSecureHash(notEncodeData: string, key: string) {
        return crypto.createHmac('sha256', key).update(notEncodeData).digest('hex');
    }

    async callBackZaloPay(req: any) {
        this.logger.log(`ZaloPay callback received`);
        let result = {
            return_code: 1,
            return_message: "success",
        };

        let embedData;
        try {
            let dataStr = req.body.data;
            let reqMac = req.body.mac;

            let mac = this.createSecureHash(dataStr, this.config.key2);

            let dataJson = JSON.parse(dataStr);
            embedData = JSON.parse(dataJson['embed_data']);
            const transaction = await this.transactionModel.findOne({ providerTransactionId: embedData['transactionId'] });
            if (!transaction) {
                this.logger.warn(`Transaction not found: ${embedData['transactionId']}`);
                return;
            }

            transaction.status = result.return_code === 1 ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
            await transaction.save();

            if (reqMac !== mac) {
                this.logger.debug(`ZaloPay callback MAC mismatch: expected ${mac}, received ${reqMac}`);
                result.return_code = -1;
                result.return_message = "mac not equal";

                await this.bookingModel.updateOne(
                    { bookingId: transaction.providerTransactionId },
                    { $set: { status: OccupancyStatus.FAILED } }
                );
                this.logger.log(`Booking ${transaction.providerTransactionId} marked as FAILED`);
            }
            else {
                this.logger.debug(`ZaloPay callback successful for transaction: ${transaction.providerTransactionId}`);
                result.return_code = 1;
                result.return_message = "success";
                await this.bookingModel.updateOne(
                    { bookingId: transaction.providerTransactionId },
                    { $set: { status: OccupancyStatus.CONFIRMED } }
                );
            }
        } catch (ex) {
            this.logger.error(`ZaloPay callback error: ${ex.message}`, ex.stack)
            return result;
        }

        return result;
    }
}
// {
//   return_code: 1,
//   return_message: 'Giao dịch thành công',
//   sub_return_code: 1,
//   sub_return_message: 'Giao dịch thành công',
//   zp_trans_token: 'ACue0WiS182Vj3ZSKCL1d2Ew',
//   order_url: 'https://qcgateway.zalopay.vn/openinapp?order=eyJ6cHRyYW5zdG9rZW4iOiJBQ3VlMFdpUzE4MlZqM1pTS0NMMWQyRXciLCJhcHBpZCI6MjU1NH0=',
//   order_token: 'ACue0WiS182Vj3ZSKCL1d2Ew'
// }