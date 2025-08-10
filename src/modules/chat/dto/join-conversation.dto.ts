import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class StartChatDto {
    @IsEmail() email: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    displayName?: string;
}