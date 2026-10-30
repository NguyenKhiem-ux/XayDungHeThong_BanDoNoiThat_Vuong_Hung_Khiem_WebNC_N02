// file định nghĩa layout user dùng để tạo khung giao diện chung cho các trang.
import { FormEvent, useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useReveal } from '../hooks/useReveal';
import { productApi } from '../api/services';
import { ChatWidget } from '../components/ChatWidget';
import { Button, Container, Form, Nav, Navbar } from 'react-bootstrap';

export function UserLayout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCategory = new URLSearchParams(location.search).get('category');

  // Watches for .reveal / .reveal-left / .reveal-right elements — on this
  // page and any later route or async data — and fades/slides them into
  // view, instead of leaving them stuck at opacity: 0.
  useReveal();

  useEffect(() => {
    productApi.categories().then(response => setCategories(response.data)).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const header = document.querySelector('.site-header');
    const sync = () => {
      header?.classList.toggle('scrolled', window.scrollY > 12);
      setShowTopButton(window.scrollY > 400);
    };
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    setSearchExpanded(false);
    navigate(`/products${q ? `?keyword=${encodeURIComponent(q)}` : ''}`);
  };

  const openSearch = () => setSearchExpanded(true);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      <div className="alert-stack"><div id="react-alert-root" /></div>

      <header className="site-header">
        <div className="top-strip">
          <span>Miễn phí giao hàng từ 500K</span>
          <span>Bảo hành chính hãng</span>
          <span>Hotline: 1800 6868</span>
        </div>

        <Navbar as="nav" className="navbar" id="mainNav">
          <Link className="brand" to="/" aria-label="Gia dụng Việt">
            <span className="brand-mark"><i className="fa-solid fa-bolt" /></span>
            <span className="brand-copy">Gia dụng <span>Việt</span></span>
          </Link>

          <Nav as="div" className="nav-links">
            <NavLink end to="/">Trang chủ</NavLink>
            <div className="nav-category-menu">
              <NavLink to="/products" aria-haspopup="true">Sản phẩm <i className="fa-solid fa-chevron-down nav-category-chevron" /></NavLink>
              <div className="nav-category-dropdown" role="menu">
                <div className="nav-category-heading"><span>Khám phá</span><small>Chọn danh mục sản phẩm</small></div>
                <Link className={location.pathname === '/products' && !selectedCategory ? 'active' : ''} to="/products" role="menuitem"><i className="fa-solid fa-layer-group" /> Tất cả sản phẩm <i className="fa-solid fa-arrow-right nav-category-arrow" /></Link>
                {categories.map(category => <Link className={selectedCategory === category ? 'active' : ''} key={category} to={`/products?category=${encodeURIComponent(category)}`} role="menuitem"><i className="fa-solid fa-tag" /> <span>{category}</span><i className="fa-solid fa-arrow-right nav-category-arrow" /></Link>)}
              </div>
            </div>
            <NavLink to="/about">Giới thiệu</NavLink>
            <NavLink to="/contact">Liên hệ</NavLink>
            <NavLink to="/orders">Đơn hàng</NavLink>
          </Nav>

          <div className="nav-actions">
            <Link to="/cart" className="icon-btn" aria-label="Giỏ hàng">
              <i className="fa-solid fa-bag-shopping" />
              {!!cart?.itemCount && <span className="cart-badge">{cart.itemCount}</span>}
            </Link>

            {!user ? (
              <Link to="/login" className="icon-btn" aria-label="Đăng nhập">
                <i className="fa-solid fa-user" />
              </Link>
            ) : (
              <div className="account-menu">
                <button type="button" className="icon-btn" aria-label="Tài khoản" title="Tài khoản">
                  <i className="fa-solid fa-circle-user" />
                </button>
                <div className="account-dropdown">
                  <strong>{user.username || user.email || user.fullName}</strong>
                  <Link to="/profile"><i className="fa-solid fa-id-card" /> Hồ sơ của tôi</Link>
                  <Link to="/orders"><i className="fa-solid fa-box" /> Đơn hàng</Link>
                  {user.role === 'ADMIN' && <Link to="/admin"><i className="fa-solid fa-gauge" /> Quản trị</Link>}
                  <button type="button" onClick={logout}><i className="fa-solid fa-right-from-bracket" /> Đăng xuất</button>
                </div>
              </div>
            )}

            <Form className={`nav-search ${searchExpanded ? 'is-expanded' : ''}`} role="search" onSubmit={search}
              onMouseEnter={() => setSearchExpanded(true)}
              onMouseLeave={e => { if (!e.currentTarget.contains(document.activeElement)) setSearchExpanded(false); }}
              onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSearchExpanded(false); }}>
              <Button type="button" variant="link" className="search-toggle" aria-label={searchExpanded ? 'Thu gọn tìm kiếm' : 'Mở tìm kiếm'}
                aria-expanded={searchExpanded} title={searchExpanded ? 'Tìm kiếm' : 'Mở tìm kiếm'} onClick={openSearch}>
                <i className="fa-solid fa-magnifying-glass" />
              </Button>
              <Form.Control value={keyword} onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchExpanded(false); e.currentTarget.blur(); } }}
                type="search" aria-label="Tìm kiếm sản phẩm" placeholder="Tìm sản phẩm..." autoComplete="off" tabIndex={searchExpanded ? 0 : -1} />
            </Form>

            <button className="menu-toggle" type="button" aria-label="Mở menu"
              aria-expanded={menuOpen} aria-controls="mobileMenu" onClick={() => setMenuOpen(v => !v)}>
              <i className={menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'} />
            </button>
          </div>
        </Navbar>

        <div className={`mobile-panel ${menuOpen ? 'open' : ''}`} id="mobileMenu">
          <Form onSubmit={search} className="mobile-search">
            <Form.Control value={keyword} onChange={e => setKeyword(e.target.value)} type="search" aria-label="Tìm kiếm sản phẩm" placeholder="Tìm kiếm sản phẩm..." />
            <Button type="submit" variant="link" aria-label="Tìm kiếm"><i className="fa-solid fa-magnifying-glass" /></Button>
          </Form>
          <NavLink end to="/">Trang chủ</NavLink>
          <button type="button" className="mobile-category-toggle" aria-expanded={mobileCategoriesOpen} onClick={() => setMobileCategoriesOpen(open => !open)}>Sản phẩm <i className={`fa-solid fa-chevron-${mobileCategoriesOpen ? 'up' : 'down'}`} /></button>
          {mobileCategoriesOpen && <div className="mobile-category-list"><NavLink end to="/products">Tất cả sản phẩm</NavLink>{categories.map(category => <NavLink key={category} to={`/products?category=${encodeURIComponent(category)}`}>{category}</NavLink>)}</div>}
          <NavLink to="/about">Giới thiệu</NavLink>
          <NavLink to="/contact">Liên hệ</NavLink>
          <NavLink to="/orders">Đơn hàng</NavLink>
          <NavLink to="/cart">Giỏ hàng</NavLink>
          {!user ? <NavLink to="/login">Đăng nhập</NavLink> : <>
            <NavLink to="/profile">Hồ sơ của tôi</NavLink>
            <button type="button" onClick={logout}>Đăng xuất</button>
          </>}
        </div>
      </header>

      <main id="main-content" tabIndex={-1}><Outlet /></main>

      <footer className="site-footer">
        <Container fluid="xl" className="footer-main">
          <div className="footer-brand">
            <Link className="brand" to="/">
              <span className="brand-mark"><i className="fa-solid fa-bolt" /></span>
              <span className="brand-copy">Gia dụng <span>Việt</span></span>
            </Link>
            <p>Shop thương mại điện tử chuyên đồ gia dụng, thiết bị nhà bếp và thiết bị chăm sóc nhà cửa chính hãng.</p>
            <div className="socials">
              <a href="#facebook" aria-label="Facebook"><i className="fa-brands fa-facebook-f" /></a>
              <a href="#youtube" aria-label="YouTube"><i className="fa-brands fa-youtube" /></a>
              <a href="#instagram" aria-label="Instagram"><i className="fa-brands fa-instagram" /></a>
              <a href="#tiktok" aria-label="TikTok"><i className="fa-brands fa-tiktok" /></a>
            </div>
          </div>
          <div>
            <h3>Danh mục</h3>
            <Link to="/products?category=Nồi cơm điện">Nồi cơm điện</Link>
            <Link to="/products?category=Máy hút bụi">Máy hút bụi</Link>
            <Link to="/products?category=Máy xay sinh tố">Máy xay sinh tố</Link>
            <Link to="/products?category=Đồ dùng nhà bếp">Đồ dùng nhà bếp</Link>
            <Link to="/products?category=Quạt điện">Quạt điện</Link>
          </div>
          <div>
            <h3>Hỗ trợ</h3>
            <Link to="/about">Về chúng tôi</Link>
            <Link to="/contact">Liên hệ</Link>
            <Link to="/policies">Chính sách giao hàng</Link>
            <Link to="/policies">Chính sách đổi trả</Link>
            <Link to="/policies">Chính sách bảo hành & thanh toán</Link>
          </div>
          <div>
            <h3>Liên hệ</h3>
            <p><i className="fa-solid fa-location-dot" /> 123 Nguyễn Trãi, Thanh Xuân, Hà Nội</p>
            <p><i className="fa-solid fa-phone" /> 1800 6868</p>
            <p><i className="fa-solid fa-envelope" /> support@giadungviet.vn</p>
            <p><i className="fa-solid fa-clock" /> 8:00 - 22:00 mỗi ngày</p>
          </div>
        </Container>
        <div className="footer-bottom">
          <span>© 2023 Gia dụng Việt. All rights reserved.</span>
          <span>Thẻ, chuyển khoản & thanh toán khi nhận hàng</span>
        </div>
      </footer>
      {showTopButton && <button type="button" className="scroll-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Lên đầu trang" title="Lên đầu trang"><ArrowUp size={18} /></button>}
      <ChatWidget />
    </div>
  );
}
