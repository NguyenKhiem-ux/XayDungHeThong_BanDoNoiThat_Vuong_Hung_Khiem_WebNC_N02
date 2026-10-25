import { Matches } from 'class-validator';

export class ConfirmDemoCardPaymentDto {
  @Matches(/^\d{6}$/)
  pin: string;
}
