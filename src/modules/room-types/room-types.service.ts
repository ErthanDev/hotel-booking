import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { InjectModel } from '@nestjs/mongoose';
import { RoomType, RoomTypeDocument } from './schema/room-type.schema';
import { Model } from 'mongoose';
import { UploadService } from '../upload/upload.service';
import { UtilsService } from '../utils/utils.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class RoomTypesService {
  private readonly logger = new Logger(RoomTypesService.name);
  constructor(
    @InjectModel(RoomType.name)
    private readonly roomTypeModel: Model<RoomTypeDocument>,
    private uploadService: UploadService,
    private utilsService: UtilsService,
    private cacheService: CacheService,
  ) { }

  async create(createRoomTypeDto: CreateRoomTypeDto, file: Express.Multer.File): Promise<RoomType> {
    this.logger.log('Creating a new room type');
    try {
      let image = '';
      if (file) {
        const uploadResult = await this.uploadService.uploadFile(file, 'room-types');
        image = uploadResult.secure_url;
      }
      const roomType = new this.roomTypeModel({
        name: createRoomTypeDto.name,
        introduction: createRoomTypeDto.introduction,
        image: image,

      });
      await this.cacheService.invalidateRoomTypesCache();
      this.logger.log('Room type created successfully');
      return await roomType.save();
    } catch (error) {
      this.logger.error('Error creating room type', error.stack);
      throw error;
    }
  }

  async findAll(limit: number, page: number): Promise<RoomType[]> {
    this.logger.log(`Fetching all room types with limit: ${limit}, page: ${page}`);
    const cachedData = await this.cacheService.getListRoomTypesCache(limit, page);
    if (cachedData) {
      this.logger.debug('Returning cached room types');
      return cachedData;
    }
    const roomTypes = await this.roomTypeModel.find()
      .select('-__v -_id -createdAt -updatedAt')
      .lean()
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();
    await this.cacheService.setListRoomTypesCache(limit, page, roomTypes);
    this.logger.log('Room types retrieved successfully');
    return roomTypes;
  }

  async findOne(id: string): Promise<RoomType> {
    this.logger.log(`Fetching room type with ID: ${id}`);
    const cachedRoomType = await this.cacheService.getRoomTypeCacheById(id);
    if (cachedRoomType) {
      this.logger.debug('Returning cached room type');
      return cachedRoomType;
    }
    const roomType = await this.roomTypeModel.findById(id)
      .select('-__v -_id -createdAt -updatedAt')
      .lean()
      .exec();
    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${id} not found`);
    }
    await this.cacheService.setRoomTypeCacheById(id, roomType);
    this.logger.log('Room type retrieved successfully');
    return roomType;
  }

  async update(
    id: string,
    updateRoomTypeDto: UpdateRoomTypeDto,
    file: Express.Multer.File,
  ) {
    const transformDto = this.utilsService.removeEmptyValues(updateRoomTypeDto);

    const roomType = await this.roomTypeModel.findById(id).exec();

    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${id} not found`);
    }

    let image = roomType.image;
    if (file) {
      const uploadResult = await this.uploadService.uploadFile(file, 'room-types');
      image = uploadResult.secure_url;

      if (roomType.image && roomType.image !== image) {
        const parts = roomType.image.split('/');
        const publicId = parts.at(-1)?.split('.')?.[0];
        if (publicId) {
          await this.uploadService.deleteFile(publicId, 'room-types');
        }
      }
    }

    const updatedRoomType = await this.roomTypeModel.findByIdAndUpdate(
      id,
      { ...transformDto, image },
      { new: true, runValidators: true }
    )
    await this.cacheService.invalidateRoomTypeCacheById(id);
    await this.cacheService.invalidateRoomTypesCache();
    this.logger.log(`Room type with ID ${id} updated successfully`);
    return updatedRoomType;
  }


  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting room type with ID: ${id}`);
    const result = await this.roomTypeModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Room type with ID ${id} not found`);
    }
    await this.cacheService.invalidateRoomTypeCacheById(id);
    await this.cacheService.invalidateRoomTypesCache();
    this.logger.log(`Room type with ID ${id} removed successfully`);
  }
}
