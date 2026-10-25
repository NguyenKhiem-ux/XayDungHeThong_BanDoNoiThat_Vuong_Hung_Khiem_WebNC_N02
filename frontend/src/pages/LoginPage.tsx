// file là trang login của giao diện người dùng.
import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login-scene.css';

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as {message?: string} | null)?.message;
  const [loginId,setLoginId]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [show,setShow]=useState(false);

  useEffect(()=>{ if(admin) return; const t=window.setTimeout(()=>{},0); return ()=>window.clearTimeout(t); },[admin]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const user = await login(loginId, password);
      if (admin && user.role !== 'ADMIN') {
        logout(); setError('Tài khoản này không có quyền quản trị'); return;
      }
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(admin ? '/admin' : from || '/');
    } catch (failure) {
      if (axios.isAxiosError(failure) && !failure.response) {
        setError('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
      } else if (axios.isAxiosError(failure) && Number(failure.response?.status) >= 500) {
        setError('Không thể đăng nhập do lỗi máy chủ. Vui lòng thử lại sau.');
      } else {
        setError('Đăng nhập thất bại. Vui lòng kiểm tra tài khoản và mật khẩu.');
      }
    } finally { setBusy(false); }
  };

  if(admin) return <div className="admin-app admin-login-container"><div className="admin-login-form"><div className="admin-login-header"><div className="admin-role-badge">🛡 QUẢN TRỊ VIÊN</div><h1>ĐĂNG NHẬP ADMIN</h1><p>Chỉ dành cho quản trị viên Gia dụng Việt.</p></div>{error&&<div className="admin-error-msg">{error}</div>}<form onSubmit={submit}><label className="admin-form-group">Tên đăng nhập hoặc email<input value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="admin hoặc admin@shop.com" required /></label><label className="admin-form-group">Mật khẩu<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" required /></label><button className="admin-btn-login" disabled={busy} type="submit">{busy?'Đang xử lý...':'↪ Đăng nhập'}</button></form></div></div>;

  return <section className="auth-login-scene">
    <div className="auth-login-glow" aria-hidden="true" />
    <form className="auth-form auth-login-card" onSubmit={submit} autoComplete="on">
      <div className="auth-header"><h1><i className="fa-solid fa-right-to-bracket" /> Đăng nhập</h1><p>Chào mừng bạn quay lại Gia dụng Việt.</p></div>
      {successMessage&&<div className="auth-message success">{successMessage}</div>}
      {error&&<div className="auth-message error">{error}</div>}
      <div className="form-group"><label htmlFor="loginId">Tên đăng nhập hoặc email</label><input id="loginId" value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="username hoặc your@email.com" required autoComplete="username" /></div>
      <div className="form-group"><div className="form-label-row"><label htmlFor="password">Mật khẩu</label><Link to="/forgot-password">Quên mật khẩu?</Link></div><div className="password-field"><input id="password" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="******" required autoComplete="current-password" /><button type="button" className="password-toggle" onClick={()=>setShow(v=>!v)} aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'}><i className={`fa-solid ${show?'fa-eye-slash':'fa-eye'}`} /></button></div></div>
      <button type="submit" className="btn btn-primary btn-wide" disabled={busy}><i className="fa-solid fa-right-to-bracket" /> {busy?'Đang xử lý...':'Đăng nhập'}</button>
      <div className="auth-footer">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></div>
    </form>
  </section>;
}
