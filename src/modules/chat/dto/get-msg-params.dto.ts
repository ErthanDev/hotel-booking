import { Type } from "class-transformer";
import { IsInt, IsMongoId, IsOptional, Max, Min } from "class-validator";

export class GetMessagesParamsDto {
    @IsMongoId()
    conversationId!: string;
}

export class GetMessagesQueryDto {
    @IsOptional()
    @IsMongoId({ message: 'cursor must be a valid ObjectId (24 hex).' })
    cursor?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit: number = 30;
}