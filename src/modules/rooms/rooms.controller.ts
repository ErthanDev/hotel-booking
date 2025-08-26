import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query, UploadedFiles } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { UserRole } from 'src/constants/user-role';
import { Public } from 'src/decorators/public.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) { }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  @ResponseMessage('Room created successfully')
  async create(
    @Body() createRoomDto: CreateRoomDto,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.roomsService.create(createRoomDto, files);
  }


  @Get(':id')
  @ResponseMessage('Fetched a room successfully')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  @Roles(UserRole.ADMIN)
  @ResponseMessage('Updated a room successfully')

  async update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.roomsService.update(id, updateRoomDto, file);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ResponseMessage('Deleted a room successfully')

  async remove(@Param('id') id: string) {
    await this.roomsService.remove(id);
    return { message: 'Room deleted successfully' };
  }



  @Get()
  @Public()
  @ResponseMessage('Fetched rooms successfully')
  async findAll(@Query('limit') limit: number = 10, @Query('page') page: number = 1) {
    return this.roomsService.findAll(limit, page);
  }
}
