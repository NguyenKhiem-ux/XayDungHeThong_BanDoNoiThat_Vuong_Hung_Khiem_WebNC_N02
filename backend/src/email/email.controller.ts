import { Body, Controller, Post } from '@nestjs/common';
import { EmailTestThrottle } from '../common/throttle';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  @EmailTestThrottle()
  async sendTestEmail(
    @Body('email') email: string,
  ) {
    return this.emailService.sendTestEmail(email);
  }
}