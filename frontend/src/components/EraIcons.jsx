/// EraIcons — era glyphs ported from registry.html (base/rocket/neo/ecard/promo).

const common = {
  width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round',
};

export const EraIcon = {
  base: (p) => (
    <svg {...common} {...p}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
  ),
  rocket: (p) => (
    <svg {...common} {...p}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" /><path d="M12 15l-3-3" /><path d="M18 3l-6.16 6.16a7 7 0 00-1.81 3.27L9 15l2.58-1.03a7 7 0 003.27-1.81L21 6" /></svg>
  ),
  neo: (p) => (
    <svg {...common} {...p}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
  ),
  ecard: (p) => (
    <svg {...common} {...p}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
  ),
  promo: (p) => (
    <svg {...common} {...p}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>
  ),
};
