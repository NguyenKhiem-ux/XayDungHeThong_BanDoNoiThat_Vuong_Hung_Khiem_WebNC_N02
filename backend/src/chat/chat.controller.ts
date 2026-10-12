import { Body, Controller, Post } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  send(@Body() dto: ChatDto) {
    return this.chat.send(dto.message, dto.sessionId);
  }
}
