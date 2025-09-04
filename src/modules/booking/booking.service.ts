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
import { CreateBookingDtoByAdminDto } from './dto/create-booking-by-admin.dto';
import { stat } from 'fs';
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

  async createBooking(createBookingDto: CreateBookingDto, userEmail: string, phoneNumber: string) {

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

    this.logger.log(`Booking details: Room ID: ${roomId}, Check-in: ${checkIn}, Check-out: ${checkOut}, User Email: ${userEmail}, User Phone: ${createBookingDto.phoneNumber ? createBookingDto.phoneNumber : phoneNumber}`);
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
          userPhone: createBookingDto.phoneNumber ? createBookingDto.phoneNumber : phoneNumber,
          checkInDate: checkIn,
          checkOutDate: checkOut,
        });

        await booking.save();
        this.logger.log(`Booking created with ID: ${bookingId}`);
        this.logger.log(`Creating payment link for booking ID: ${bookingId} with amount: ${totalPrice}`);

        await this.cacheService.addToZaloPayQueue({
          bookingId,
          userEmail,
          userPhone: createBookingDto.phoneNumber ? createBookingDto.phoneNumber : phoneNumber,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          roomId,
          amount: totalPrice,
        });
        await this.cacheService.unlockRoom(roomId, checkIn, checkOut);
        this.logger.log(`Booking created successfully with ID: ${booking._id}`);
        await this.cacheService.invalidateMyBookingsCache(userEmail);
        const response = {
          roomId: room._id,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          totalPrice: booking.totalPrice,
          status: booking.status,
          bookingId: booking.bookingId,
          email: userEmail,
          phone: createBookingDto.phoneNumber ? createBookingDto.phoneNumber : phoneNumber,
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

  private parseDateUTC = (s?: string) => {
    if (!s) return undefined;
    const str = /[zZ]|[+\-]\d{2}:\d{2}/.test(s) ? s : `${s}T00:00:00Z`;
    const d = new Date(str);
    return isNaN(d.getTime()) ? undefined : d;
  };

  async getAvailableRooms(
    startDate?: string,
    endDate?: string,
    maxPrice?: number,
    numberOfGuests?: number,
    roomType?: string,
    limit = 10,
    page = 1,
  ) {
    const skip = (page - 1) * limit;

    const CHECKIN_UTC_HOUR = 3;
    const CHECKOUT_UTC_HOUR = 2;

    let start = this.parseDateUTC(startDate);
    let end = this.parseDateUTC(endDate);

    if (!start && !end) {
      const today = new Date();
      start = new Date(Date.UTC(
        today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(),
        CHECKIN_UTC_HOUR, 0, 0, 0
      ));
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      end.setUTCHours(CHECKOUT_UTC_HOUR, 0, 0, 0);
    } else if (start && !end) {
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
    } else if (!start && end) {
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 1);
    }

    start!.setUTCHours(CHECKIN_UTC_HOUR, 0, 0, 0);
    end!.setUTCHours(CHECKOUT_UTC_HOUR, 0, 0, 0);

    if (start! >= end!) {
      throw new AppException({
        message: 'Invalid date range',
        errorCode: 'INVALID_DATE_RANGE',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    this.logger.log(
      `Fetching available rooms from ${start!.toISOString()} (UTC) to ${end!.toISOString()} (UTC)` +
      ` with max price ${maxPrice ?? '—'} and guests ${numberOfGuests ?? '—'}`
    );

    const overlappingBookings = await this.bookingModel.find({
      status: { $in: [OccupancyStatus.CONFIRMED, OccupancyStatus.PENDING, OccupancyStatus.PAYMENT_URL] },
      checkInDate: { $lt: end!.toISOString() },
      checkOutDate: { $gt: start!.toISOString() },
    }).select('room');


    const unavailableRoomIds = overlappingBookings.map((b: any) => b.room);

    const roomQuery: any = { _id: { $nin: unavailableRoomIds } };
    if (maxPrice) roomQuery.priceByDay = { $lte: +maxPrice };
    if (numberOfGuests) roomQuery.maxPeople = { $gte: +numberOfGuests };
    if (roomType) roomQuery.roomType = roomType;
    this.logger.debug(`Room query: ${JSON.stringify(roomQuery)}`);
    return this.roomModel.find(roomQuery).skip(skip).limit(limit);
  }


  async cancelBooking(bookingId: string): Promise<void> {
    this.logger.log(`Cancelling booking with ID: ${bookingId}`);

    const booking = await this.bookingModel.findOne({ bookingId }).populate({
      path: 'room',
      select: 'roomType -_id',
    }) as any;
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
    await this.cacheService.sendMailNotification(NAME_QUEUE.SEND_MAIL_NOTI_BOOKING_CANCELLED, {
      to: booking.userEmail,
      bookingId: booking.bookingId,
      checkInDate: booking.checkInDate.toISOString(),
      checkOutDate: booking.checkOutDate.toISOString(),
      totalPrice: booking.totalPrice,
      email: booking.userEmail,
      phone: booking.userPhone,
      roomType: booking.room.roomType,
    });
    this.logger.log(`Booking with ID ${bookingId} cancelled successfully`);
  }

  async getPaymentUrl(bookingId: string) {
    this.logger.log(`Retrieving payment URL for booking ID: ${bookingId}`);
    const cachedBooking = await this.cacheService.getUrlPaymentByBookingId(bookingId);
    if (cachedBooking) {
      this.logger.debug(`Returning cached payment URL for booking ID ${bookingId}`);
      return cachedBooking;
    }

    const booking = await this.bookingModel.findOne({ bookingId, status: OccupancyStatus.PAYMENT_URL }).lean() as any;
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

    return {
      paymentUrl: booking.paymentUrl,
      status: booking.status,
      totalPrice: booking.totalPrice,
    }
  }


  async createBookingByAdmin(createBookingDto: CreateBookingDtoByAdminDto) {

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

    this.logger.log(`Booking details: Room ID: ${roomId}, Check-in: ${checkIn}, Check-out: ${checkOut}, User Email: ${createBookingDto.userEmail}, User Phone: ${createBookingDto.userPhone}`);
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
          userEmail: createBookingDto.userEmail,
          userPhone: createBookingDto.userPhone,
          checkInDate: checkIn,
          checkOutDate: checkOut,
        });

        await booking.save();
        this.logger.log(`Booking created with ID: ${bookingId}`);
        this.logger.log(`Creating transaction for booking ID: ${bookingId} with amount: ${totalPrice}`);
        await this.cacheService.createTransaction(bookingId, totalPrice, createBookingDto.method);

        await this.cacheService.unlockRoom(roomId, checkIn, checkOut);
        this.logger.log(`Booking created successfully with ID: ${booking._id}`);

        const response = {
          roomId: room._id,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          totalPrice: booking.totalPrice,
          status: booking.status,
          bookingId: booking.bookingId,
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

  async getBookingsByUser(userEmail: string, limit: number = 10, page: number = 1) {
    this.logger.log(`Fetching bookings for user: ${userEmail}, page: ${page}, limit: ${limit}`);
    const cachedBookings = await this.cacheService.getMyBookingsCache(userEmail, limit, page);
    if (cachedBookings) {
      this.logger.debug(`Returning cached bookings for user: ${userEmail}`);
      return cachedBookings;
    }
    const skip = (page - 1) * limit;
    const bookings = await this.bookingModel.find({ userEmail }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate({
      path: 'room',
      select: 'name price',
    }).select('-_id -__v  -note  -updatedAt -expiredAt -paymentUrl');

    await this.cacheService.setMyBookingsCache(userEmail, limit, page, bookings);
    this.logger.log(`Fetched ${bookings.length} bookings for user: ${userEmail}`);
    return bookings;
  }

  private getUtcRangeFromLocal(start?: string, end?: string) {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    const HOTEL_TZ = 'Asia/Ho_Chi_Minh';
    const isDateOnly = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const sLocal = start
      ? dayjs.tz(start, HOTEL_TZ)
      : dayjs().tz(HOTEL_TZ).startOf('month');

    const startUtc = sLocal.startOf('day').utc().toDate();
    let endUtc: Date;
    if (end) {
      endUtc = isDateOnly(end)
        ? dayjs.utc(end).endOf('day').toDate()
        : dayjs(end).utc().toDate();
    } else {
      endUtc = dayjs
        .utc(sLocal.endOf('month').format('YYYY-MM-DD'))
        .endOf('day')
        .toDate();
    }

    return { startUtc, endUtc };
  }

  async getListBookingByAdmin(start?: string, end?: string) {
    const { startUtc, endUtc } = this.getUtcRangeFromLocal(start, end);

    const filter: any = {
      status: { $in: [OccupancyStatus.CONFIRMED, OccupancyStatus.CHECKED_IN] },
      checkInDate: { $lt: endUtc },
      checkOutDate: { $gt: startUtc },
    };

    const bookings = await this.bookingModel
      .find(filter)
      .populate({ path: 'room', select: 'name roomType _id' })
      .sort({ checkInDate: 1 })
      .lean();

    const events: any[] = [];

    for (const b of bookings) {


      events.push({
        kind: 'stay',
        isCheckOut: false,
        bookingId: b.bookingId,
        status: b.status,
        room: b.room,
        userEmail: b.userEmail,
        userPhone: b.userPhone,
        totalPrice: b.totalPrice,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        numberOfGuests: b.numberOfGuests,
      });


      if (new Date(b.checkOutDate) >= startUtc && new Date(b.checkOutDate) < endUtc) {

        events.push({
          kind: 'checkout',
          isCheckOut: true,
          bookingId: b.bookingId,
          status: b.status,
          room: b.room,
          userEmail: b.userEmail,
          userPhone: b.userPhone,
          totalPrice: b.totalPrice,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          numberOfGuests: b.numberOfGuests,
        });
      }
    }

    return events;
  }

  async updateBookingStatus(bookingId: string, status: OccupancyStatus) {
    this.logger.log(`Updating booking status for ID: ${bookingId} to ${status}`);

    const booking = await this.bookingModel.findOne({ bookingId });
    if (!booking) {
      throw new AppException({
        message: `Booking with ID ${bookingId} not found`,
        errorCode: 'BOOKING_NOT_FOUND',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    booking.status = status;
    await booking.save();
    return {
      bookingId: booking.bookingId,
      status: booking.status,
    };
  }
}
