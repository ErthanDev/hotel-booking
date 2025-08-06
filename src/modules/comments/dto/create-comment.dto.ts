import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

export class CreateCommentDto {

    @IsNotEmpty()
    @IsMongoId()
    room: Types.ObjectId;


    @IsNotEmpty()
    @IsString()
    userEmail: string;


    @IsNotEmpty()
    @IsString()
    content: string;
}
