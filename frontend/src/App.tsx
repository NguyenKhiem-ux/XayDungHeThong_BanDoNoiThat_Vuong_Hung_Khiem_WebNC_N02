// file là component gốc của frontend và cấu hình routing cho toàn bộ ứng dụng.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toast } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { UserLayout } from './layouts/UserLayout';
import { AboutPage } from './pages/AboutPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductListPage } from './pages/ProductListPage';
import { RegisterPage } from './pages/RegisterPage';
import { SuccessPage } from './pages/SuccessPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { MessagesAdminPage } from './pages/admin/MessagesAdminPage';
import { OrdersAdminPage } from './pages/admin/OrdersAdminPage';
import { ProductAdminPage } from './pages/admin/ProductAdminPage';
import { RevenueAdminPage } from './pages/admin/RevenueAdminPage';
import { UsersAdminPage } from './pages/admin/UsersAdminPage';
import { ChatbotKnowledgePage } from './pages/admin/ChatbotKnowledgePage';
import { CouponsAdminPage } from './pages/admin/CouponsAdminPage';
import { PoliciesPage } from './pages/PoliciesPage';

export function App() {
  return <BrowserRouter>
    <Routes>
      <Route path="/admin/login" element={<LoginPage admin />} />
      <Route element={<ProtectedRoute role="ADMIN" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="products" element={<ProductAdminPage />} />
          <Route path="orders" element={<OrdersAdminPage />} />
          <Route path="coupons" element={<CouponsAdminPage />} />
          <Route path="users" element={<UsersAdminPage />} />
          <Route path="messages" element={<MessagesAdminPage />} />
          <Route path="revenue" element={<RevenueAdminPage />} />
          <Route path="chatbot/knowledge" element={<ChatbotKnowledgePage />} />
        </Route>
      </Route>
      <Route element={<UserLayout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="verify-otp" element={<VerifyOtpPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="checkout/info" element={<CheckoutPage />} />
          <Route path="checkout/payment" element={<CheckoutPage />} />
          <Route path="checkout/invoice" element={<CheckoutPage />} />
          <Route path="checkout/success/:orderId" element={<SuccessPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    <Toast />
  </BrowserRouter>;
}
