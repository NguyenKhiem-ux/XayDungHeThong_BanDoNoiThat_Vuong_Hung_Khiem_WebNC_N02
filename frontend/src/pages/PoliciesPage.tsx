import { Link } from 'react-router-dom';

const policies = [
  { title: 'Chính sách giao hàng', text: 'Hung Vuong Gia dụng giao hàng trên toàn quốc. Phí giao hàng hiện được miễn phí theo thông tin hiển thị tại bước đặt hàng. Thời gian giao dự kiến được nhân viên xác nhận sau khi tiếp nhận đơn.' },
  { title: 'Chính sách đổi trả', text: 'Khách hàng có thể yêu cầu đổi hoặc trả sản phẩm trong vòng 7 ngày kể từ khi nhận hàng nếu sản phẩm bị lỗi hoặc không đúng mô tả. Vui lòng giữ sản phẩm, phụ kiện và liên hệ bộ phận hỗ trợ để được hướng dẫn.' },
  { title: 'Chính sách bảo hành', text: 'Sản phẩm được áp dụng bảo hành theo chính sách của nhà sản xuất. Thời hạn và điều kiện bảo hành cụ thể phụ thuộc từng sản phẩm; vui lòng xem thông tin sản phẩm hoặc liên hệ cửa hàng trước khi gửi bảo hành.' },
  { title: 'Chính sách thanh toán', text: 'Website hỗ trợ thanh toán QR qua PayOS, thanh toán thẻ theo phương thức được cung cấp tại bước thanh toán và thanh toán tiền mặt khi nhận hàng. Đơn thanh toán trực tuyến chỉ được xác nhận sau khi hệ thống nhận được thông báo thanh toán hợp lệ.' },
  { title: 'Bảo vệ thông tin cá nhân', text: 'Thông tin liên hệ và giao nhận được sử dụng để xử lý đơn hàng, hỗ trợ khách hàng và cung cấp thông tin giao dịch. Hung Vuong Gia dụng không yêu cầu khách hàng gửi mật khẩu hoặc mã OTP qua điện thoại, email hay tin nhắn.' },
];

export function PoliciesPage() {
  return <>
    <section className="page-hero compact"><span className="eyebrow dark">HUNG VUONG GIA DỤNG</span><h1>Chính sách và điều khoản</h1><p>Thông tin về giao hàng, đổi trả, bảo hành, thanh toán và quyền riêng tư khi mua sắm.</p></section>
    <section className="section"><div className="container" style={{ maxWidth: 900 }}>
      {policies.map((policy) => <article className="card" key={policy.title} style={{ marginBottom: 16 }}><h2>{policy.title}</h2><p>{policy.text}</p></article>)}
      <p>Cần hỗ trợ? <Link to="/contact" className="text-link">Liên hệ Hung Vuong Gia dụng</Link>.</p>
    </div></section>
  </>;
}
