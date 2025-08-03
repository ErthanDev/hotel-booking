import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Booking, BookingDocument } from './schema/booking.schema';
import { Connection, Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../rooms/schema/room.schema';
import { AppException } from 'src/common/exception/app.exception';
import { CacheService } from '../cache/cache.service';
import { TypeBooking } from 'src/constants/type-booking.enum';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
import { MomoPaymentService } from '../momo-payment/momo-payment.service';
import { UtilsService } from '../utils/utils.service';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    private readonly cacheService: CacheService,
    private readonly utilsService: UtilsService,
  ) { }

  async createBooking(createBookingDto: CreateBookingDto, userEmail: string, userPhone: string) {
    this.logger.log('Creating a new booking');
    const {
      roomId,
      checkInDate,
      checkOutDate,

    } = createBookingDto;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    this.logger.log(`Booking details: Room ID: ${roomId}, Check-in: ${checkIn}, Check-out: ${checkOut}, User Email: ${userEmail}, User Phone: ${userPhone}`);
    const locked = await this.cacheService.isRoomTimeLocked(roomId, checkIn, checkOut);
    if (locked) {
      throw new AppException({
        message: 'Room is already booked for the selected time by lock',
        errorCode: 'ROOM_ALREADY_BOOKED',
        statusCode: HttpStatus.CONFLICT,
      });
    }

    await this.cacheService.lockRoom(roomId, checkIn, checkOut);

    const room = await this.roomModel.findById(roomId);
    if (!room) throw new AppException({
      message: `Room with ID ${roomId} not found`,
      errorCode: 'ROOM_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });



    try {
      const available = await this.isRoomAvailable(roomId, checkIn, checkOut);
      if (!available) {
        throw new AppException({
          message: 'Room already booked for this time range',
          errorCode: 'ROOM_ALREADY_BOOKED',
          statusCode: HttpStatus.CONFLICT,
        });
      }
      const totalPrice = await this.calculateTotalPrice(roomId, checkIn, checkOut, createBookingDto.numberOfGuests, createBookingDto.typeBooking || TypeBooking.DAILY);
      const bookingId = 'booking__'+ this.utilsService.generateRandom(10, false);
      const booking = new this.bookingModel({
        room: roomId,
        bookingId,
        typeBooking: createBookingDto.typeBooking || TypeBooking.DAILY,
        numberOfGuests: createBookingDto.numberOfGuests,
        totalPrice,
        note: createBookingDto.note,
        userEmail,
        userPhone,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      });

      await booking.save();
      this.logger.log(`Booking created with ID: ${bookingId}`);
      this.logger.log(`Creating payment link for booking ID: ${bookingId} with amount: ${totalPrice}`);


      await this.cacheService.addToMomoPaymentQueue({
        bookingId,
        userEmail,
        amount: totalPrice,
      });
      // Unlock the room after booking
      await this.cacheService.unlockRoom(roomId, checkIn, checkOut);
      this.logger.log(`Booking created successfully with ID: ${booking._id}`);

      const response = {
        roomId: room._id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalPrice: booking.totalPrice,
        status: booking.status,
      };

      return response;
    } catch (err) {
      this.logger.error(`Error creating booking: ${err.message}`, err.stack);
      await this.cacheService.unlockRoom(roomId, checkIn, checkOut); // rollback lock
      throw err;
    }
  }

  async isRoomAvailable(roomId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
    const overlap = await this.bookingModel.findOne({
      room: roomId,
      status: { $in: [OccupancyStatus.PENDING, OccupancyStatus.CONFIRMED] },
      $or: [
        {
          checkInDate: { $lt: checkOut },
          checkOutDate: { $gt: checkIn },
        },
      ],
    });

    return !overlap;
  }

  async calculateTotalPrice(roomId: string, checkIn: Date, checkOut: Date, numberOfGuests: number, typeBooking: TypeBooking): Promise<number> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new AppException({
      message: `Room with ID ${roomId} not found`,
      errorCode: 'ROOM_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
    if (typeBooking === TypeBooking.HOURLY) {
      const hours = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
      return room.priceByHour * hours * numberOfGuests;
    }
    const basePrice = room.priceByDay;
    const duration = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24); // in days
    const roundedDuration = Math.ceil(duration);
    return basePrice * roundedDuration * numberOfGuests;
  }
}
