const cartografia = {
  id: 'cartografia-poetica',
  color: '#ffffff',
  logo: '/branding/cartografia-icon.png',
  favicon: '/branding/cartografia-icon.png',
  onboardingBackground: '/branding/cartografia-lisboa.webp',
  mapStyle: 'backdrop-v4-light',
  routeColor: '#8a6900',
  routeHistoryColor: '#858585'
};

const classic = {
  id: 'classic',
  color: '#163832',
  logo: '/branding/literary-map-icon.png',
  favicon: '/branding/favicon.png',
  onboardingBackground: '/images/aayush-gupta-ljhCEaHYWJ8-unsplash.jpg',
  mapStyle: 'streets-v2',
  routeColor: '#c45732',
  routeHistoryColor: '#315b52'
};

export const cartografiaIcons = [
  { src: cartografia.logo, sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/branding/cartografia-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/branding/cartografia-icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];

export function cityTheme(slug = 'lisboa') {
  return slug === 'lisboa' ? cartografia : classic;
}
