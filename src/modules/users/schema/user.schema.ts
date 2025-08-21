import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Transform } from "class-transformer";
import { Document } from "mongoose";
import { UserRole } from "src/constants/user-role";

@Schema({
    collection: 'users',
    timestamps: true,
})
export class User {
    @Transform(({ value }) => value.toString())
    _id: string;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop({ required: true })
    firstName: string;

    @Prop({ required: true })
    lastName: string;

    @Prop({ required: true })
    phoneNumber: string;


    @Prop({ enum: UserRole, default: UserRole.USER })
    role: UserRole;

    @Prop({ default: false })
    isVerified: boolean;

    @Prop({})
    createdAt?: Date;

    @Prop({})
    updatedAt?: Date;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
