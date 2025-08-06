import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Document } from "mongoose";

@Schema({ timestamps: true, collection: 'comments' })
export class Comment {

    @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
    room: Types.ObjectId;

    @Prop({
        required: true,
    })
    userEmail: string

    @Prop({
        required: true,
    })
    content: string;

    @Prop({ default: Date.now })
    createdAt?: Date;

    @Prop({ default: Date.now })
    updatedAt?: Date;
}

export type CommentDocument = Comment & Document;
export const CommentSchema = SchemaFactory.createForClass(Comment);