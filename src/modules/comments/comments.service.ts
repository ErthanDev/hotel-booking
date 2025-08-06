import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment, CommentDocument } from './schema/comment.schema';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
  ) { }

  async create(createCommentDto: CreateCommentDto) {
    this.logger.log('Creating a new comment');

    const createdComment = new this.commentModel(createCommentDto);
    const savedComment = await createdComment.save();

    return savedComment
  }



  async findByRoomId(roomId: string): Promise<Comment[]> {
    this.logger.log(`Fetching comments for room: ${roomId}`);

    if (!Types.ObjectId.isValid(roomId)) {
      throw new NotFoundException('Invalid room ID format');
    }

    return await this.commentModel
      .find({ room: roomId })
      .populate('room')
      .sort({ createdAt: -1 })
      .exec();
  }



  async update(id: string, updateCommentDto: UpdateCommentDto): Promise<Comment> {
    this.logger.log(`Updating comment with id: ${id}`);

    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const updatedComment = await this.commentModel
      .findByIdAndUpdate(id, updateCommentDto, { new: true })
      .populate('room')
      .exec();

    if (!updatedComment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    return updatedComment;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting comment with id: ${id}`);

    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const result = await this.commentModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
  }


}
