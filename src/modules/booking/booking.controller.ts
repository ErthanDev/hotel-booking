import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { User } from 'src/decorators/user-infor.decorator';
import type { IUser } from '../users/user.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) { }

  @Post()
  @ResponseMessage('Booking created successfully')
  async create(@Body() createBookingDto: CreateBookingDto, @User() user: IUser) {
    return this.bookingService.createBooking(createBookingDto, user.email, user.phoneNumber);
  }
}
