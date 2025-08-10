import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from './schema/conversation.schema';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schema/message.schema';
import { ConfigService } from '@nestjs/config';
import { AppException } from 'src/common/exception/app.exception';


@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private msgModel: Model<MessageDocument>,
    private readonly config: ConfigService,
  ) { }

  async getAdminEmail(): Promise<string> {
    const envEmail = this.config.get<string>('ADMIN_EMAIL');
    if (envEmail) return envEmail;

    // fallback: tìm user role ADMIN (tuỳ dự án bạn có UserModel thì inject để query)
    // throw new Error('ADMIN_EMAIL not configured'); // hoặc implement query UserModel
    return 'admin@hotel.local';
  }

  async getOrCreateConversation(userEmail: string) {
    const adminEmail = await this.getAdminEmail();
    let conv = await this.convModel.findOne({ userEmail, adminEmail });
    if (!conv) {
      conv = await this.convModel.create({ userEmail, adminEmail });
    }
    return conv;
  }

  async resolveConversationId(params: {
    requesterEmail: string;
    isAdmin: boolean;
    toUserEmail?: string;
    conversationId?: string;
  }): Promise<string> {
    if (params.conversationId) return params.conversationId;
    if (!params.isAdmin) {
      const conv = await this.getOrCreateConversation(params.requesterEmail);
      return (conv as any)._id.toString();
    }
    if (!params.toUserEmail) throw new AppException({
      message: 'toUserEmail is required for admin requests',
      errorCode: 'TO_USER_EMAIL_REQUIRED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
    const conv = await this.getOrCreateConversation(params.toUserEmail);
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

    // cập nhật lastMessage + unread
    const incs =
      args.isAdminSender ? { unreadForUser: 1, unreadForAdmin: 0 } : { unreadForAdmin: 1, unreadForUser: 0 };

    await this.convModel.updateOne(
      { _id: convId },
      {
        $set: { lastMessage: { text: args.text, fromEmail: args.senderEmail, at: new Date() } },
        $inc: incs,
      },
    );

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

    // reset unread theo phía người đọc
    await this.convModel.updateOne(
      { _id: convId },
      args.isAdminReader ? { $set: { unreadForAdmin: 0 } } : { $set: { unreadForUser: 0 } },
    );

    // optional: cập nhật status message -> read (chỉ các msg gửi tới reader)
    await this.msgModel.updateMany(
      {
        conversationId: conv._id,
        toEmail: args.readerEmail,
        status: { $ne: 'read' },
      },
      { $set: { status: 'read' } },
    );

    return conv;
  }

  async listConversationsForAdmin(
    { page = 1, limit = 20, q }: { page?: number; limit?: number; q?: string }
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const adminEmail = await this.getAdminEmail();
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
    return { items, total, page, limit };
  }

  async getMessages(
    conversationId: string,
    { cursor, limit = 30 }: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; nextCursor: string | null }> {
    const query: any = { conversationId: new Types.ObjectId(conversationId) };
    if (cursor) query._id = { $lt: new Types.ObjectId(cursor) }; // paginate lùi
    const items = await this.msgModel.find(query).sort({ _id: -1 }).limit(limit).lean();
    const nextCursor = items.length ? items[items.length - 1]._id.toString() : null;
    return { items: items.reverse(), nextCursor };
  }
}
