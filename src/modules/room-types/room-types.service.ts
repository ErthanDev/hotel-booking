import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { InjectModel } from '@nestjs/mongoose';
import { RoomType, RoomTypeDocument } from './schema/room-type.schema';
import { Model } from 'mongoose';
import { UploadService } from '../upload/upload.service';
import { UtilsService } from '../utils/utils.service';

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectModel(RoomType.name)
    private readonly roomTypeModel: Model<RoomTypeDocument>,
    private uploadService: UploadService,
    private utilsService: UtilsService
  ) { }

  async create(createRoomTypeDto: CreateRoomTypeDto, file: Express.Multer.File): Promise<RoomType> {
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
      return await roomType.save();
    } catch (error) {
      throw error;
    }
  }

  async findAll(): Promise<RoomType[]> {
    return await this.roomTypeModel.find().select('-__v -_id -createdAt -updatedAt')
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<RoomType> {
    const roomType = await this.roomTypeModel.findById(id)
      .select('-__v -_id -createdAt -updatedAt')
      .lean()
      .exec();
    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${id} not found`);
    }
    return roomType;
  }

  async update(
    id: string,
    updateRoomTypeDto: UpdateRoomTypeDto,
    file: Express.Multer.File,
  ) {
    const transformDto = this.utilsService.removeEmptyValues(updateRoomTypeDto);

    // Tìm phòng cần cập nhật
    const roomType = await this.roomTypeModel.findById(id).exec();

    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${id} not found`);
    }

    let image = roomType.image;
    if (file) {
      const uploadResult = await this.uploadService.uploadFile(file, 'room-types');
      image = uploadResult.secure_url;

      // Xoá ảnh cũ nếu có
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

    return updatedRoomType;
  }


  async remove(id: string): Promise<void> {
    const result = await this.roomTypeModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Room type with ID ${id} not found`);
    }
  }
}
