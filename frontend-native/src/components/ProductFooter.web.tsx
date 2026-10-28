import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Col, Container, Row } from 'react-bootstrap';
import { openLegacy } from '../api';

const footerLinks = [
  ['Danh mục', [['Nồi cơm điện', '/products?category=Nồi cơm điện'], ['Máy hút bụi', '/products?category=Máy hút bụi'], ['Đồ dùng nhà bếp', '/products?category=Đồ dùng nhà bếp'], ['Quạt điện', '/products?category=Quạt điện']]],
  ['Hỗ trợ', [['Về chúng tôi', '/about'], ['Liên hệ', '/contact'], ['Chính sách giao hàng', '/policies'], ['Chính sách đổi trả', '/policies']]],
] as const;

export function ProductFooter() {
  const router = useRouter();
  const open = (path: string) => path.startsWith('/products') ? router.push(path as Href) : void openLegacy(path);
  return <footer className="gdv-footer"><Container><Row className="g-4"><Col lg={5}><div className="gdv-footer-brand"><span><Ionicons name="home-outline" size={25} /></span><div><strong>Gia dụng Việt</strong><p>Shop thương mại điện tử chuyên đồ gia dụng, thiết bị nhà bếp và thiết bị chăm sóc nhà cửa chính hãng.</p></div></div></Col>{footerLinks.map(([title, links]) => <Col sm={6} lg={2} key={title}><h3>{title}</h3>{links.map(([label, path]) => <button type="button" key={label} onClick={() => open(path)}>{label}</button>)}</Col>)}<Col sm={6} lg={3}><h3>Liên hệ</h3><p>123 Nguyễn Trãi, Thanh Xuân, Hà Nội</p><p>1800 6868</p><p>support@giadungviet.vn</p><p>8:00 - 22:00 mỗi ngày</p></Col></Row><div className="gdv-footer-copy">© 2023 Gia dụng Việt. All rights reserved.</div></Container></footer>;
}
