import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatDto } from './dto/chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  send(@Body() dto: ChatDto, @CurrentUser() user?: AuthUser) {
    return this.chat.send(dto.message, dto.sessionId, user, dto);
  }
}
