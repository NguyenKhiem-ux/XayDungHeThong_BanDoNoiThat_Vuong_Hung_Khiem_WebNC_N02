import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SavePromotionDto } from './promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}
  @Get('current') @Header('Cache-Control', 'no-store') current() { return this.promotions.current(); }
  @Get('admin') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN') list() { return this.promotions.list(); }
  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN') create(@Body() dto: SavePromotionDto) { return this.promotions.save(dto); }
  @Patch(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN') update(@Param('id', ParseIntPipe) id: number, @Body() dto: SavePromotionDto) { return this.promotions.save(dto, id); }
}
