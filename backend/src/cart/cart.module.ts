// file cấu hình module cart, gồm controller, service và các dependency liên quan.
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../database/entities/cart.entity';
import { CartItem } from '../database/entities/cart-item.entity';
import { Product } from '../database/entities/product.entity';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Product]), PromotionsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
