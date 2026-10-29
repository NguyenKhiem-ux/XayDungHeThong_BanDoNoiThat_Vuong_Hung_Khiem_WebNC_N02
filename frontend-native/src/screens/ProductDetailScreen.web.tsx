import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Accordion, Button, Card, Col, Container, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import { useWindowDimensions } from 'react-native';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/typography.web.css';
import './product-detail.web.css';
import { formatVnd, imageUrl, ratingStars } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { ProductReviews } from '../components/ProductReviews';
import { useProductDetail } from '../hooks/useProductDetail';

const policies = [
  ['shield-checkmark-outline', 'Bảo hành 12-24 tháng', 'Bảo hành chính hãng theo chính sách nhà sản xuất'],
  ['car-outline', 'Giao nhanh toàn quốc', 'Nhận hàng từ 2-5 ngày'],
  ['refresh-outline', 'Đổi trả 7 ngày', 'Đổi trả dễ dàng nếu có lỗi'],
  ['ribbon-outline', 'Chính hãng 100%', 'Sản phẩm chính hãng, có đầy đủ hóa đơn'],
] as const;

export default function ProductDetailScreen() {
  const detail = useProductDetail();
  const compact = useWindowDimensions().width < 720;
  const { add, cartBusy, changeQuantity, error, favoriteIds, load, loading, notice, product, quantity, router, toggleSaved, updateSummary } = detail;
  const [imageFailed, setImageFailed] = useState(false);

  if (loading) return <div className="gdv-detail-page gdv-typography"><PageHeader back /><div className="gdv-page-state"><Spinner animation="border" /><span>Đang tải sản phẩm…</span></div></div>;
  if (error || !product) return <div className="gdv-detail-page gdv-typography"><PageHeader back /><div className="gdv-page-state"><Ionicons name="alert-circle-outline" size={40} color="#9B382F" /><h1>Chưa thể mở sản phẩm</h1><p>{error || 'Không tìm thấy sản phẩm.'}</p><div><Button variant="outline-primary" onClick={() => router.replace('/')}>Về trang chủ</Button><Button onClick={() => void load()}>Thử lại</Button></div></div></div>;

  const soldOut = product.stock <= 0;
  const saved = favoriteIds.includes(product.id);
  const onSale = !!product.discountPercent && (product.originalPrice ?? 0) > product.price;

  return <div className="gdv-detail-page gdv-typography">
    <PageHeader back />
    <main className="gdv-detail-main">
      <Container fluid="xl">
        <nav className="gdv-breadcrumb" aria-label="Điều hướng trang"><button type="button" onClick={() => router.replace('/')}>Trang chủ</button><span>›</span><span>Sản phẩm</span><span>›</span><strong>{product.name}</strong></nav>

        <Row className="g-3 align-items-stretch">
          <Col lg={5}>
            <Card className="gdv-product-card gdv-media-card h-100">
              <Card.Body>
                <div className="gdv-product-media">{product.imageUrl && !imageFailed ? <img src={imageUrl(product.imageUrl)} alt={product.name} onError={() => setImageFailed(true)} /> : <span>Không thể hiển thị ảnh sản phẩm.</span>}{product.isFeatured && <b>Nổi bật</b>}</div>
                <div className="gdv-support-strip" aria-label="Hỗ trợ mua hàng"><span><Ionicons name="cube-outline" size={17} /> Kiểm hàng</span><span><Ionicons name="construct-outline" size={17} /> Tư vấn sử dụng</span><span><Ionicons name="headset-outline" size={17} /> Tư vấn nhanh</span></div>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            <Card className="gdv-product-card gdv-buy-card h-100"><Card.Body>
              <div className="gdv-title-row"><div><span className="gdv-kicker">{product.category || 'Gia dụng'}</span><h1>{product.name}</h1></div><Button className="gdv-favorite" aria-label={saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'} aria-pressed={saved} onClick={() => void toggleSaved()}><Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} /></Button></div>
              <div className="gdv-rating-line"><span aria-label={`${product.averageRating ?? 0} trên 5 sao`}>{ratingStars(product.averageRating)}</span><small>{product.averageRating?.toFixed(1) || '0.0'} · {product.reviewCount ?? 0} đánh giá</small></div>
              {!!product.brand && <p className="gdv-brand">Thương hiệu: <strong>{product.brand}</strong></p>}
              <div className="gdv-price-row"><div><strong>{formatVnd(product.price)}</strong>{onSale && <p><del>{formatVnd(product.originalPrice!)}</del><span>-{product.discountPercent}%</span></p>}</div><span className={soldOut ? 'out' : 'in'}>{soldOut ? '✕ Hết hàng' : `✓ Còn ${product.stock}`}</span></div>
              {!!product.discountPercent && !!product.promotionTitle && <p className="gdv-promotion">{product.promotionTitle}{product.saleEndsAt ? ` · Đến ${new Date(product.saleEndsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}. Giá được kiểm tra lại khi xác nhận đơn.</p>}
              {!!product.description && <p className="gdv-description">{product.description}</p>}
              {!soldOut && <div className="gdv-buy-box"><div className="gdv-quantity"><Form.Label htmlFor="product-quantity">Số lượng</Form.Label><InputGroup><Button aria-label="Giảm số lượng" onClick={() => changeQuantity(quantity - 1)}>−</Button><Form.Control id="product-quantity" type="number" min={1} max={product.stock} value={quantity} onChange={event => changeQuantity(Number(event.target.value))} /><Button aria-label="Tăng số lượng" onClick={() => changeQuantity(quantity + 1)}>+</Button></InputGroup></div><Button className="gdv-add-cart" disabled={cartBusy} onClick={() => void add()}>{cartBusy ? <Spinner size="sm" /> : <><Ionicons name="cart-outline" size={20} /> Thêm vào giỏ hàng</>}</Button></div>}
            </Card.Body></Card>
          </Col>

          <Col lg={3}>
            <Card className="gdv-product-card gdv-policy-card h-100"><Card.Body>{policies.map(([icon, title, text]) => <div className="gdv-policy" key={title}><span><Ionicons name={icon} size={22} /></span><div><strong>{title}</strong><p>{text}</p></div></div>)}</Card.Body></Card>
          </Col>
        </Row>

        <Row className="g-3 mt-1 align-items-start">
          <Col lg={4}>{!!product.specifications && <Accordion defaultActiveKey="0" className="gdv-specifications"><Accordion.Item eventKey="0"><Accordion.Header>Thông số kỹ thuật</Accordion.Header><Accordion.Body><p>{product.specifications}</p></Accordion.Body></Accordion.Item></Accordion>}</Col>
          <Col lg={8}><ProductReviews key={product.id} productId={product.id} onChange={updateSummary} /></Col>
        </Row>
      </Container>
    </main>
    <ProductFooter />
    <div className="gdv-chat-layer"><ChatWidget compact={compact} /></div>
    {!!notice && <div className="gdv-toast" role="status">✓ {notice}</div>}
  </div>;
}
