// file là module gốc của backend và kết nối các module chức năng của hệ thống.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
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
})
export class AppModule {}
