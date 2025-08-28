import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schema/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UtilsService } from '../utils/utils.service';

@Injectable()
export class UsersService {

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly utilsService: UtilsService,
  ) { }

  async create(createUserDto: CreateUserDto) {
    try {
      const existingUser = await this.userModel.findOne({ email: createUserDto.email });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

      const createdUser = new this.userModel({
        ...createUserDto,
        password: hashedPassword,
      });

      const savedUser = await createdUser.save();

      const { password, ...userWithoutPassword } = savedUser.toObject();
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user');
    }
  }

  async findAll(query: QueryUserDto){
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const baseMatch: any = {};
  

    const pipeline: any[] = [{ $match: baseMatch }];

    if (query.q?.trim()) {
      const q = query.q.trim();
      const regex = new RegExp(q, 'i');
      pipeline.push({
        $match: {
          $or: [
            { email: regex },
            { phoneNumber: regex },
            { firstName: regex },
            { lastName: regex },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ['$firstName', ' ', '$lastName'] },
                  regex: q,
                  options: 'i',
                },
              },
            },
          ],
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'bookings',
          let: { email: '$email' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userEmail', '$$email'] } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                total: { $sum: '$totalPrice' },
              },
            },
          ],
          as: 'bookingStats',
        },
      },
      {
        $addFields: {
          bookingsCount: { $ifNull: [{ $arrayElemAt: ['$bookingStats.count', 0] }, 0] },
          totalSpent: { $ifNull: [{ $arrayElemAt: ['$bookingStats.total', 0] }, 0] },
        },
      },
      {
        $project: {
          _id: 1,
          name: { $concat: ['$firstName', ' ', '$lastName'] },
          contactPhone: '$phoneNumber',
          isVerified: 1,
          bookingsCount: 1,
          totalSpent: 1,
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
    );

    const items = await this.userModel.aggregate(pipeline).exec();
    return items;
  }

  async findOne(id: string): Promise<User> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }



  async remove(id: string): Promise<{ message: string }> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User deleted successfully' };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const tranformJson = this.utilsService.removeEmptyValues(updateUserDto);
    const user = await this.userModel.findByIdAndUpdate(id, tranformJson, { new: true });
    return user;
  }
}
