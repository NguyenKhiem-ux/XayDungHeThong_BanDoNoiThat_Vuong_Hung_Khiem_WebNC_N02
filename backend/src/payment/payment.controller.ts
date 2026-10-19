// file khai báo các endpoint thanh toán PayOS cho frontend và webhook.
import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { type Webhook } from '@payos/node';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { PaymentService } from './payment.service';
import { ConfirmDemoCardPaymentDto } from './dto/confirm-demo-card-payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  @Post('payos/create-link/:orderId')
  @UseGuards(JwtAuthGuard)
  createPayOSLink(@CurrentUser() user: AuthUser, @Param('orderId', ParseIntPipe) orderId: number) {
    return this.payment.createPayOSLink(user.id, orderId);
  }

  @Post('card/confirm/:orderId')
  @UseGuards(JwtAuthGuard)
  confirmDemoCardPayment(@CurrentUser() user: AuthUser, @Param('orderId', ParseIntPipe) orderId: number, @Body() dto: ConfirmDemoCardPaymentDto) {
    return this.payment.confirmDemoCardPayment(user.id, orderId, dto.pin);
  }

  @Post('payos/webhook')
  handlePayOSWebhook(@Body() body: Webhook) {
    return this.payment.handlePayOSWebhook(body);
  }
}
