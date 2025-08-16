// src/chat/schemas/conversation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from 'src/constants/user-role';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {

    @Prop({ required: true, index: true })
    userEmail: string;

    @Prop({ required: true, index: true })
    adminEmail: string;

    @Prop({
        type: {
            text: { type: String },
            fromEmail: { type: String },
            at: { type: Date },
        },
        default: null,
    })
    lastMessage?: {
        text?: string;
        fromEmail?: string;
        at?: Date;
    };

    @Prop({ type: Number, default: 0 })
    unreadForAdmin: number;

    @Prop({ type: Number, default: 0 })
    unreadForUser: number;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ adminEmail: 1, 'lastMessage.at': -1, _id: -1 });
ConversationSchema.index({ userEmail: 1, adminEmail: 1 });
