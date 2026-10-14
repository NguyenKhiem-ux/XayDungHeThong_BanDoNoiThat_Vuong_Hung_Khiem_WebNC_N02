import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function FavoriteButton({ productId, className = '' }: { productId: number; className?: string }) {
  const { user, favoriteIds, favoritesReady, toggleFavorite } = useAuth();
  const saved = favoriteIds.includes(productId);
  const click = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      window.dispatchEvent(new CustomEvent('toast', { detail: 'Vui lòng đăng nhập để lưu sản phẩm yêu thích.' }));
      window.location.assign('/login');
      return;
    }
    try {
      await toggleFavorite(productId);
      window.dispatchEvent(new CustomEvent('toast', { detail: saved ? 'Đã xóa khỏi yêu thích.' : 'Đã thêm vào yêu thích.' }));
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: 'Không thể cập nhật danh sách yêu thích. Vui lòng thử lại.' }));
    }
  };
  return <button type="button" className={`favorite-button ${saved ? 'is-saved' : ''} ${className}`} aria-label={saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'} aria-pressed={saved} disabled={!!user && !favoritesReady} onClick={click}>
    <Heart size={19} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>;
}
