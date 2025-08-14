import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Booking, BookingDocument } from './schema/booking.schema';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../rooms/schema/room.schema';
import { AppException } from 'src/common/exception/app.exception';
import { CacheService } from '../cache/cache.service';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
import { UtilsService } from '../utils/utils.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { NAME_QUEUE } from 'src/constants/name-queue.enum';
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
    if (checkInDate === checkOutDate || checkOutDate < checkInDate) {
      throw new AppException({
        message: 'Invalid booking dates',
        errorCode: 'INVALID_DATES',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }
    const checkIn = new Date(checkInDate);
    checkIn.setUTCHours(3, 0, 0, 0);

    const checkOut = new Date(checkOutDate);
    checkOut.setUTCHours(2, 0, 0, 0);

    this.logger.log(`Booking details: Room ID: ${roomId}, Check-in: ${checkIn}, Check-out: ${checkOut}, User Email: ${userEmail}, User Phone: ${userPhone}`);
    let room: any = null
    const cạchedRoom = await this.cacheService.getRoomDetailCacheById(roomId);
    if (cạchedRoom) {
      this.logger.debug(`Returning cached room with ID ${roomId}`);
      room = cạchedRoom;
    }
    else {
      room = await this.roomModel.findById(roomId).lean().exec();
      if (room) {
        await this.cacheService.setRoomDetailCacheById(roomId, room);
      }
    }
    if (!room) throw new AppException({
      message: `Room with ID ${roomId} not found`,
      errorCode: 'ROOM_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
    const mutexKey = `room_mutex:${roomId}`;

    try {
      return await this.cacheService.withMutex(mutexKey, async () => {
        const available = await this.isRoomAvailable(roomId, checkIn, checkOut);
        if (!available) {
          throw new AppException({
            message: 'Room already booked for this time range',
            errorCode: 'ROOM_ALREADY_BOOKED',
            statusCode: HttpStatus.CONFLICT,
          });
        }
        const totalPrice = await this.calculateTotalPrice(roomId, checkIn, checkOut);
        const bookingId = 'booking__' + this.utilsService.generateRandom(10, false);
        const booking = new this.bookingModel({
          room: roomId,
          bookingId,
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

        await this.cacheService.addToZaloPayQueue({
          bookingId,
          userEmail,
          userPhone,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          roomId,
          amount: totalPrice,
        });
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
      }, { ttlMs: 15000, maxWaitMs: 2000 });
    } catch (err) {
      this.logger.error(`Error creating booking: ${err.message}`, err.stack);
      if (err?.message === 'ROOM_BUSY') {
        throw new AppException({
          message: 'Room is being processed, please try again shortly',
          errorCode: 'ROOM_BUSY',
          statusCode: HttpStatus.CONFLICT,
        });
      }
      throw err;
    }
  }

  async isRoomAvailable(roomId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
    const checkInDate = new Date(checkIn);
    checkInDate.setUTCHours(3, 0, 0, 0);

    const checkOutDate = new Date(checkOut);
    checkOutDate.setUTCHours(2, 0, 0, 0);
    const overlap = await this.bookingModel.findOne({
      room: roomId,
      status: { $in: [OccupancyStatus.PENDING, OccupancyStatus.CONFIRMED, OccupancyStatus.PAYMENT_URL, OccupancyStatus.CHECKED_IN] },
      $or: [
        {
          checkInDate: { $lt: checkOutDate },
          checkOutDate: { $gt: checkInDate },
        },
      ],
    });

    return !overlap;
  }

  async calculateTotalPrice(roomId: string, checkIn: Date, checkOut: Date): Promise<number> {
    let room: any = null
    const cạchedRoom = await this.cacheService.getRoomDetailCacheById(roomId);
    if (cạchedRoom) {
      this.logger.debug(`Returning cached room with ID ${roomId}`);
      room = cạchedRoom;
    }
    else {
      room = await this.roomModel.findById(roomId).lean().exec();
      if (room) {
        await this.cacheService.setRoomDetailCacheById(roomId, room);
      }
    }
    if (!room) throw new AppException({
      message: `Room with ID ${roomId} not found`,
      errorCode: 'ROOM_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });

    const basePrice = room.priceByDay;
    const duration = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);
    const roundedDuration = Math.ceil(duration);
    return basePrice * roundedDuration;
  }

  async getAvailableRooms(
    startDate: string,
    endDate: string,
    maxPrice?: number,
    numberOfGuests?: number,
    roomType?: string,
    limit: number = 10,
    page: number = 1,
  ) {
    const skip = (page - 1) * limit;
    const start = new Date(startDate);
    start.setUTCHours(3, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(2, 0, 0, 0);
    const overlappingBookings = await this.bookingModel.find({
      status: { $in: [OccupancyStatus.CONFIRMED, OccupancyStatus.PENDING] },
      $or: [
        { checkin: { $lt: end }, checkout: { $gt: start } },
      ],
    }).select('roomId');

    const unavailableRoomIds = overlappingBookings.map((b: any) => b.roomId);

    const availableRooms = await this.roomModel.find({
      _id: { $nin: unavailableRoomIds },
      price: { $lte: maxPrice },
      capacity: { $gte: numberOfGuests },
      ...(roomType ? { roomType } : {}),
    })
      .skip(skip)
      .limit(limit)

    return availableRooms;

  }


  async cancelBooking(bookingId: string): Promise<void> {
    this.logger.log(`Cancelling booking with ID: ${bookingId}`);

    const booking = await this.bookingModel.findOne({ bookingId });
    if (!booking) {
      throw new AppException({
        message: `Booking with ID ${bookingId} not found`,
        errorCode: 'BOOKING_NOT_FOUND',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (booking.status === OccupancyStatus.CANCELED) {
      this.logger.warn(`Booking ID ${bookingId} is already canceled`);
      return;
    }

    const now = new Date();
    const twoDaysLater = new Date(now);
    twoDaysLater.setDate(now.getDate() + 2);

    if (booking.checkInDate <= twoDaysLater) {
      throw new AppException({
        message: `Cannot cancel booking less than 2 days before check-in.`,
        errorCode: 'CANCEL_TOO_LATE',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    booking.status = OccupancyStatus.CANCELED;
    await booking.save();
    this.cacheService.cancelTransaction(booking.bookingId);
    this.logger.log(`Booking with ID ${bookingId} cancelled successfully`);
  }

  async getPaymentUrl(bookingId: string) {
    this.logger.log(`Retrieving payment URL for booking ID: ${bookingId}`);
    const cachedBooking = await this.cacheService.getUrlPaymentByBookingId(bookingId);
    if (cachedBooking) {
      this.logger.debug(`Returning cached payment URL for booking ID ${bookingId}`);
      return cachedBooking;
    }

    const booking = await this.bookingModel.findOne({ bookingId, status: OccupancyStatus.PAYMENT_URL }).populate({ path: 'room', select: 'roomType -_id' }).lean() as any;
    if (!booking) {
      throw new AppException({
        message: `Booking with ID ${bookingId} not found`,
        errorCode: 'BOOKING_NOT_FOUND',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    await this.cacheService.setUrlPaymentByBookingId(bookingId, {
      paymentUrl: booking.paymentUrl,
      status: booking.status,
      totalPrice: booking.totalPrice,
    });
    await this.cacheService.sendMailNotification(NAME_QUEUE.SEND_MAIL_NOTI_BOOKING_CANCELLED, {
      to: booking.userEmail,
      bookingId: booking.bookingId,
      checkInDate: booking.checkInDate.toISOString(),
      checkOutDate: booking.checkOutDate.toISOString(),
      totalPrice: booking.totalPrice,
      email: booking.userEmail,
      phone: booking.userPhone,
      roomType: booking.room.roomType,
    })

    return {
      paymentUrl: booking.paymentUrl,
      status: booking.status,
      totalPrice: booking.totalPrice,
    }
  }

  private toVNDateAtHour(dateInput: string | Date, hour: number): Date {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.extend(customParseFormat);

    const VN_TZ = 'Asia/Ho_Chi_Minh';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dayjs.tz(`${dateInput} ${hour}:00`, 'YYYY-MM-DD HH:mm', VN_TZ)
        .second(0).millisecond(0)
        .toDate(); // -> Date UTC tương ứng
    }

    const asVN = dayjs(dateInput).tz(VN_TZ);
    const ymd = asVN.format('YYYY-MM-DD');
    return dayjs.tz(`${ymd} ${hour}:00`, 'YYYY-MM-DD HH:mm', VN_TZ)
      .second(0).millisecond(0)
      .toDate();
  }

}
