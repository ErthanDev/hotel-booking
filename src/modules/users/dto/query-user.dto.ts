import { IsOptional, IsString, IsEnum, IsBoolean, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from 'src/constants/user-role';

export class QueryUserDto {

    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    @Min(1)
    limit?: number = 10;
    
    @IsOptional()
    @IsString()
    q?: string;

    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc' = 'desc';
}
