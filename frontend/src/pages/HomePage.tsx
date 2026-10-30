// file là trang home của giao diện người dùng.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play, RotateCw } from 'lucide-react';
import { productApi } from '../api/services';
import type { Product } from '../api/types';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { FlashSale } from '../components/FlashSale';
import { usePriceRevision } from '../hooks/usePriceRevision';

const slides = [
  {
    src: 'https://images.pexels.com/photos/31473208/pexels-photo-31473208/free-photo-of-modern-kitchen-counter-with-tulips-and-appliances.jpeg?auto=compress&fit=crop&w=1800&q=85',
    alt: 'Thiết bị gia dụng trong căn bếp sáng hiện đại',
    position: '50% 72%',
    mobilePosition: '42% 78%',
  },
  {
    src: 'https://images.pexels.com/photos/4816319/pexels-photo-4816319.jpeg?auto=compress&fit=crop&w=1800&q=85',
    alt: 'Các thiết bị nhỏ trên bàn bếp',
    position: '50% 58%',
    mobilePosition: '45% 60%',
  },
  {
    src: 'https://images.unsplash.com/photo-1720694035658-220bc2d2a3d1?auto=format&fit=crop&w=1800&q=85',
    alt: 'Không gian bếp tối giản với thiết bị âm tủ',
    position: '50% 62%',
    mobilePosition: '65% 65%',
  },
];

const categories = [
  ['Nồi cơm điện','Cơm ngon mỗi ngày','https://dienmaytienphong.com/wp-content/uploads/2025/06/SR-MVN18LRAX.png'],
  ['Robot hút bụi','Nhà sạch thảnh thơi','https://caothienphat.com/wp-content/uploads/2025/04/Dreame-1-768x768.jpg'],
  ['Máy xay sinh tố','Tươi ngon tại nhà','/images/blender-category.svg'],
  ['Đồ dùng nhà bếp','Trọn vẹn bữa cơm nhà','https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=400&q=75'],
  ['Quạt điện','Mát lành, dễ chịu','https://images.unsplash.com/photo-1565031491910-e57fac031c41?auto=format&fit=crop&w=400&q=75'],
  ['Máy hút bụi','Tiện nghi gia đình','https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=400&q=75'],
];

