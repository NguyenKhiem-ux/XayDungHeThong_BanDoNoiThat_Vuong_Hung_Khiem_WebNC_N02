import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Accordion, Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { useWindowDimensions } from 'react-native';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/typography.web.css';
import './product-list.web.css';
import { ChatWidget } from '../components/ChatWidget';
import { Header } from '../components/Header';
import { ProductCard, ProductSkeleton } from '../components/ProductCard';
import { ProductFooter } from '../components/ProductFooter';
import { PRICE_RANGES, useProductList, type ProductSort } from '../hooks/useProductList';
import { productPaginationItems } from '../productPagination.mjs';
import { useStore } from '../store';
import { ScrollTopButton, useWebScrollTop } from '../components/ScrollTopButton';

export default function ProductListScreen() {
  const top = useWebScrollTop();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 768;
  const pageSize = width >= 992 ? 12 : width >= 768 ? 9 : 6;
  const { category, categories, clearFilters, error, keyword, loading, page, pageCount, priceRange, products, retry, setCategory, setKeyword, setPage, setPriceRange, setSort, sort, total } = useProductList(pageSize);
  const { notice } = useStore();
  const [search, setSearch] = useState(keyword);
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => setSearch(keyword), [keyword]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setKeyword(search);
  };
  const title = keyword ? `Kết quả cho “${keyword}”` : category || 'Tất cả sản phẩm';
  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return <div ref={top.ref} onScroll={top.onScroll} className="gdv-list-page gdv-typography">
    <Header compact={compact} categories={categories} />
    <section className="gdv-list-hero">
      <Container fluid="xl">
        <nav className="gdv-list-breadcrumb" aria-label="Điều hướng trang">
          <button type="button" onClick={() => router.replace('/')}><Ionicons name="home-outline" size={14} /> Trang chủ</button><span>›</span><strong>Sản phẩm</strong>
        </nav>
        <div className="gdv-list-title"><div><h1>{title}</h1><p>Lựa chọn thiết bị gia dụng chất lượng, tiện nghi cho không gian sống hiện đại.</p></div><button type="button" onClick={() => router.back()}><Ionicons name="arrow-back" size={16} /> Quay lại</button></div>
      </Container>
    </section>

    <main className="gdv-list-main">
      <Container fluid="xl">
        <Row className="g-3 align-items-start">
          <Col lg={3} xl={2}>
            <Accordion defaultActiveKey={compact ? undefined : '0'} className="gdv-list-filters">
              <Accordion.Item eventKey="0">
                <Accordion.Header><Ionicons name="grid-outline" size={17} /> Danh mục sản phẩm</Accordion.Header>
                <Accordion.Body>
                  <button type="button" className={!category ? 'active' : ''} aria-pressed={!category} onClick={() => setCategory('')}>Tất cả sản phẩm</button>
                  {categories.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </Col>

          <Col lg={9} xl={10}>
            <section ref={listRef} className="gdv-list-content" aria-busy={loading}>
              <div className="gdv-list-toolbar">
                <Form className="gdv-list-search" role="search" onSubmit={submitSearch}>
                  <Form.Control aria-label="Tìm trong danh sách sản phẩm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm sản phẩm, thương hiệu, danh mục..." />
                  <Button type="submit" aria-label="Tìm kiếm"><Ionicons name="search" size={18} /></Button>
                </Form>
                <span role="status">{loading ? 'Đang tải sản phẩm…' : error ? 'Chưa thể tải sản phẩm' : <>Tìm thấy <strong>{total}</strong> sản phẩm</>}</span>
                <Form.Group className="gdv-list-sort">
                  <Form.Label htmlFor="product-price">Khoảng giá</Form.Label>
                  <Form.Select id="product-price" aria-label="Lọc theo khoảng giá" value={priceRange} disabled={loading || !!error} onChange={event => setPriceRange(event.target.value)}>
                    <option value="">Mọi mức giá</option>{PRICE_RANGES.map((range, index) => <option key={range.label} value={index}>{range.label}</option>)}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="gdv-list-sort">
                  <Form.Label htmlFor="product-sort">Sắp xếp</Form.Label>
                  <Form.Select id="product-sort" aria-label="Sắp xếp sản phẩm" value={sort} disabled={loading || !!error} onChange={event => setSort(event.target.value as ProductSort)}>
                    <option value="">Mặc định</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option><option value="name">Tên A–Z</option>
                  </Form.Select>
                </Form.Group>
              </div>

              {error ? <Alert variant="danger" className="gdv-list-state"><Ionicons name="alert-circle-outline" size={30} /><h2>Chưa thể tải sản phẩm</h2><p>{error}</p><Button onClick={retry}><Ionicons name="refresh" size={16} /> Thử lại</Button></Alert>
                : loading ? <Row className="g-2 gdv-list-grid" aria-label="Đang tải sản phẩm">{Array.from({ length: pageSize }, (_, index) => <Col xs={6} md={4} lg={3} key={index}><ProductSkeleton style={{ minWidth: 0, width: '100%', height: '100%' }} /></Col>)}</Row>
                  : products.length ? <><Row className="g-2 gdv-list-grid">{products.map(product => <Col xs={6} md={4} lg={3} key={product.id}><ProductCard product={product} style={{ minWidth: 0, width: '100%', height: '100%' }} /></Col>)}</Row><Pagination page={page} pageCount={pageCount} total={total} onChange={goToPage} /></>
                    : <div className="gdv-list-state"><Ionicons name="search-outline" size={34} /><h2>Không tìm thấy sản phẩm</h2><p>Hãy thử từ khóa hoặc danh mục khác.</p><Button onClick={() => { setSearch(''); clearFilters(); }}>Xem tất cả</Button></div>}
            </section>
          </Col>
        </Row>
      </Container>
    </main>
    <ProductFooter />
    <div className="gdv-list-chat"><ScrollTopButton visible={top.visible} onPress={top.toTop} /><ChatWidget compact={compact} /></div>
    {!!notice && <div className="gdv-list-toast" role="status">✓ {notice}</div>}
  </div>;
}

function Pagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) {
  return <nav className="gdv-list-pagination" aria-label="Phân trang sản phẩm"><span>Trang {page} / {pageCount} · {total} sản phẩm</span><div><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button>{productPaginationItems(page, pageCount).map(item => typeof item === 'number' ? <button type="button" key={item} className={item === page ? 'active' : ''} aria-current={item === page ? 'page' : undefined} onClick={() => onChange(item)}>{item}</button> : <span key={item} className="gdv-list-ellipsis" aria-hidden="true">…</span>)}<button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Tiếp</button></div></nav>;
}
