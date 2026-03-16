import { Module } from '@nestjs/common';
import { MetronomeGateway } from './websocket.gateway';
import { MetronomeService } from './metronome.service';

@Module({
  providers: [MetronomeGateway, MetronomeService],
  exports: [MetronomeService],
})
export class WebsocketModule {}