export function HomePage() {
  const priceRevision = usePriceRevision();
  const [current, setCurrent] = useState(0);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    productApi.featured().then(r => { if (active) setFeatured(r.data); })
      .catch(() => { if (active) { setFeatured([]); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry, priceRevision]);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: number | undefined;
    const sync = () => {
      window.clearInterval(timer);
      if (!paused && !motion.matches) timer = window.setInterval(() => setCurrent(v => (v + 1) % slides.length), 5000);
    };
    sync();
    motion.addEventListener('change', sync);
    return () => { window.clearInterval(timer); motion.removeEventListener('change', sync); };
  }, [paused]);

  return <>
    <section className="home-hero">
      <div className="hero-showcase reveal-left" id="heroShowcase">
        <div className="hs-slides">
          {slides.map((slide, i) => (
            <div className={`hs-slide ${i === current ? 'active' : ''}`} key={slide.src}>
              <img src={slide.src} alt={slide.alt} style={{ '--hero-position': slide.position, '--hero-mobile-position': slide.mobilePosition } as React.CSSProperties} fetchPriority={i === 0 ? 'high' : 'auto'} />
            </div>
          ))}
        </div>
        <div className="hs-progress"><div className="hs-progress-bar" style={{ width: `${((current + 1) / slides.length) * 100}%`, transition: 'width 5000ms linear' }} /></div>
        <div className="hs-dots" id="hsDots">
          {slides.map((_, i) => <button key={i} className={`hs-dot ${i === current ? 'active' : ''}`} aria-label={`Ảnh ${i + 1}`} aria-pressed={i === current} onClick={() => setCurrent(i)} />)}
          <button className="hs-pause" type="button" aria-label={paused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'} title={paused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'} aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        </div>
        <div className="hero-overlay" />
        <div className="hero-copy">
          <span className="eyebrow">Gia dụng Việt</span>
          <h1>Thiết bị gia dụng</h1>
          <p className="hero-subtitle">Chăm chút từng góc nhà.</p>
          <p>Nồi cơm điện, máy xay, nồi chiên và thiết bị chăm sóc nhà cửa chính hãng cho cuộc sống mỗi ngày.</p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary"><i className="fa-solid fa-bag-shopping" /> Mua ngay</Link>
            <Link to="/products?category=Nồi cơm điện" className="btn btn-light"><i className="fa-solid fa-bowl-food" /> Xem nồi cơm điện</Link>
          </div>
        </div>
        <div className="hero-stat"><strong>98%</strong><span>khách hàng hài lòng</span></div>
      </div>

      <aside className="hero-side reveal-right">
        <MiniCategory name="Nồi cơm điện" image="https://dienmaytienphong.com/wp-content/uploads/2025/06/SR-MVN18LRAX.png" />
        <MiniCategory name="Đồ dùng nhà bếp" image="https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=600&q=80" />
        <MiniCategory name="Máy xay sinh tố" image="/images/blender-category.svg" />
        <MiniCategory name="Máy hút bụi" image="https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=600&q=80" />
      </aside>
    </section>

    <section className="trust-bar reveal">
      <Trust icon="fa-truck-fast" title="Giao trong ngày" sub="Nội thành HCM & HN" />
      <Trust icon="fa-shield-halved" title="Bảo hành chính hãng" sub="12 - 24 tháng" />
      <Trust icon="fa-rotate-left" title="Đổi trả miễn phí" sub="Trong vòng 7 ngày" />
      <Trust icon="fa-headset" title="Hỗ trợ 24/7" sub="Chat & Gọi trực tiếp" />
      <Trust icon="fa-credit-card" title="Thanh toán an toàn" sub="Thẻ, chuyển khoản, COD" />
    </section>

    <section className="section">
      <div className="section-heading reveal">
        <div><h2>Mua theo danh mục</h2></div>
        <Link to="/products" className="text-link">Tất cả <i className="fa-solid fa-arrow-right" /></Link>
      </div>
      <div className="category-grid">
        {categories.map(([name, sub, image], i) => (
          <Link key={name} to={`/products?category=${encodeURIComponent(name === 'Robot hút bụi' ? 'Thiết bị gia dụng thông minh' : name)}`} className="cat-card reveal" style={{ '--delay': `${i * 60}ms` } as React.CSSProperties}>
            <img src={image} alt={name} loading="lazy" />
            <div className="cat-label"><strong>{name}</strong><span>{sub}</span><ArrowRight className="cat-arrow" size={18} aria-hidden="true" /></div>
          </Link>
        ))}
      </div>
    </section>

    <FlashSale />

    <section className="section">
      <div className="section-heading reveal">
        <div><h2>Sản phẩm nổi bật</h2></div>
        <Link to="/products" className="text-link">Xem thêm <i className="fa-solid fa-arrow-right" /></Link>
      </div>
      {loading ? <div className="product-grid" role="status" aria-label="Đang tải sản phẩm" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div> :
        featured.length ? <div className="product-grid">{featured.map((p, i) => <ProductCard key={p.id} product={p} home index={i} />)}</div> :
        <div className="empty-state" role="status"><h3>{failed ? 'Chưa thể tải sản phẩm' : 'Chưa có sản phẩm nổi bật'}</h3><p>{failed ? 'Vui lòng kiểm tra kết nối và thử lại.' : 'Khám phá thêm các sản phẩm trong cửa hàng.'}</p>{failed ? <button className="btn btn-outline" onClick={() => setRetry(v => v + 1)}><RotateCw size={16} /> Thử lại</button> : <Link to="/products" className="btn btn-primary">Xem tất cả sản phẩm</Link>}</div>}
    </section>

    <section className="feature-split section">
      <div className="split-text reveal-left">
        <h2>Không gian gia đình gọn gàng, tiện nghi và hiện đại</h2>
        <p>Chọn nhanh combo nồi cơm điện, máy xay, nồi chiên và thiết bị vệ sinh phù hợp nhu cầu gia đình.</p>
        <Link to="/products?category=Thiết bị gia dụng thông minh" className="btn btn-primary">Khám phá thiết bị</Link>
      </div>
      <img className="split-image reveal-right" src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=85" alt="Không gian gia đình hiện đại" />
    </section>

    <section className="brands-section section">
      <p className="brands-label reveal">Thương hiệu chính hãng phân phối</p>
      <div className="brands-track-wrap reveal"><div className="brands-track">
        {['Panasonic','Sharp','Philips','Toshiba','LocknLock','Xiaomi','Deerma','Electrolux','Tefal','Kangaroo','Sunhouse','Bluestone',
          'Panasonic','Sharp','Philips','Toshiba','LocknLock','Xiaomi','Deerma','Electrolux','Tefal','Kangaroo','Sunhouse','Bluestone'].map((b,i)=><div className="brand-item" key={`${b}-${i}`}>{b}</div>)}
      </div></div>
    </section>

    <section className="section review-band reveal">
      <div><strong>4.9/5</strong><span>Đánh giá trung bình từ khách hàng</span></div>
      <blockquote>"Giao diện dễ mua, sản phẩm rõ thông tin, tư vấn nhanh và đóng gói rất chắc chắn."</blockquote>
      <blockquote>"Máy gia dụng dễ sử dụng, đóng gói chắc chắn và bảo hành minh bạch."</blockquote>
      <blockquote>"Nồi cơm điện chính hãng, giao trong ngày tại TP.HCM."</blockquote>
    </section>

    <section className="newsletter-section reveal">
      <div className="newsletter-inner">
        <div className="newsletter-text">
          <div className="newsletter-icon-wrap"><i className="fa-solid fa-envelope-open-text" /></div>
          <h3>Nhận ưu đãi độc quyền qua email</h3>
          <p>Đăng ký để không bỏ lỡ flash sale, sản phẩm mới và mã giảm giá riêng cho thành viên.</p>
        </div>
        <form className="newsletter-form" onSubmit={e => e.preventDefault()}>
          <div className="newsletter-input-wrap"><i className="fa-solid fa-envelope" /><input type="email" aria-label="Email nhận ưu đãi" autoComplete="email" placeholder="Email của bạn" required /></div>
          <button type="submit" className="btn btn-primary"><i className="fa-solid fa-paper-plane" /> Đăng ký</button>
        </form>
      </div>
    </section>
  </>;
}

function MiniCategory({name,image}:{name:string,image:string}) {
  return <Link to={`/products?category=${encodeURIComponent(name)}`} className="mini-category"><img src={image} alt="" /><span>{name}</span><ArrowRight size={18} aria-hidden="true" /></Link>;
}
function Trust({icon,title,sub}:{icon:string,title:string,sub:string}) {
  return <div className="trust-item"><div className="trust-icon"><i className={`fa-solid ${icon}`} aria-hidden="true" /></div><div><strong>{title}</strong><span>{sub}</span></div></div>;
}
