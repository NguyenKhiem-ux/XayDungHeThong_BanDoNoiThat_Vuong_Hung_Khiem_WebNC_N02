import { useWindowDimensions } from 'react-native';
import { Header } from './Header';

// Mọi trang dùng chung header chính (tìm kiếm, menu, tài khoản, giỏ hàng) để người dùng không bị đổi giao diện khi sang giỏ hàng hay checkout.
export function PageHeader(_props: { back?: boolean }) {
  const compact = useWindowDimensions().width < 760;
  return <Header compact={compact} categories={[]} />;
}
