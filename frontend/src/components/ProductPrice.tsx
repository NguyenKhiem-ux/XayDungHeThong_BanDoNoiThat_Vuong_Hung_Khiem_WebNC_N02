import { formatVnd } from '../api/client';
import type { Product } from '../api/types';

export function ProductPrice({ product }: { product: Pick<Product, 'price' | 'originalPrice' | 'discountPercent' | 'savings'> }) {
  const onSale = !!product.discountPercent && (product.originalPrice ?? 0) > product.price;
  return <div className={`product-pricing${onSale ? ' is-sale' : ''}`}>
    <strong className="selling-price">{formatVnd(product.price)}</strong>
    {onSale && <><div className="original-price"><span className="sr-only">Giá gốc </span><del>{formatVnd(product.originalPrice!)}</del><span>−{product.discountPercent}%</span></div>
      <span className="price-saving">Tiết kiệm {formatVnd(product.savings ?? product.originalPrice! - product.price)}</span></>}
  </div>;
}
