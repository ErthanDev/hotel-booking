import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) { }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createRoomDto: CreateRoomDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.roomsService.create(createRoomDto, file);
  }


  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.roomsService.update(id, updateRoomDto, file);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.roomsService.remove(id);
    return { message: 'Room deleted successfully' };
  }
}
