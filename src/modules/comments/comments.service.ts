import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment, CommentDocument } from './schema/comment.schema';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly cacheService: CacheService,
  ) { }

  async create(createCommentDto: CreateCommentDto) {
    this.logger.log('Creating a new comment');

    const createdComment = new this.commentModel(createCommentDto);
    const savedComment = await createdComment.save();
    await this.cacheService.invalidateCommentsCache(savedComment.room.toString());
    return savedComment;
  }



  async findByRoomId(roomId: string, limit: number, page: number): Promise<Comment[]> {
    this.logger.log(`Fetching comments for room: ${roomId}`);

    if (!Types.ObjectId.isValid(roomId)) {
      throw new NotFoundException('Invalid room ID format');
    }

    const cachedData = await this.cacheService.getListCommentsCache(roomId, limit, page);
    if (cachedData) {
      this.logger.log(`Returning cached comments for room: ${roomId}`);
      return cachedData;
    }
    this.logger.log(`Fetching comments from database for room: ${roomId}`);
    const skip = (page - 1) * limit;
    const comments = await this.commentModel
      .find({ room: roomId })
      .populate('room')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit).lean()
      .exec();
    await this.cacheService.setListCommentsCache(roomId, limit, page, comments);
    return comments
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
    await this.cacheService.invalidateCommentsCache(updatedComment.room.toString());

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
    await this.cacheService.invalidateCommentsCache(result.room.toString());

  }


}
