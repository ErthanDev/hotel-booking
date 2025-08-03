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
    @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
    bookingId: Types.ObjectId;

    @Prop({ required: true })
    amount: number;

    @Prop({ required: true, enum: PaymentMethod })
    method: PaymentMethod;

    @Prop({ enum: TransactionStatus, default: TransactionStatus.PENDING })
    status: TransactionStatus;

    @Prop()
    providerTransactionId?: string;

}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
