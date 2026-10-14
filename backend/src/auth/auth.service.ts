// file chứa logic xử lý nghiệp vụ của chức năng auth và làm việc với database khi cần.
import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { Cart } from '../database/entities/cart.entity';
import { UserRole } from '../database/entities/enums';
import { User } from '../database/entities/user.entity';
import { PasswordResetToken } from '../database/entities/password-reset-token.entity';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(PasswordResetToken) private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const emailExists = await this.users.exists({ where: { email: dto.email } });
    const usernameExists = await this.users.exists({ where: { username: dto.username } });
    if (emailExists) throw new ConflictException('Email đã được sử dụng');
    if (usernameExists) throw new ConflictException('Tên đăng nhập đã được sử dụng');

    const user = this.users.create({
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10),
      phone: dto.phone ?? null,
      role: UserRole.USER,
    });
    const saved = await this.users.save(user);
    await this.carts.save(this.carts.create({ userId: saved.id }));
    return this.loginUser(saved);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({
      where: [{ email: dto.usernameOrEmail }, { username: dto.usernameOrEmail }],
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    return this.loginUser(user);
  }

  async getProfile(userId: number) {
    const user = await this.users.findOneByOrFail({ id: userId });
    return this.publicUser(user);
  }

  async updateProfile(userId: number, data: { fullName?: string; phone?: string | null; birthDate?: string | null; address?: string | null; gender?: string }) {
    const user = await this.users.findOneByOrFail({ id: userId });
    if (data.fullName !== undefined) user.fullName = data.fullName.trim();
    if (data.phone !== undefined) user.phone = data.phone?.trim() || null;
    if (data.birthDate !== undefined) user.birthDate = data.birthDate || null;
    if (data.address !== undefined) user.address = data.address?.trim() || null;
    if (data.gender !== undefined) user.gender = data.gender;
    return this.publicUser(await this.users.save(user));
  }

  async updateAvatar(userId: number, avatarUrl: string) {
    const user = await this.users.findOneByOrFail({ id: userId });
    user.avatarUrl = avatarUrl;
    return this.publicUser(await this.users.save(user));
  }

  async forgotPassword(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new NotFoundException('Email này chưa được đăng ký');

    await this.resetTokens.update({ userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
    const otp = randomInt(100000, 1000000).toString();
    const token = await this.resetTokens.save(this.resetTokens.create({
      userId: user.id,
      otpHash: await bcrypt.hash(otp, 10),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verifiedAt: null,
      usedAt: null,
    }));

    try {
      await this.emailService.sendPasswordResetOtp(user.email, otp);
    } catch (error) {
      await this.resetTokens.delete(token.id);
      throw error;
    }
    return {
      message: 'Mã OTP đã được gửi đến email của bạn.',
      expiresAt: token.expiresAt.toISOString(),
    };
  }

  async verifyResetOtp(rawEmail: string, otp: string) {
    const { token } = await this.getValidResetToken(rawEmail, otp);
    token.verifiedAt = new Date();
    await this.resetTokens.save(token);
    return { message: 'Xác thực OTP thành công.' };
  }

  async resetPassword(rawEmail: string, otp: string, newPassword: string) {
    const { user, token } = await this.getValidResetToken(rawEmail, otp);
    if (!token.verifiedAt) throw new BadRequestException('OTP chưa được xác thực');

    await this.resetTokens.manager.transaction(async (manager) => {
      user.password = await bcrypt.hash(newPassword, 10);
      await manager.save(user);
      await manager.update(PasswordResetToken, { userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
    });
    return { message: 'Đổi mật khẩu thành công.' };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string, confirmPassword: string) {
    if (newPassword !== confirmPassword) throw new BadRequestException('Mật khẩu nhập lại không khớp');

    const user = await this.users.findOneByOrFail({ id: userId });
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
    return { message: 'Đổi mật khẩu thành công.' };
  }

  private async getValidResetToken(rawEmail: string, otp: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new BadRequestException('Email hoặc OTP không hợp lệ');

    const token = await this.resetTokens.findOne({
      where: { userId: user.id, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!token || token.expiresAt.getTime() <= Date.now() || !(await bcrypt.compare(otp, token.otpHash))) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }
    return { user, token };
  }

  private loginUser(user: User) {
    const payload = { sub: user.id, username: user.username, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: this.publicUser(user),
    };
  }

  publicUser(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      birthDate: user.birthDate,
      address: user.address,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      role: user.role,
    };
  }
}
