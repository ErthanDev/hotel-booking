import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Booking, BookingDocument } from './schema/booking.schema';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../rooms/schema/room.schema';
import { AppException } from 'src/common/exception/app.exception';
import { CacheService } from '../cache/cache.service';
import { OccupancyStatus } from 'src/constants/occupancy-status.enum';
import { UtilsService } from '../utils/utils.service';
import { Outbox, OutboxDocument } from '../outbox/schema/outbox.schema';
import { OutboxStatus } from 'src/constants/outbox-status.enum';

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
    @InjectModel(Outbox.name) private readonly outboxModel: Model<OutboxDocument>,
    @InjectConnection() private readonly connection: Connection,
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
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();


    const room = await this.roomModel.findById(roomId).session(session);
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
      const totalPrice = await this.calculateTotalPrice(roomId, checkIn, checkOut, createBookingDto.numberOfGuests);
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

      await booking.save({ session });
      this.logger.log(`Booking created with ID: ${bookingId}`);
      await this.outboxModel.create([
        {
          type: 'BookingCreated',
          payload: { bookingId: booking.bookingId, amount: booking.totalPrice, userEmail, userPhone },
          status: OutboxStatus.NEW,
        },
      ], { session });
      // Unlock the room after booking
      await session.commitTransaction();
      await this.cacheService.unlockRoom(roomId, checkIn, checkOut);
      this.logger.log(`Booking created successfully with ID: ${booking._id}`);

      const response = {
        bookingId: booking.bookingId,
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

  async calculateTotalPrice(roomId: string, checkIn: Date, checkOut: Date, numberOfGuests: number): Promise<number> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new AppException({
      message: `Room with ID ${roomId} not found`,
      errorCode: 'ROOM_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });

    const basePrice = room.priceByDay;
    const duration = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24); // in days
    const roundedDuration = Math.ceil(duration);
    return basePrice * roundedDuration * numberOfGuests;
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
    const end = new Date(endDate);
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

  async getPaymentView(id: string) {
    const booking = await this.bookingModel.findOne({ bookingId: id }).lean();
    if (!booking) throw new AppException({
      message: `Booking with ID ${id} not found`,
      errorCode: 'BOOKING_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
    return { status: booking.status, payUrl: booking.payUrl };
  }

  async markPayUrlReady(bookingId: string, payUrl: string) {
    return this.bookingModel.findOneAndUpdate(
      { bookingId },
      { $set: { status: OccupancyStatus.PAYURL_READY, payUrl }, $inc: { version: 1 } },
      { new: true },
    );
  }

  async markPaid(bookingId: string) {
    return this.bookingModel.findOneAndUpdate(
      { bookingId },
      { $set: { status: OccupancyStatus.CONFIRMED }, $inc: { version: 1 } },
      { new: true },
    );
  }

  async markFailed(bookingId: string) {
    return this.bookingModel.findOneAndUpdate(
      { bookingId },
      { $set: { status: OccupancyStatus.FAILED }, $inc: { version: 1 } },
      { new: true },
    );
  }

}
