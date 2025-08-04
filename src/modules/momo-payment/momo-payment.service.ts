import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { map } from 'rxjs';
import { PaymentMethod, Transaction, TransactionDocument, TransactionStatus } from '../transactions/schema/transaction.schema';
import { Model } from 'mongoose';
import { UtilsService } from '../utils/utils.service';
import { AppException } from 'src/common/exception/app.exception';
import { TransactionGateway } from '../transactions/gateway/transaction.gateway';
import { Booking, BookingDocument } from '../booking/schema/booking.schema';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
const crypto = require('crypto');
@Injectable()
export class MomoPaymentService {
    private readonly logger = new Logger(MomoPaymentService.name);
    private readonly accessKey: string;
    private readonly secretKey: string;
    private readonly partnerCode: string;
    private readonly redirectUrl: string;
    private readonly ipnUrl: string;
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,

        private readonly transactionsGateway: TransactionGateway,
        @InjectModel(Transaction.name)
        private readonly transactionModel: Model<TransactionDocument>,
        @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,

    ) {
        this.accessKey = this.configService.get<string>('MOMO_ACCESS_KEY') ?? '';
        this.secretKey = this.configService.get<string>('MOMO_SECRET_KEY') ?? '';
        this.partnerCode = this.configService.get<string>('MOMO_PARTNER_CODE') ?? '';
        this.redirectUrl = this.configService.get<string>('MOMO_REDIRECT_URL') ?? '';
        this.ipnUrl = this.configService.get<string>('MOMO_IPN_URL') ?? '';
    }
    async createLinkPayment(amount: number, bookingId: string, session?: any, userEmail?: string) {
        this.logger.log(`Creating payment link for booking ID: ${bookingId} with amount: ${amount}`);
        var orderInfo = 'Payment for booking';
        var requestType = "payWithMethod";
        var orderId = bookingId
        var requestId = orderId;
        var extraData = '';
        var orderGroupId = '';
        var autoCapture = true;
        var lang = 'vi';


        var rawSignature = "accessKey=" + this.accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + this.ipnUrl + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&partnerCode=" + this.partnerCode + "&redirectUrl=" + this.redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;
        var signature = crypto.createHmac('sha256', this.secretKey)
            .update(rawSignature)
            .digest('hex');

        const requestBody = JSON.stringify({
            partnerCode: this.partnerCode,
            partnerName: "Test",
            storeId: "MomoTestStore",
            requestId: requestId,
            amount: amount,
            orderId: orderId,
            orderInfo: orderInfo,
            redirectUrl: this.redirectUrl,
            ipnUrl: this.ipnUrl,
            lang: lang,
            requestType: requestType,
            autoCapture: autoCapture,
            extraData: extraData,
            orderGroupId: orderGroupId,
            signature: signature
        });

        try {
            const result: any = await this.httpService.post('https://test-payment.momo.vn/v2/gateway/api/create',
                requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            }).pipe(map((res) => res.data))
                .toPromise();
            if (result) {
                const transaction = new this.transactionModel({
                    providerTransactionId: bookingId,
                    amount: amount,
                    status: TransactionStatus.PENDING,
                    method: PaymentMethod.MOMO,
                });
                await transaction.save({ session });
                if (userEmail) {
                    this.transactionsGateway.sendPaymentUrl(userEmail, {
                        bookingId,
                        payUrl: result.payUrl,
                    });
                }
            }

            return {
                ...result,
            };
        }
        catch (error) {
            this.logger.error('Error creating payment link:', error);
            throw new AppException({
                message: error.message || 'Failed to create payment link',
                statusCode: HttpStatus.BAD_REQUEST,
                errorCode: 'PAYMENT_LINK_CREATION_FAILED',
            });
        }
    }
    async handlePaymentCallback(req: any) {
        this.logger.log(`Received callback from MoMo: ${JSON.stringify(req.body)}`);
        const { orderId, resultCode, message } = req.body;


        const transaction = await this.transactionModel.findOne({ providerTransactionId: orderId });
        if (!transaction) {
            this.logger.warn(`Transaction not found: ${orderId}`);
            return;
        }

        transaction.status = resultCode === 0 ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
        await transaction.save();

        this.logger.log(`Transaction updated: ${transaction.id}`);

        if (resultCode === 0 && transaction.providerTransactionId) {
            await this.bookingModel.updateOne(
                { _id: transaction.providerTransactionId },
                { $set: { status: OccupancyStatus.CONFIRMED } }
            );
            this.logger.log(`Booking ${transaction.providerTransactionId} marked as SUCCESS`);
        }
        else {
            await this.bookingModel.updateOne(
                { _id: transaction.providerTransactionId },
                { $set: { status: OccupancyStatus.FAILED } }
            );
            this.logger.log(`Booking ${transaction.providerTransactionId} marked as FAILED`);
        }

        return {
            status: resultCode === 0 ? 'success' : 'failed',
            message: resultCode === 0 ? 'Payment successful' : `Payment failed: ${message}`,
            transactionId: transaction.id,
        };
    }

}


// Received callback from MoMo: {
//   partnerCode: 'MOMO',
//   orderId: 'BOOKING__c13au01rhg',
//   requestId: 'BOOKING__c13au01rhg',
//   amount: 6400000,
//   orderInfo: 'Payment for booking',
//   orderType: 'momo_wallet',
//   transId: 4556413176,
//   resultCode: 0,
//   message: 'Thành công.',
//   payType: 'qr',
//   responseTime: 1754186512898,
//   extraData: '',
//   signature: 'd8ca282d37f4a59387f73401584804dd9cfd141c396bafa6279404ed1f011e58'
// }