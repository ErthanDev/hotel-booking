import { IsString, IsNotEmpty, IsNumber, Min, IsArray, IsOptional, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { RoomTypeName } from 'src/constants/room-type.enum';
import { console } from 'inspector';

export class CreateRoomDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(RoomTypeName)
    roomType: string;

    @Type(() => Number)
    @IsNumber()
    @Min(1)
    sizeRoom: number;    

    @IsString()
    @IsOptional()
    shortDescription?: string;

    @IsString()
    @IsOptional()
    fullDescription?: string;

    @IsArray()
    @IsString({ each: true })
    amenities: string[];

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    priceByDay: number;

    @IsString()
    @IsNotEmpty()
    beds: string;

    @Type(() => Number)
    @IsNumber()
    @Min(1)
    maxPeople: number;
}
