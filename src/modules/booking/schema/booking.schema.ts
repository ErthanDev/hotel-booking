import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
import { TypeBooking } from 'src/constants/type-booking.enum';

export type BookingDocument = Booking & Document;

@Schema({
    collection: 'bookings',
    timestamps: true,
})
export class Booking {
    @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
    room: Types.ObjectId;

    @Prop({ type: String, required: true })
    bookingId: string;

    @Prop({ type: String, required: true })
    userEmail: string;

    @Prop({ type: String, required: true })
    userPhone: string;

    @Prop({ type: Date, required: true })
    checkInDate: Date;

    @Prop({ type: Date, required: true })
    checkOutDate: Date;

    @Prop({ type: Number, required: true, min: 1 })
    numberOfGuests: number;

    @Prop({ type: Number, required: true, min: 0 })
    totalPrice: number;

    @Prop({ type: String, required: true, enum: TypeBooking })
    typeBooking: string;

    @Prop({
        type: String,
        enum: OccupancyStatus,
        default: OccupancyStatus.PENDING,
    })
    status: OccupancyStatus;

    @Prop({ type: String })
    note?: string;

    @Prop({
        type: Date,
        default: () => new Date(Date.now() + 10 * 60 * 1000),
    })
    expiredAt?: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
