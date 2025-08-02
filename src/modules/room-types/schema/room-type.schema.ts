import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RoomTypeName } from 'src/constants/room-type.enum';

export type RoomTypeDocument = RoomType & Document;

@Schema({
    timestamps: true,
    collection: 'room_types',
})
export class RoomType {
    @Prop({ type: "string", required: true, enum: RoomTypeName })
    name: string;

    @Prop({ type: String, required: true })
    introduction: string;

    @Prop({ type: Number, required: true })
    sizeRoom: number;

    @Prop({ type: String, required: true })
    beds: string;

    @Prop({ type: Number, required: true })
    maxPeople: number;

    @Prop({ type: String, required: true })
    image: string;

}

export const RoomTypeSchema = SchemaFactory.createForClass(RoomType);
