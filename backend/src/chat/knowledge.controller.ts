import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { KnowledgeStatus } from '../database/entities/chatbot-knowledge.entity';
import { ChatService } from './chat.service';
import { CreateKnowledgeDto, ListKnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';
import { KnowledgeService } from './knowledge.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user.type';

@Controller('admin/chatbot')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService, private readonly chat: ChatService) {}

  @Get('stats')
  stats() { return this.chat.stats(); }

  @Get('knowledge')
  list(@Query() query: ListKnowledgeDto) { return this.knowledge.list(query); }

  @Get('knowledge/:id')
  detail(@Param('id', ParseIntPipe) id: number) { return this.knowledge.detail(id); }

  @Post('knowledge')
  create(@Body() dto: CreateKnowledgeDto) { return this.knowledge.create(dto); }

  @Patch('knowledge/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateKnowledgeDto) { return this.knowledge.update(id, dto); }

  @Patch('knowledge/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) { return this.knowledge.moderate(id, KnowledgeStatus.APPROVED, user.id); }

  @Patch('knowledge/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) { return this.knowledge.moderate(id, KnowledgeStatus.REJECTED, user.id); }

  @Delete('knowledge/:id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.knowledge.remove(id); }
}
