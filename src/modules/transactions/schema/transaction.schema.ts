import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Booking } from '../../booking/schema/booking.schema';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
    WALLET = 'WALLET',
    ZALOPAY = 'ZALOPAY',
    MOMO = 'MOMO',
    VNPAY = 'VNPAY',
}

@Schema({ timestamps: true, collection: 'transactions' })
export class Transaction {


    @Prop({ required: true })
    amount: number;

    @Prop({ required: true, enum: PaymentMethod })
    method: PaymentMethod;

    @Prop({ enum: TransactionStatus, default: TransactionStatus.PENDING })
    status: TransactionStatus;

    @Prop({ type: String, required: true, unique: true })
    providerTransactionId?: string;

}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ providerTransactionId: 1 }, { unique: true });
TransactionSchema.index({ bookingId: 1 });
TransactionSchema.index({ status: 1 });      