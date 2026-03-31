import { Module } from '@nestjs/common';
import { MetronomeGateway } from './websocket.gateway';
import { MetronomeService } from './metronome.service';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [RoomModule],
  providers: [MetronomeGateway, MetronomeService],
  exports: [MetronomeService],
})
export class WebsocketModule {}
