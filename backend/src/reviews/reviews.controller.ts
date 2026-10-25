import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ListReviewsDto, SaveReviewDto } from './review.dto';
import { ReviewsService } from './reviews.service';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get() list(@Param('productId', ParseIntPipe) productId: number, @Query() query: ListReviewsDto) { return this.reviews.list(productId, query); }
  @Get('mine') @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser, @Param('productId', ParseIntPipe) productId: number) { return this.reviews.mine(user.id, productId); }
  @Put() @UseGuards(JwtAuthGuard)
  save(@CurrentUser() user: AuthUser, @Param('productId', ParseIntPipe) productId: number, @Body() dto: SaveReviewDto) { return this.reviews.save(user.id, productId, dto); }
}
