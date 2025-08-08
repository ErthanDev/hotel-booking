import { IsEmail, IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { UserRole } from 'src/constants/user-role';

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @IsOptional()
    @IsString()
    address?: string;

}
