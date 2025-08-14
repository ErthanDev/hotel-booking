// create-booking.dto.ts
import { IsMongoId, IsDateString, IsInt, Min, IsEnum, IsNotEmpty, IsOptional, IsString, IsEmail } from 'class-validator';
import { TypeBooking } from 'src/constants/type-booking.enum';
import { PaymentMethod } from 'src/modules/transactions/schema/transaction.schema';

export class CreateBookingDtoByAdminDto {
    @IsNotEmpty()
    @IsMongoId()
    roomId: string;

    @IsNotEmpty()
    @IsEmail()
    userEmail: string;

    @IsNotEmpty()
    @IsString()
    userPhone: string;

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

    @IsNotEmpty()
    @IsEnum(PaymentMethod)
    method: PaymentMethod;
}
