import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { RoomTypeName } from "src/constants/room-type.enum";


export class UpdateRoomTypeDto {
    @IsOptional()
    @IsEnum(RoomTypeName)
    name: RoomTypeName;

    @IsOptional()
    @IsString()
    introduction: string;




}
