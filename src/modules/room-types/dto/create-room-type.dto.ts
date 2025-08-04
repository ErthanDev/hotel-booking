import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { RoomTypeName } from 'src/constants/room-type.enum';

export class CreateRoomTypeDto {
    @IsNotEmpty()
    @IsEnum(RoomTypeName)
    name: RoomTypeName;

    @IsNotEmpty()
    @IsString()
    introduction: string;




}
