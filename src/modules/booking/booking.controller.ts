import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { User } from 'src/decorators/user-infor.decorator';
import type { IUser } from '../users/user.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Roles } from 'src/decorators/roles.decorator';
import { UserRole } from 'src/constants/user-role';
import { CreateBookingDtoByAdminDto } from './dto/create-booking-by-admin.dto';
import { Public } from 'src/decorators/public.decorator';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) { }

  @Post()
  @ResponseMessage('Booking created successfully')
  async create(@Body() createBookingDto: CreateBookingDto, @User() user: IUser) {
    return this.bookingService.createBooking(createBookingDto, user.email, user.phoneNumber);
  }

  @Get('get-available-rooms')
  @Public()
  @ResponseMessage('Available rooms retrieved successfully')
  async getAvailableRooms(
    @Query('checkInDate') checkInDate: string,
    @Query('checkOutDate') checkOutDate: string,
    @Query('maxPrice') maxPrice: number,
    @Query('numberOfGuests') numberOfGuests: number,
    @Query('roomType') roomType?: string,
    @Query('limit') limit: number = 10,
    @Query('page') page: number = 1
  ) {
    return this.bookingService.getAvailableRooms(checkInDate, checkOutDate, maxPrice, numberOfGuests, roomType, limit, page);
  }

  @Get('/:bookingId/payment-url')
  @ResponseMessage('Payment URL retrieved successfully')
  async getPaymentUrl(@Param('bookingId') bookingId: string) {
    return this.bookingService.getPaymentUrl(bookingId);
  }

  @Patch('cancel/:bookingId')
  @ResponseMessage('Booking cancelled successfully')
  async cancelBooking(@Param('bookingId') bookingId: string) {
    return this.bookingService.cancelBooking(bookingId);
  }

  @Post('create-booking-by-admin')
  @ResponseMessage('Booking created by admin successfully')
  @Roles(UserRole.ADMIN)
  async createBookingByAdmin(@Body() createBookingDto: CreateBookingDtoByAdminDto) {
    return this.bookingService.createBookingByAdmin(createBookingDto);
  }

  @Get('get-my-bookings')
  @ResponseMessage('User bookings retrieved successfully')
  async getMyBookings(@User() user: IUser) {
    return this.bookingService.getBookingsByUser(user.email);
  }
}
