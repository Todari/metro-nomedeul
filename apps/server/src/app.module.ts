import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RoomModule } from './room/room.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RoomModule,
    WebsocketModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
