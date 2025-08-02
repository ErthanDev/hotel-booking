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

    

    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()

    beds: number;

    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    maxPeople: number;

}
