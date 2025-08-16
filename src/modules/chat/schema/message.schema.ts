import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageStatus } from 'src/constants/message-status.enum';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
    conversationId: Types.ObjectId;

    @Prop({ required: true, index: true })
    fromEmail: string;

    @Prop({ required: true, index: true })
    toEmail: string;

    @Prop()
    text?: string;

    @Prop({
        type: [{ url: String, type: String, size: Number }],
        default: [],
    })
    attachments?: Array<{ url: string; type?: string; size?: number }>;

    @Prop({ enum: MessageStatus, default: MessageStatus.SENT, index: true })
    status: MessageStatus;

    @Prop({ default: Date.now })
    createdAt?: Date;
    @Prop()
    updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, _id: -1 });
MessageSchema.index({ conversationId: 1, toEmail: 1, status: 1 });
