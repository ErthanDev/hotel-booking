import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class MarkReadDto {
    @IsNotEmpty()
    @IsString()
    conversationId: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    messageIds?: string[]; // optional: đánh dấu 1 dải; hoặc chỉ cần conversationId để clear
}
