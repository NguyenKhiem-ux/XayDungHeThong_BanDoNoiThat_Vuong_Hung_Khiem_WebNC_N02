import { Body, Controller, HttpException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ChatThrottle } from '../common/throttle';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatDto } from './dto/chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  @ChatThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  async send(@Body() dto: ChatDto, @Req() request: Request, @Res() response: Response, @CurrentUser() user?: AuthUser) {
    if (!request.accepts('text/event-stream') || !request.headers.accept?.includes('text/event-stream')) {
      return response.status(201).json(await this.chat.send(dto.message, dto.sessionId, user, dto));
    }
    response.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    const controller = new AbortController();
    const disconnect = () => controller.abort();
    response.on('close', disconnect);
    const emit = (event: unknown) => {
      if (!response.destroyed && !response.writableEnded) response.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      const reply = await this.chat.send(dto.message, dto.sessionId, user, dto, {
        onDelta: text => emit({ type: 'delta', text }), signal: controller.signal,
      });
      emit({ type: 'result', reply });
    } catch (error) {
      const detail = error instanceof HttpException ? error.getResponse() : null;
      const message = typeof detail === 'string' ? detail : (detail as { message?: string | string[] } | null)?.message;
      emit({ type: 'error', message: message ?? 'Không thể xử lý câu hỏi lúc này. Vui lòng thử lại sau.' });
    } finally {
      response.off('close', disconnect);
      response.end();
    }
  }
}
