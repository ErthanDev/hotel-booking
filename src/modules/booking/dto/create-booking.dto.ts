// create-booking.dto.ts
import { IsMongoId, IsDateString, IsInt, Min, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TypeBooking } from 'src/constants/type-booking.enum';

export class CreateBookingDto {
    @IsNotEmpty()
    @IsMongoId()
    roomId: string;

    @IsNotEmpty()
    @IsDateString()
    checkInDate: string;

    @IsNotEmpty()
    @IsDateString()
    checkOutDate: string;

    @IsInt()
    @IsNotEmpty()
    @Min(1)
    numberOfGuests: number;


    @IsOptional()
    @IsString()
    note?: string;
}
