import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Zap } from 'lucide-react';
import '../styles/auth-pages.css';

export function AuthLayout({ children, variant = 'recovery', step }: {
  children: ReactNode;
  variant?: 'login' | 'register' | 'recovery' | 'admin';
  step?: number;
}) {
  const lifestyle = variant === 'login' || variant === 'register';
  return <section className={`auth-experience auth-experience--${variant}`}>
    <div className="auth-page-top">
      <Link to="/" className="auth-home-link"><ArrowLeft size={16} aria-hidden="true" /> Về cửa hàng</Link>
      <span><ShieldCheck size={16} aria-hidden="true" /> {variant === 'admin' ? 'Khu vực quản trị' : 'Tài khoản Hung Vuong Gia dụng'}</span>
    </div>
    <div className="auth-page-body">
      <div className="auth-form-area">
        <Link to="/" className="auth-wordmark" aria-label="Hung Vuong Gia dụng - Trang chủ"><span><Zap size={23} aria-hidden="true" /></span><strong>Hung Vuong <small>Gia dụng</small></strong></Link>
        {step !== undefined && <ol className="auth-steps" aria-label="Khôi phục mật khẩu">{['Email', 'Xác thực OTP', 'Mật khẩu mới'].map((label, i) => <li key={label} aria-current={i === step ? 'step' : undefined} className={i <= step ? 'reached' : ''}><span>{i + 1}</span>{label}</li>)}</ol>}
        {children}
      </div>
      {lifestyle && <aside className="auth-lifestyle" aria-label="Không gian bếp hiện đại">
        <img src="https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1100&q=85" alt="Căn bếp hiện đại với tủ bếp sáng màu và bàn bếp gọn gàng" />
        <div className="auth-lifestyle-copy"><span>Cho ngôi nhà của bạn</span><h2>Chăm chút từng góc nhà.</h2><p>Thiết bị gia dụng chính hãng, đồng hành cùng những tiện nghi mỗi ngày.</p></div>
      </aside>}
    </div>
  </section>;
}
