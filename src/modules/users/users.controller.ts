import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { UserRole } from 'src/constants/user-role';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { User } from 'src/decorators/user-infor.decorator';
import type { IUser } from './user.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(UserRole.ADMIN)
  @ResponseMessage('User created successfully')
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ResponseMessage('Users retrieved successfully')
  async findAll(@Query() queryUserDto: QueryUserDto) {
    return this.usersService.findAll(queryUserDto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ResponseMessage('User retrieved successfully')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

 

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ResponseMessage('User deleted successfully')
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch('update-my-info')
  @ResponseMessage('User information updated successfully')
  async updateMyInfo(@Body() updateUserDto: UpdateUserDto, @User() user: IUser) {
    return this.usersService.updateUser(user._id, updateUserDto);
  }
}