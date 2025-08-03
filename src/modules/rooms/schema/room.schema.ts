import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
import { RoomTypeName } from 'src/constants/room-type.enum';

export type RoomDocument = Room & Document;

@Schema({
    collection: 'rooms',
    timestamps: true,
})
export class Room {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true, type: String, enum: RoomTypeName })
    roomType: string;

    @Prop({ required: true, min: 1 })
    sizeRoom: number;

    @Prop({ type: String })
    description: string;

    @Prop({ type: [String], default: [] })
    amenities: string[];

    @Prop({ required: true, min: 0 })
    priceByDay: number;

    @Prop({ required: true, min: 0 })
    priceByHour: number;

    @Prop({ type: String, required: true })
    image: string;

    @Prop({ type: Boolean, default: false })
    isCheckIn: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
