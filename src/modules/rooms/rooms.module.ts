import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './schema/room.schema';
import { UploadModule } from '../upload/upload.module';
import { UtilsModule } from '../utils/utils.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema }
    ]),
    UploadModule,
    UtilsModule,
    CacheModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule { }
