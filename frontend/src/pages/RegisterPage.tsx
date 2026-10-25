// file là trang register của giao diện người dùng.
import axios from 'axios';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
 const {register}=useAuth(); const navigate=useNavigate(); const [form,setForm]=useState({fullName:'',username:'',email:'',phone:'',password:'',confirmPassword:''}); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [show1,setShow1]=useState(false); const [show2,setShow2]=useState(false);
 const submit=async(e:FormEvent)=>{e.preventDefault();setError('');if(form.password!==form.confirmPassword){setError('Mật khẩu xác nhận không khớp');return;}setBusy(true);try{const {confirmPassword:_,...registerData}=form;await register(registerData);navigate('/')}catch(requestError){const message=axios.isAxiosError<{message?:string|string[]}>(requestError)?requestError.response?.data?.message:undefined;setError(Array.isArray(message)?message.join('. '):message||'Đăng ký thất bại. Vui lòng thử lại.')}finally{setBusy(false)}};
 const set=(k:keyof typeof form,v:string)=>setForm(f=>({...f,[k]:v}));
 return <section className="auth-container"><form className="auth-form" onSubmit={submit}>
  <div className="auth-header"><h1><i className="fa-solid fa-user-plus" /> Đăng ký</h1><p>Tạo tài khoản để mua sắm và theo dõi đơn hàng.</p></div>
  {error&&<div className="auth-message error">{error}</div>}
  <div className="form-group"><label>Họ tên</label><input value={form.fullName} onChange={e=>set('fullName',e.target.value)} required/></div>
  <div className="form-group"><label>Tên đăng nhập</label><input value={form.username} onChange={e=>set('username',e.target.value)} placeholder="ví dụ: giadungviet" required/></div>
  <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} required/></div>
  <div className="form-group"><label>Số điện thoại</label><input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}/></div>
  <div className="form-group"><label>Mật khẩu</label><div className="password-field"><input type={show1?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} required/><button type="button" className="password-toggle" onClick={()=>setShow1(v=>!v)}><i className={`fa-solid ${show1?'fa-eye-slash':'fa-eye'}`} /></button></div></div>
  <div className="form-group"><label>Nhập lại mật khẩu</label><div className="password-field"><input type={show2?'text':'password'} value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} required/><button type="button" className="password-toggle" onClick={()=>setShow2(v=>!v)}><i className={`fa-solid ${show2?'fa-eye-slash':'fa-eye'}`} /></button></div></div>
  <button type="submit" className="btn btn-primary btn-wide" disabled={busy}><i className="fa-solid fa-user-plus" /> {busy?'Đang tạo...':'Đăng ký'}</button>
  <div className="auth-footer">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></div>
 </form></section>;
}
