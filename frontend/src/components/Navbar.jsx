import { useEffect, useState } from 'react'
import { readCart } from '../services/cart'
import Logo from './Logo'
import Cart from './Cart'

const links = [
  { label: 'Home', href: '/', page: 'home' },
  { label: 'Loja', href: '/loja', page: 'store' },
  { label: 'Clube', href: '/clube', page: 'plans' },
  { label: 'Taste Finder', href: '/quiz', page: 'quiz' },
  { label: 'Minha conta', href: '/conta', page: 'account' },
]
const defaultVisibleLinks = [...links.map(({ page }) => page), 'cart']

function getCartCount() {
  return readCart().items.reduce((count, item) => count + item.quantity, 0)
}

function Navbar({
  activePage,
  cartCount: cartCountOverride,
  visibleLinks = defaultVisibleLinks,
}) {
  const [cartCount, setCartCount] = useState(getCartCount)
  const displayedCartCount = cartCountOverride ?? cartCount
  const visibleLinkSet = new Set(visibleLinks)

  useEffect(() => {
    function updateCartCount() {
      setCartCount(getCartCount())
    }

    window.addEventListener('origin-cart-updated', updateCartCount)
    window.addEventListener('storage', updateCartCount)
    return () => {
      window.removeEventListener('origin-cart-updated', updateCartCount)
      window.removeEventListener('storage', updateCartCount)
    }
  }, [])

  return (
    <header className="site-navigation">
      <a className="site-navigation__brand" href="/" aria-label="Origin & Beans, início">
        <Logo className="site-navigation__logo" />
        <span>Origin <em>&amp;</em> <b>Beans</b></span>
      </a>
      <nav className="site-navigation__links" aria-label="Navegação principal">
        {links.filter(({ page }) => visibleLinkSet.has(page)).map(({ label, href, page }) => (
          <a key={page} href={href} aria-current={activePage === page ? 'page' : undefined}>
            {label}
          </a>
        ))}
        {visibleLinkSet.has('cart') && (
          <a
            className="site-navigation__cart"
            href="/carrinho"
            aria-current={activePage === 'cart' ? 'page' : undefined}
            aria-label={`Carrinho com ${displayedCartCount} ${displayedCartCount === 1 ? 'item' : 'itens'}`}
          >
            <Cart className="site-navigation__cart-icon" />
            <span>({displayedCartCount})</span>
          </a>
        )}
      </nav>
    </header>
  )
}

export default Navbar
