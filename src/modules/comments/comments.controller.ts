import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ResponseMessage } from 'src/decorators/response-message.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) { }

  @Post()
  @ResponseMessage('Comment created successfully')
  async create(@Body() createCommentDto: CreateCommentDto) {
    return await this.commentsService.create(createCommentDto);
  }



  @Get('room/:roomId')
  @ResponseMessage('Comments fetched successfully')
  async findByRoomId(@Param('roomId') roomId: string, @Query('limit') limit: number = 10, @Query('page') page: number = 1) {
    return await this.commentsService.findByRoomId(roomId, limit, page);
  }


  @Patch(':id')
  @ResponseMessage('Comment updated successfully')
  async update(@Param('id') id: string, @Body() updateCommentDto: UpdateCommentDto) {
    return await this.commentsService.update(id, updateCommentDto);
  }

  @Delete(':id')
  @ResponseMessage('Comment deleted successfully')
  async remove(@Param('id') id: string) {
    await this.commentsService.remove(id);
  }
}
