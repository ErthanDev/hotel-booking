import { Controller, Get, Param, Query } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ListConversationsQueryDto } from "./dto/list-conversation-query.dto";
import { GetMessagesParamsDto, GetMessagesQueryDto } from "./dto/get-msg-params.dto";
import { Roles } from "src/decorators/roles.decorator";
import { UserRole } from "src/constants/user-role";

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {

    }

    @Get(':conversationId/messages')
    async getMessages(@Param() params: GetMessagesParamsDto,
        @Query() query: GetMessagesQueryDto) {
        return this.chatService.getMessages(params.conversationId, query);
    }

    @Get()
    @Roles(UserRole.ADMIN)
    async list(@Query() query: ListConversationsQueryDto) {
        return this.chatService.listConversationsForAdmin(query);
    }
}