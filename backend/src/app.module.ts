// file là module gốc của backend và kết nối các module chức năng của hệ thống.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DEFAULT_THROTTLE, THROTTLE_MESSAGE } from './common/throttle';
import { join } from 'path';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { ContactModule } from './contact/contact.module';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { CouponsModule } from './coupon/coupons.module';
import { EmailModule } from './email/email.module';
import { PaymentModule } from './payment/payment.module';
import { AddressesModule } from './addresses/addresses.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ChatModule } from './chat/chat.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({ rootPath: join(process.cwd(), 'uploads'), serveRoot: '/uploads' }),
    // shortcut: bộ đếm nằm trong RAM; cần storage dùng chung (Redis) khi chạy nhiều instance backend.
    ThrottlerModule.forRoot({ throttlers: [DEFAULT_THROTTLE], errorMessage: THROTTLE_MESSAGE }),
    DatabaseModule,
    PromotionsModule,
    ReviewsModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    ContactModule,
    AdminModule,
    CouponsModule,
    EmailModule,
    PaymentModule,
    AddressesModule,
    FavoritesModule,
    ChatModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
