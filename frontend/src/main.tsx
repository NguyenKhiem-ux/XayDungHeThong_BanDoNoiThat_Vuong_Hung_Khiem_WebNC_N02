// file là điểm khởi chạy của frontend react và render component app vào trang html.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import './styles/user.css';
import './styles/legacy-pages.css';
import './styles/animations.css';
import './styles/admin.css';
import './styles/admin-auth.css';
import './styles/promotions.css';
import './styles/flash-sale.css';
import './styles/product-reviews.css';

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></StrictMode>);
