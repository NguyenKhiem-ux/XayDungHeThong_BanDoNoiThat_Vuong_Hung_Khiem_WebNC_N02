import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/entities/product.entity';
import { ChatbotKnowledge } from '../database/entities/chatbot-knowledge.entity';
import { ChatProductsService } from './chat-products.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { IntentService } from './intent.service';
import { SmallTalkService } from './small-talk.service';
import { GeminiService } from './gemini.service';
import { CartModule } from '../cart/cart.module';
import { AddressesModule } from '../addresses/addresses.module';
import { ChatShoppingService } from './chat-shopping.service';
import { ChatUserActionsService } from './chat-user-actions.service';
import { OrdersModule } from '../orders/orders.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { CouponsModule } from '../coupon/coupons.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ChatbotKnowledge]), CartModule, AddressesModule, OrdersModule, FavoritesModule, CouponsModule],
  controllers: [ChatController, KnowledgeController],
  providers: [ChatService, ChatProductsService, KnowledgeService, IntentService, SmallTalkService, GeminiService, ChatShoppingService, ChatUserActionsService],
})
export class ChatModule {}
