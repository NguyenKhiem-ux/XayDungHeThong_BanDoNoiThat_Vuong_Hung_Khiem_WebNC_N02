import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { Promotion, PromotionItem } from '../database/entities/promotion.entity';
import { SavePromotionDto } from './promotion.dto';
import { promotionPhase, salePrice } from './promotion-price';
import { reviewSummaries } from '../reviews/reviews.service';

@Injectable()
export class PromotionsService {
  constructor(private readonly dataSource: DataSource) {}

  async lock(manager: EntityManager, write = false) {
    // A permanent singleton also serializes publication when the event table is empty.
    await manager.query(`SELECT id FROM promotion_lock WHERE id = 1 ${write ? 'FOR UPDATE' : 'LOCK IN SHARE MODE'}`);
  }

  async active(manager = this.dataSource.manager) {
    return this.activeQuery(manager).leftJoinAndSelect('event.items', 'item').leftJoinAndSelect('item.product', 'product').getOne();
  }

  // Chỉ lấy id sự kiện đang chạy, dùng khi cần ghép giá khuyến mãi vào câu SQL (lọc/sắp xếp theo giá).
  async activeId(manager = this.dataSource.manager) {
    return (await this.activeQuery(manager).select('event.id', 'id').getRawOne<{ id: number }>())?.id ?? null;
  }

  private activeQuery(manager: EntityManager) {
    return manager.getRepository(Promotion).createQueryBuilder('event')
      .where('event.status = :status', { status: 'published' })
      .andWhere('event.startsAt <= :now AND event.endsAt > :now', { now: new Date() });
  }

  async prices(products: Array<Pick<Product, 'id' | 'price'>>, manager = this.dataSource.manager) {
    const event = products.length ? await this.active(manager) : null;
    const discounts = new Map(event?.items.map(item => [Number(item.productId), item.discountPercent]));
    return new Map(products.map(product => {
      const originalPrice = Number(product.price);
      const discountPercent = discounts.get(Number(product.id)) ?? 0;
      const price = discountPercent ? salePrice(originalPrice, discountPercent) : originalPrice;
      return [Number(product.id), { originalPrice, price, discountPercent, savings: originalPrice - price,
        promotionId: discountPercent ? event!.id : null, promotionTitle: discountPercent ? event!.title : null,
        saleEndsAt: discountPercent ? event!.endsAt.toISOString() : null }];
    }));
  }

  async current() {
    const event = await this.active();
    return { serverTime: new Date().toISOString(), event: event ? await this.serialize(event, true) : null };
  }

  async list() {
    const events = await this.dataSource.getRepository(Promotion).find({ relations: ['items', 'items.product'], order: { id: 'DESC' } });
    return { serverTime: new Date().toISOString(), events: await Promise.all(events.map(event => this.serialize(event))) };
  }

  async save(dto: SavePromotionDto, id?: number) {
    const startsAt = new Date(dto.startsAt), endsAt = new Date(dto.endsAt);
    // Match MySQL DATETIME precision so adjacent schedules share the same boundary.
    startsAt.setMilliseconds(0); endsAt.setMilliseconds(0);
    if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(dto.startsAt) || !/[zZ]|[+-]\d{2}:\d{2}$/.test(dto.endsAt)) throw new BadRequestException('Thời gian cần kèm múi giờ.');
    if (!dto.title.trim() || !Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || startsAt >= endsAt) throw new BadRequestException('Tên và khoảng thời gian sự kiện chưa hợp lệ.');
    if (dto.status === 'published' && (!dto.items.length || endsAt <= new Date())) throw new BadRequestException('Sự kiện công bố cần có sản phẩm và thời gian kết thúc trong tương lai.');
    if (dto.status === 'published' && dto.bannerDiscountPercent && dto.bannerDiscountPercent > Math.max(0, ...dto.items.map(item => item.discountPercent))) throw new BadRequestException('Mức giảm trên banner không được vượt mức giảm lớn nhất của sản phẩm tham gia.');
    return this.dataSource.transaction(async manager => {
      await this.lock(manager, true);
      const repo = manager.getRepository(Promotion);
      const existing = id !== undefined ? await repo.findOneBy({ id }) : null;
      if (id !== undefined && !existing) throw new NotFoundException('Không tìm thấy sự kiện.');
      if (dto.status === 'published') {
        const conflict = await repo.createQueryBuilder('event').where('event.status = :status', { status: 'published' })
          .andWhere('event.startsAt < :endsAt AND event.endsAt > :startsAt', { startsAt, endsAt })
          .andWhere('event.id != :id', { id: id ?? 0 }).getOne();
        if (conflict) throw new ConflictException(`Trùng lịch với “${conflict.title}”. Phiên bản này chỉ chạy một sự kiện tại một thời điểm.`);
      }
      const products = dto.items.length ? await manager.getRepository(Product).find({ where: { id: In(dto.items.map(item => item.productId)) }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_read' } }) : [];
      if (products.length !== dto.items.length) throw new BadRequestException('Có sản phẩm không còn tồn tại. Hãy tải lại danh sách.');
      for (const item of dto.items) {
        const product = products.find(product => Number(product.id) === item.productId)!;
        if (Number(product.price) <= 0 || salePrice(Number(product.price), item.discountPercent) >= Number(product.price)) throw new BadRequestException(`${product.name}: giá sau giảm phải thấp hơn giá gốc.`);
      }
      const event = await repo.save(repo.create({ id, title: dto.title.trim(), description: dto.description.trim(), bannerDiscountPercent: dto.bannerDiscountPercent ?? null, status: dto.status, startsAt, endsAt }));
      const items = manager.getRepository(PromotionItem);
      await items.delete({ promotionId: event.id });
      if (dto.items.length) await items.save(dto.items.map(item => items.create({ ...item, promotionId: event.id })));
      return this.serialize(await repo.findOneOrFail({ where: { id: event.id }, relations: ['items', 'items.product'] }));
    });
  }

  private async serialize(event: Promotion, availableOnly = false) {
    const reviews = await reviewSummaries(this.dataSource.manager, event.items.filter(item => item.product).map(item => Number(item.productId)));
    const products = event.items.filter(item => item.product && (!availableOnly || item.product.stock > 0)).map(item => {
      const originalPrice = Number(item.product.price), price = salePrice(originalPrice, item.discountPercent);
      return { ...item.product, ...reviews.get(Number(item.productId)), price, originalPrice, discountPercent: item.discountPercent, savings: originalPrice - price,
        promotionId: event.id, promotionTitle: event.title, saleEndsAt: event.endsAt.toISOString() };
    }).sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings || Number(a.id) - Number(b.id));
    const maxDiscountPercent = products.reduce((max, product) => Math.max(max, product.discountPercent), 0);
    return { id: event.id, title: event.title, description: event.description, status: event.status,
      phase: promotionPhase(event), startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(),
      bannerDiscountPercent: event.bannerDiscountPercent ?? null,
      displayDiscountPercent: Math.min(event.bannerDiscountPercent ?? maxDiscountPercent, maxDiscountPercent), maxDiscountPercent, products };
  }
}
