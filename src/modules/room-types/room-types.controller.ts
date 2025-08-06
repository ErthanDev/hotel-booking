import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseMessage } from 'src/decorators/response-message.decorator';

@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) { }

  @Post()
  @ResponseMessage('Room type created successfully')
  @UseInterceptors(FileInterceptor('file'))
  create(@Body() createRoomTypeDto: CreateRoomTypeDto, @UploadedFile() file: Express.Multer.File) {

    return this.roomTypesService.create(createRoomTypeDto, file);
  }

  @Get()
  @ResponseMessage('Room types retrieved successfully')
  findAll(
    @Query('limit') limit: number = 10,
    @Query('page') page: number = 1
  ) {
    return this.roomTypesService.findAll(limit, page);
  }

  @Get(':id')
  @ResponseMessage('Room type retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.roomTypesService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage('Room type updated successfully')
  update(@Param('id') id: string, @Body() updateRoomTypeDto: UpdateRoomTypeDto, @UploadedFile() file: Express.Multer.File) {
    return this.roomTypesService.update(id, updateRoomTypeDto, file);
  }

  @Delete(':id')
  @ResponseMessage('Room type removed successfully')
  remove(@Param('id') id: string) {
    return this.roomTypesService.remove(id);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.roomTypesService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateRoomTypeDto: UpdateRoomTypeDto) {
  //   return this.roomTypesService.update(+id, updateRoomTypeDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.roomTypesService.remove(+id);
  // }
}
