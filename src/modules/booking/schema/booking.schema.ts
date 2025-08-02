import { Schema } from "@nestjs/mongoose";

export type BookingDocument = Booking & Document;
@Schema({
    collection: 'bookings',
    timestamps: true,
})
export class Booking { 

    
}
