import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from './schema/conversation.schema';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schema/message.schema';
import { ConfigService } from '@nestjs/config';
import { AppException } from 'src/common/exception/app.exception';
import { CacheService } from '../cache/cache.service';


@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private msgModel: Model<MessageDocument>,
    private readonly config: ConfigService,
    private readonly cacheService: CacheService,
  ) { }

  async getAdminEmail(): Promise<string> {
    const envEmail = this.config.get<string>('ADMIN_EMAIL');
    if (envEmail) return envEmail;

    return 'infinitystay.contact@gmail.com';
  }

  async getOrCreateConversation(userEmail: string): Promise<any> {
    const adminEmail = await this.getAdminEmail();
    const now = new Date();
    const conv = await this.convModel.findOneAndUpdate(
      { userEmail, adminEmail },
      {
        $setOnInsert: {
          userEmail,
          adminEmail,
          unreadForAdmin: 0,
          unreadForUser: 0,
          lastMessage: { text: '', fromEmail: '', at: now }
        },
        $set: { updatedAt: now },
      },
      { upsert: true, new: true, lean: true }
    );
    return conv;
  }

  private ensureAccessOrThrow(conv: ConversationDocument | any, requesterEmail: string, isAdmin: boolean, adminEmail: string) {
    if (!conv) {
      throw new AppException({
        message: 'Conversation not found',
        errorCode: 'CONVERSATION_NOT_FOUND',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    if (isAdmin) {
      if (conv.adminEmail !== adminEmail) {
        throw new AppException({
          message: 'Forbidden',
          errorCode: 'FORBIDDEN',
          statusCode: HttpStatus.FORBIDDEN,
        });
      }
    } else {
      if (conv.userEmail !== requesterEmail || conv.adminEmail !== adminEmail) {
        throw new AppException({
          message: 'Forbidden',
          errorCode: 'FORBIDDEN',
          statusCode: HttpStatus.FORBIDDEN,
        });
      }
    }
  }

  async resolveConversationId(params: {
    requesterEmail: string;
    isAdmin: boolean;
    toUserEmail?: string;
    conversationId?: string;
  }): Promise<string> {
    const adminEmail = await this.getAdminEmail();

    if (params.conversationId) {
      const conv = await this.convModel.findById(params.conversationId).lean();
      this.ensureAccessOrThrow(conv as any, params.requesterEmail, params.isAdmin, adminEmail);
      return (conv as any)._id.toString();
    }

    if (!params.isAdmin) {
      const conv = await this.getOrCreateConversation(params.requesterEmail);
      return (conv as any)._id.toString();
    }

    if (!params.toUserEmail) {
      throw new AppException({
        message: 'toUserEmail is required for admin requests',
        errorCode: 'TO_USER_EMAIL_REQUIRED',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }
    const conv = await this.getOrCreateConversation(params.toUserEmail);
    this.ensureAccessOrThrow(conv as any, params.requesterEmail, params.isAdmin, adminEmail);
    return (conv as any)._id.toString();
  }

  async sendMessage(args: {
    senderEmail: string;
    text: string;
    isAdminSender: boolean;
    toUserEmail?: string;
    conversationId?: string;
  }) {
    const adminEmail = await this.getAdminEmail();
    const convId = await this.resolveConversationId({
      requesterEmail: args.senderEmail,
      isAdmin: args.isAdminSender,
      toUserEmail: args.toUserEmail,
      conversationId: args.conversationId,
    });

    const conv = await this.convModel.findById(convId);
    if (!conv) throw new AppException({
      message: 'Conversation not found',
      errorCode: 'CONVERSATION_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });

    const toEmail = args.isAdminSender ? conv.userEmail : adminEmail;

    const msg = await this.msgModel.create({
      conversationId: new Types.ObjectId(convId),
      fromEmail: args.senderEmail,
      toEmail,
      text: args.text,
      status: 'sent',
    });

    const incs =
      args.isAdminSender ? { unreadForUser: 1, unreadForAdmin: 0 } : { unreadForAdmin: 1, unreadForUser: 0 };

    await this.convModel.updateOne(
      { _id: convId },
      {
        $set: { lastMessage: { text: args.text, fromEmail: args.senderEmail, at: new Date() } },
        $inc: incs,
      },
    );
    await Promise.all([
      this.cacheService.incrUnread(convId, args.isAdminSender ? 'user' : 'admin', 1),
      this.cacheService.invalidateAdminConvListCache(adminEmail),
      this.cacheService.invalidateLatestMsgsCache(convId),
    ]);
    return msg;
  }

  async markRead(args: {
    readerEmail: string;
    isAdminReader: boolean;
    conversationId?: string;
    toUserEmail?: string;
  }) {
    const convId = await this.resolveConversationId({
      requesterEmail: args.readerEmail,
      isAdmin: args.isAdminReader,
      toUserEmail: args.toUserEmail,
      conversationId: args.conversationId,
    });

    const conv = await this.convModel.findById(convId);
    if (!conv) throw new AppException({
      message: 'Conversation not found',
      errorCode: 'CONVERSATION_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });

    await this.convModel.updateOne(
      { _id: convId },
      args.isAdminReader ? { $set: { unreadForAdmin: 0 } } : { $set: { unreadForUser: 0 } },
    );

    await this.msgModel.updateMany(
      {
        conversationId: conv._id,
        toEmail: args.readerEmail,
        status: { $ne: 'read' },
      },
      { $set: { status: 'read' } },
    );
    const adminEmail = await this.getAdminEmail();
    await Promise.all([
      this.cacheService.resetUnread(convId, args.isAdminReader ? 'admin' : 'user'),
      this.cacheService.invalidateAdminConvListCache(adminEmail),
    ]);
    return conv;
  }

  async listConversationsForAdmin(
    { page = 1, limit = 20, q }: { page?: number; limit?: number; q?: string }
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    this.logger.log(`Listing conversations for admin with query: ${JSON.stringify({ page, limit, q })}`);
    const adminEmail = await this.getAdminEmail();
    const cached = await this.cacheService.getAdminConvListCache(adminEmail, q, page, limit);
    if (cached) return cached;
    this.logger.log(`Fetching conversations from database for admin: ${adminEmail}`);
    const filter: any = { adminEmail };
    if (q) filter.userEmail = { $regex: q, $options: 'i' };
    const [items, total] = await Promise.all([
      this.convModel
        .find(filter)
        .sort({ 'lastMessage.at': -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.convModel.countDocuments(filter),
    ]);
    const res = { items, total, page, limit }
    await this.cacheService.setAdminConvListCache(adminEmail, q, page, limit, res);
    return res;
  }

  async getMessages(
    conversationId: string,
    { cursor, limit = 30 }: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; nextCursor: string | null }> {
    this.logger.log(`Getting messages for conversationId: ${conversationId}, cursor: ${cursor}, limit: ${limit}`);
    if (!cursor) {
      const cached = await this.cacheService.getLatestMsgsCache(conversationId, limit);
      if (cached) return cached;
    }
    this.logger.log(`Fetching messages from database for conversationId: ${conversationId}`);
    const query: any = { conversationId: new Types.ObjectId(conversationId) };
    if (cursor) query._id = { $lt: new Types.ObjectId(cursor) };
    const items = await this.msgModel.find(query).sort({ _id: -1 }).limit(limit).lean();
    const nextCursor = items.length ? items[items.length - 1]._id.toString() : null;
    const payload = { items: items.reverse(), nextCursor };
    if (!cursor) {
      await this.cacheService.setLatestMsgsCache(conversationId, limit, payload);
    }
    return payload;
  }
}
