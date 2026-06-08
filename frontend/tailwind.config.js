/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // SlabClaw brand — Bloomberg-terminal dark. Reconciled to registry.html tokens.
        sc: {
          bg: '#000000',        // registry bg (was off-brand #0a0a0f)
          panel: '#0a0a0c',     // app-spec dark panel
          surface: '#111118',   // raised surface
          card: '#15151d',      // card / tile bg
          border: '#23232f',    // hairline border
          bright: '#ffffff',    // primary emphasis — hero numbers, key values
          text: '#e6e6f0',      // default text
          dim: '#aaaab8',       // secondary text
          muted: '#8a8a9c',     // tertiary / labels (was #6b6b7e — failed WCAG AA on sc-card)
          accent: '#f5c542',    // brand gold — THE single accent (strike line, links, all CTAs)
          accentHover: '#e0b020', // darker gold for CTA hover
          amber: '#f59e0b',     // caution/state only (proposed, estimated, low-balance) — NOT a CTA color
          yes: '#4CAF50',       // gain green (registry .gain)
          no: '#ef4444',        // loss red (registry .loss)
          noDim: '#cc4444',
          warn: '#f59e0b',      // kept for existing MARKET_STATE_COLORS
          // grader badge colors (real slab colors)
          psa: '#ef4444',       // PSA red
          bgs: '#D4A017',       // BGS gold
          cgc: '#3b82f6',       // CGC blue
          sgc: '#9ca3af',       // SGC slate
        },
      },
      fontFamily: {
        // registry uses system SF Pro; keep mono for numerics (terminal feel)
        display: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        brand: '1.5px',
      },
    },
  },
  plugins: [],
};
