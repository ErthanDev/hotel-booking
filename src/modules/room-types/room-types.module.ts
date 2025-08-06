import { Module } from '@nestjs/common';
import { RoomTypesService } from './room-types.service';
import { RoomTypesController } from './room-types.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomType, RoomTypeSchema } from './schema/room-type.schema';
import { UploadModule } from '../upload/upload.module';
import { UtilsModule } from '../utils/utils.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoomType.name, schema: RoomTypeSchema }
    ]),
    UploadModule,
    UtilsModule,
    CacheModule
  ],
  controllers: [RoomTypesController],
  providers: [RoomTypesService],
})
export class RoomTypesModule { }
