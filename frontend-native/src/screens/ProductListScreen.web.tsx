import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FormEvent, useEffect, useState } from 'react';
import { Accordion, Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { useWindowDimensions } from 'react-native';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/typography.web.css';
import './product-list.web.css';
import { ChatWidget } from '../components/ChatWidget';
import { Header } from '../components/Header';
import { ProductCard, ProductSkeleton } from '../components/ProductCard';
import { ProductFooter } from '../components/ProductFooter';
import { useProductList, type ProductSort } from '../hooks/useProductList';
import { useStore } from '../store';

export default function ProductListScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 768;
  const { category, categories, clearFilters, error, keyword, loading, products, retry, setCategory, setKeyword, setSort, sort } = useProductList();
  const { notice } = useStore();
  const [search, setSearch] = useState(keyword);

  useEffect(() => setSearch(keyword), [keyword]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setKeyword(search);
  };
  const title = keyword ? `Kết quả cho “${keyword}”` : category || 'Tất cả sản phẩm';

  return <div className="gdv-list-page gdv-typography">
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
            <section className="gdv-list-content" aria-busy={loading}>
              <div className="gdv-list-toolbar">
                <Form className="gdv-list-search" role="search" onSubmit={submitSearch}>
                  <Form.Control aria-label="Tìm trong danh sách sản phẩm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm sản phẩm, thương hiệu, danh mục..." />
                  <Button type="submit" aria-label="Tìm kiếm"><Ionicons name="search" size={18} /></Button>
                </Form>
                <span role="status">{loading ? 'Đang tải sản phẩm…' : error ? 'Chưa thể tải sản phẩm' : <>Tìm thấy <strong>{products.length}</strong> sản phẩm</>}</span>
                <Form.Group className="gdv-list-sort">
                  <Form.Label htmlFor="product-sort">Sắp xếp</Form.Label>
                  <Form.Select id="product-sort" aria-label="Sắp xếp sản phẩm" value={sort} disabled={loading || !!error} onChange={event => setSort(event.target.value as ProductSort)}>
                    <option value="">Mặc định</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option><option value="name">Tên A–Z</option>
                  </Form.Select>
                </Form.Group>
              </div>

              {error ? <Alert variant="danger" className="gdv-list-state"><Ionicons name="alert-circle-outline" size={30} /><h2>Chưa thể tải sản phẩm</h2><p>{error}</p><Button onClick={retry}><Ionicons name="refresh" size={16} /> Thử lại</Button></Alert>
                : loading ? <Row className="g-2 gdv-list-grid" aria-label="Đang tải sản phẩm">{Array.from({ length: 8 }, (_, index) => <Col xs={6} xl={4} xxl={3} key={index}><ProductSkeleton style={{ minWidth: 0, width: '100%', height: '100%' }} /></Col>)}</Row>
                  : products.length ? <Row className="g-2 gdv-list-grid">{products.map(product => <Col xs={6} xl={4} xxl={3} key={product.id}><ProductCard product={product} style={{ minWidth: 0, width: '100%', height: '100%' }} /></Col>)}</Row>
                    : <div className="gdv-list-state"><Ionicons name="search-outline" size={34} /><h2>Không tìm thấy sản phẩm</h2><p>Hãy thử từ khóa hoặc danh mục khác.</p><Button onClick={() => { setSearch(''); clearFilters(); }}>Xem tất cả</Button></div>}
            </section>
          </Col>
        </Row>
      </Container>
    </main>
    <ProductFooter />
    <div className="gdv-list-chat"><ChatWidget compact={compact} /></div>
    {!!notice && <div className="gdv-list-toast" role="status">✓ {notice}</div>}
  </div>;
}
