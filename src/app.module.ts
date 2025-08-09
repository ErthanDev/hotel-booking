import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsModule } from './modules/rooms/rooms.module';
import { RoomTypesModule } from './modules/room-types/room-types.module';
import { BookingModule } from './modules/booking/booking.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { UtilsModule } from './modules/utils/utils.module';
import { CacheModule } from './modules/cache/cache.module';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from './modules/mail/mail.module';
import { OtpProcessor } from './proccessor/otp.processor';
import { TransactionProcessor } from './proccessor/transactions.processor';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingCron } from './cron/booking-cron';
import { CommentsModule } from './modules/comments/comments.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { TelegramCron } from './cron/telegram-cron';
import { ZalopayModule } from './modules/zalopay/zalopay.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          reconnectOnError: (_) => true,
          retryStrategy: (times) => {
            if (times > 4) {
              return 200;
            }
            return Math.min(times * 50, 200);
          },
        },
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    RoomsModule,
    RoomTypesModule,
    BookingModule,
    TransactionsModule,
    UsersModule,
    AuthModule,
    UploadModule,
    UtilsModule,
    CacheModule,
    MailModule,
    CommentsModule,
    TelegramModule,
    ZalopayModule,
  ],
  controllers: [AppController],
  providers: [AppService, OtpProcessor, TransactionProcessor, BookingCron, TelegramCron],
})
export class AppModule { }
