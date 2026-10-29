import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null = null;

  private getResend() {
    if (this.resend) return this.resend;
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Chức năng email chưa được cấu hình trên máy chủ.',
      );
    }

    this.resend = new Resend(apiKey);
    return this.resend;
  }

  async sendTestEmail(to: string) {
    const resend = this.getResend();
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.MAIL_FROM || 'onboarding@resend.dev',
        to,
        subject: 'Test email - Gia Dụng Shop',
        html: `
          <h2>Xin chào </h2>
          <p>Đây là email test từ <strong>Gia Dụng Shop</strong>.</p>
          <p>Resend đã kết nối thành công với NestJS!</p>
        `,
      });

      if (error) {
        console.error('Resend error:', error);
        throw new InternalServerErrorException(
          'Không thể gửi email',
        );
      }

      return {
        success: true,
        message: 'Email đã được gửi',
        data,
      };
    } catch (error) {
      console.error('Send email error:', error);

      throw new InternalServerErrorException(
        'Có lỗi xảy ra khi gửi email',
      );
    }
  }

  async sendPasswordResetOtp(to: string, otp: string) {
    const resend = this.getResend();
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM || 'onboarding@resend.dev',
      to,
      subject: 'Mã OTP đặt lại mật khẩu - Gia Dụng Shop',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;color:#333">
        <h2 style="color:#0d5c4a">Gia Dụng Shop</h2>

        <p>Xin chào,</p>

        <p>
          Bạn vừa yêu cầu đặt lại mật khẩu. Mã xác nhận của bạn là:
        </p>

        <div style="
          font-size:30px;
          font-weight:bold;
          letter-spacing:8px;
          text-align:center;
          padding:15px;
          margin:20px 0;
          background:#f3f7f6;
          color:#0d5c4a;
        ">
          ${otp}
        </div>

        <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>

        <p>
          Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
        </p>

        <p style="color:#888;font-size:13px">
          © 2026 Gia Dụng Shop
        </p>
      </div>
      `,
    });

    if (error) {
      console.error('Resend password reset error:', error);
      throw new InternalServerErrorException('Không thể gửi email OTP');
    }

    return data;
  }
}
