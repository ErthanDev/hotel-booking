import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { OutboxStatus } from "src/constants/outbox-status.enum";


@Schema({
    collection: 'outbox',
    timestamps: true,
})
export class Outbox {
    @Prop({ required: true }) type: string;
    @Prop({ required: true, type: Object }) payload: any;
    @Prop({ enum: OutboxStatus, default: OutboxStatus.NEW }) status: OutboxStatus;
}

export const OutboxSchema = SchemaFactory.createForClass(Outbox);
export type OutboxDocument = Outbox & Document;