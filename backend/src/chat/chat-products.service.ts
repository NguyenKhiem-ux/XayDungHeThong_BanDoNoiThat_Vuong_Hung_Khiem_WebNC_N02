import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { hashText, normalizeText } from './chat-matching';
import type { ChatIntent, ChatProduct, ChatReply } from './chat.types';

const PRODUCT_TYPE = /\b(may hut bui|may xay sinh to|noi com dien|noi chien khong dau|may loc khong khi|may loc nuoc|may giat|may say|ban ui|ban la|ban an|ban hoc|ban lam viec|tu lanh|bep tu|bep dien|lo vi song|am sieu toc|dieu hoa|ghe|sofa|giuong|nem|quat|chen|bat|dia|coc)\b/;
const PRODUCT_INTENT = /\b(san pham|danh muc|ton kho|con hang|het hang|con may cai|bao nhieu tien|gia|tu van|nen chon|nen mua|tim mua|trieu|nghin|ngan|vnd)\b/;
const MONEY = '(\\d+(?:[.,]\\d+)*)\\s*(trieu|tr|nghin|ngan|k|vnd|dong|d)?';

function amount(value: string, unit = '') {
  const number = Number(/^(\d{1,3})([.,]\d{3})+$/.test(value) ? value.replace(/[.,]/g, '') : value.replace(',', '.'));
  return number * (/^(trieu|tr)$/.test(unit) ? 1_000_000 : /^(nghin|ngan|k)$/.test(unit) ? 1000 : 1);
}

export function productQuery(message: string) {
  const normalized = normalizeText(message);
  const accentedType = message.toLowerCase().match(/(?:^|\s)(bàn|tủ|kệ|đèn|chảo|nồi)(?=\s|[?!.,]|$)/)?.[1];
  const type = normalized.match(PRODUCT_TYPE)?.[0] ?? (accentedType ? normalizeText(accentedType) : undefined);
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const range = text.match(new RegExp(`\\btu\\s+${MONEY}\\s*(?:den|toi|-)\\s*${MONEY}\\b`));
  const upper = text.match(new RegExp(`\\b(duoi|toi da|khong qua|khong vuot qua)\\s+${MONEY}\\b`));
  const lower = text.match(new RegExp(`\\b(tren|it nhat|tu)\\s+${MONEY}\\b`));
  const stop = /\b(san pham|danh muc|phu hop|tu van|bao nhieu|toi da|it nhat|khong qua|khong vuot qua|ton kho|het hang|con may cai|so sanh|khac nhau|thong so|chi tiet|xuat xu|chat lieu|kich thuoc|co|khong|con|hang|toi|minh|dang|muon|can|tim|mua|ban|cho|giup|nao|nen|chon|phong|gia|duoi|tren|tu|den|trieu|tr|nghin|ngan|dong|vnd|k|voi|va|la|cua|mot|loai|tot|re|nhat|cai|chiec|nay|do|ay|tien|cac|shop|a|nhe|nha)\b/g;
  const remaining = normalized.replace(/\b(tat ca|nhung)\b/g, ' ').replace(type ?? /^$/, ' ').replace(stop, ' ').split(/\s+/).filter(word => word.length > 1 && !/^\d/.test(word));
  // ponytail: keyword intent/filters; unsupported phrasing falls back to a cautious answer, not an invented query.
  const terms = [...(type ? [type] : []), ...remaining].slice(0, 6);
  return {
    related: !!type || PRODUCT_INTENT.test(normalized) || !!upper || !!range,
    terms,
    keyword: terms.join(' '),
    minPrice: range ? amount(range[1], range[2] || range[4]) : lower ? amount(lower[2], lower[3]) : undefined,
    maxPrice: range ? amount(range[3], range[4]) : upper ? amount(upper[2], upper[3]) : undefined,
    minExclusive: !range && lower?.[1] === 'tren',
    maxExclusive: false, // Budget ceiling is inclusive, as specified by the chatbot's product-search contract.
    includeOutOfStock: /\b(het hang|ton kho|con hang|con may cai|con bao nhieu)\b/.test(normalized),
  };
}

export interface ProductContext {
  products: Array<{ id: number; name: string; price: string; stock: number; category: string | null; brand: string | null; description: string | null; specifications: string | null; origin: string | null; imageUrl?: string | null; isFeatured?: boolean }>;
  hash: string;
  keyword?: string;
}

