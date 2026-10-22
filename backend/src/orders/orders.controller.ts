// file khai báo các api endpoint của chức năng orders và nhận request từ frontend.
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders/preview')
  preview(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.previewCheckout(user.id, dto, dto.quoteId);
  }

  @Post('orders')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  @Get('orders')
  list(@CurrentUser() user: AuthUser) {
    return this.orders.listForUser(user.id);
  }

  @Get('orders/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orders.getOneForUser(user.id, id);
  }

  @Get('admin/orders')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  adminList() {
    return this.orders.adminList();
  }

  @Patch('admin/orders/:id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  adminUpdateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.adminUpdateStatus(id, dto);
  }
}
