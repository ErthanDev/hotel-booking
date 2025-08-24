import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Room, RoomDocument } from './schema/room.schema';
import { Model } from 'mongoose';
import { UploadService } from '../upload/upload.service';
import { UtilsService } from '../utils/utils.service';
import { CacheService } from '../cache/cache.service';
import { AppException } from 'src/common/exception/app.exception';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  constructor(
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    private uploadService: UploadService,
    private utilsService: UtilsService,
    private cacheService: CacheService

  ) { }
  async create(createRoomDto: CreateRoomDto, files?: Express.Multer.File[]): Promise<Room> {
    this.logger.log('Creating a new room ');
    let imageUrls: string[] = [];

    if (files) {
      const uploadResult = await this.uploadService.uploadFilesAtomic(files, 'rooms');
      imageUrls = uploadResult.map(result => result.secure_url);
    }

    const room = new this.roomModel({
      ...createRoomDto,
      image: imageUrls,
    });
    this.logger.log(`End of room creation process`);
    await this.cacheService.invalidateRoomsCache();
    return room.save();
  }



  async findOne(id: string): Promise<Room> {
    this.logger.log(`Fetching room with ID ${id}`);
    const cachedRoom = await this.cacheService.getRoomDetailCacheById(id);
    if (cachedRoom) {
      this.logger.debug(`Returning cached room with ID ${id}`);
      return cachedRoom;
    }
    const room = await this.roomModel.findById(id).lean().exec();
    if (!room) {
      throw new Error(`Room with ID ${id} not found`);
    }
    await this.cacheService.setRoomDetailCacheById(id, room);
    return room;
  }

  async update(id: string, updateRoomDto: UpdateRoomDto, file?: Express.Multer.File): Promise<Room> {
    this.logger.log(`Updating room with ID ${id}`);
    const room = await this.findOne(id);
    const transformDto = this.utilsService.removeEmptyValues(updateRoomDto);
    let imageUrls = room.image || [];

    if (file) {
      if (room.image && room.image.length > 0) {
        for (const imageUrl of room.image) {
          const publicId = this.extractPublicIdFromUrl(imageUrl);
          if (publicId) {
            await this.uploadService.deleteFile(publicId, 'rooms');
          }
        }
      }

      const uploadResult = await this.uploadService.uploadFile(file, 'rooms');
      imageUrls = [uploadResult.secure_url];
    }

    const updatedRoom = await this.roomModel.findByIdAndUpdate(
      id,
      { ...transformDto, image: imageUrls },
      { new: true }
    ).exec();

    if (!updatedRoom) {
      throw new Error(`Room with ID ${id} not found`);
    }
    await this.cacheService.invalidateRoomDetailCacheById(id);
    this.logger.log(`Room with ID ${id} updated successfully`);
    await this.cacheService.invalidateRoomsCache();
    return updatedRoom;
  }

  async remove(id: string): Promise<void> {
    const room = await this.findOne(id);

    if (room.image && room.image.length > 0) {
      for (const imageUrl of room.image) {
        const publicId = this.extractPublicIdFromUrl(imageUrl);
        if (publicId) {
          await this.uploadService.deleteFile(publicId, 'rooms');
        }
      }
    }

    const result = await this.roomModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error(`Room with ID ${id} not found`);
    }
    await this.cacheService.invalidateRoomDetailCacheById(id);

  }

  async findByRoomType(roomType: string): Promise<Room[]> {
    return this.roomModel.find({ roomType }).exec();
  }


  private extractPublicIdFromUrl(url: string): string | null {
    try {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      const publicId = filename.split('.')[0];
      return publicId;
    } catch (error) {
      return null;
    }
  }

  async findAll(limit: number, page: number) {
    this.logger.log(`Fetching all rooms with limit ${limit} and page ${page}`);
    const cachedRooms = await this.cacheService.getListRoomsCache(limit, page);
    if (cachedRooms) {
      this.logger.debug(`Returning cached rooms for limit ${limit} and page ${page}`);
      return cachedRooms;
    }
    const rooms = await this.roomModel.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();
    const res = rooms.map(room => {
      return {
        roomId: room._id,
        roomType: room.roomType,
        priceByDay: room.priceByDay,
        images: room.image,
        name: room.name,
        sizeRoom: room.sizeRoom,
        maxPeople: room.maxPeople,
        shortDescription: room.shortDescription,
        fullDescription: room.fullDescription,
        amenities: room.amenities,
        beds: room.beds,
      }
    })
    await this.cacheService.setListRoomsCache(limit, page, res);
    this.logger.log(`Fetched ${res.length} rooms successfully`);
    return res;
  }
}