@Injectable()
export class ChatProductsService {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>) {}

  async findById(id: number) {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm. Vui lòng tìm và chọn lại.');
    return product;
  }

  async context(message: string): Promise<ProductContext | null> {
    const query = productQuery(message);
    // Policy FAQs and greetings need no product lookup.
    const browsing = /\b(danh muc|cac loai san pham|san pham nao|nhung san pham|tat ca san pham)\b/.test(normalizeText(message));
    if (!query.related || (!query.terms.length && query.maxPrice === undefined && query.minPrice === undefined && !browsing)) return null;

    const qb = this.products.createQueryBuilder('p').select([
      'p.id AS id', 'p.name AS name', 'p.price AS price', 'p.stock AS stock',
      'p.category AS category', 'p.brand AS brand', 'p.origin AS origin',
      'p.imageUrl AS imageUrl', 'p.isFeatured AS isFeatured',
      'LEFT(p.description, 350) AS description', 'LEFT(p.specifications, 500) AS specifications',
    ]);
    query.terms.forEach((term, index) => {
      // Parameters + normalized alphanumeric terms; user text never becomes SQL.
      qb.andWhere(`REPLACE(LOWER(CONCAT_WS(' ', p.name, p.category, p.brand, p.description)), 'đ', 'd') COLLATE utf8mb4_unicode_ci LIKE :term${index}`, { [`term${index}`]: `%${term}%` });
    });
    if (!query.includeOutOfStock) qb.andWhere('p.stock > 0');
    if (query.minPrice !== undefined) qb.andWhere(`p.price ${query.minExclusive ? '>' : '>='} :minPrice`, { minPrice: query.minPrice });
    if (query.maxPrice !== undefined) qb.andWhere(`p.price ${query.maxExclusive ? '<' : '<='} :maxPrice`, { maxPrice: query.maxPrice });
    if (query.terms.length) qb.orderBy(`CASE WHEN REPLACE(LOWER(p.name), 'đ', 'd') COLLATE utf8mb4_unicode_ci LIKE :term0 THEN 0 ELSE 1 END`, 'ASC');
    qb.addOrderBy('p.price', 'ASC').addOrderBy('p.id', 'ASC');
    const products = await qb.limit(5).getRawMany<ProductContext['products'][number]>();
    if (!query.related && !products.length) return null;
    return { products, hash: hashText(JSON.stringify(products)), keyword: query.keyword };
  }
}

export function productAnswer(context: ProductContext, details = false, intent = 'product_search') {
  if (!context.products.length) {
    return context.keyword && !/^(do|mon|hang|san pham)$/.test(context.keyword)
      ? `Mình chưa tìm thấy sản phẩm phù hợp với “${context.keyword}”. Bạn thử tên sản phẩm hoặc danh mục khác nhé.`
      : 'Bạn đang tìm loại sản phẩm nào nhỉ? Ví dụ: nồi cơm điện, máy hút bụi hoặc máy xay sinh tố.';
  }
  const lines = context.products.map(product => {
    const facts = `${product.name} — ${Number(product.price).toLocaleString('vi-VN')}đ; ${product.stock > 0 ? `còn ${product.stock} chiếc` : 'hiện hết hàng'}.`;
    if (intent === 'product_price') return `Giá ${product.name} hiện là ${Number(product.price).toLocaleString('vi-VN')}đ.`;
    if (intent === 'product_stock') return `${product.name} hiện ${product.stock > 0 ? `còn ${product.stock} chiếc` : 'đã hết hàng'}.`;
    return details ? `${facts}${product.category ? ` Danh mục: ${product.category}.` : ''}${product.brand ? ` Thương hiệu: ${product.brand}.` : ''}${product.origin ? ` Xuất xứ: ${product.origin}.` : ''}${product.specifications ? ` Thông số: ${product.specifications}` : ' Chưa có thông số chi tiết.'}` : facts;
  });
  return ['product_price', 'product_stock'].includes(intent) ? lines.join('\n') : `Mình tìm thấy các kết quả sau theo dữ liệu hiện tại:\n${lines.join('\n')}\nBạn muốn xem kỹ sản phẩm nào?`;
}

export function chatProduct(product: ProductContext['products'][number]): ChatProduct {
  return { id: Number(product.id), name: product.name, price: Number(product.price), stock: Number(product.stock),
    category: product.category ?? null, brand: product.brand ?? null, description: product.description ?? null,
    specifications: product.specifications ?? null, origin: product.origin ?? null,
    imageUrl: product.imageUrl ?? null, isFeatured: !!product.isFeatured };
}

export function productResponse(context: ProductContext, intent: ChatIntent): ChatReply {
  return {
    message: productAnswer(context, ['product_detail', 'product_comparison', 'product_category', 'product_select'].includes(intent), intent),
    products: context.products.map(chatProduct), type: 'product_result',
    actions: context.products.flatMap(product => [
      { type: 'product_select' as const, label: 'Chọn sản phẩm', productId: Number(product.id) },
      { type: 'favorite_add' as const, label: 'Yêu thích', productId: Number(product.id) },
      ...(product.stock > 0 ? [
        { type: 'cart_add' as const, label: 'Thêm vào giỏ', productId: Number(product.id) },
        { type: 'buy_now' as const, label: 'Mua ngay', productId: Number(product.id) },
      ] : []),
    ]),
    source: 'product', intent, cached: false,
  };
}
