/**
 * Shared nav + footer for all static pages (docs, explorer, etc.)
 * Matches the lobby's React nav and OnchainFooter exactly.
 *
 * Usage: <script src="/assets/shared-chrome.js"></script>
 * Requires elements: <nav id="shared-nav"></nav> and <div id="shared-footer"></div>
 */

(function () {
  const currentPath = window.location.pathname;
  function isActive(path) { return currentPath.startsWith(path); }

  // ── Nav ──
  const nav = document.getElementById('shared-nav');
  if (nav) {
    nav.className = 'shared-nav';
    nav.innerHTML = `
      <a href="/" class="nav-logo"><img src="/logo-icon.svg" alt="Anima Swarm" /><span>Anima Swarm</span></a>
      <div id="deity-counter" class="deity-counter"></div>
      <div class="nav-spacer"></div>
      <span class="nav-label">Sui Overflow 2026</span>
      <div class="nav-pipe"></div>
      <a href="/docs/" class="nav-link${isActive('/docs') ? ' active' : ''}">Docs</a>
      <a href="https://github.com/papa-raw/anima-swarm" target="_blank" rel="noopener" class="nav-link">GitHub</a>
      <a href="/explorer/" class="nav-link${isActive('/explorer') ? ' active' : ''}">Explorer</a>
      <div class="nav-pipe"></div>
      <a href="/" class="nav-link${currentPath === '/' ? ' active' : ''}">Play</a>
    `;
  }

  // ── Footer ──
  const footer = document.getElementById('shared-footer');

  async function loadChainInfo() {
    if (!footer) return;
    try {
      const r = await fetch('/api/game/chain-info');
      if (!r.ok) return;
      const info = await r.json();
      const sui = info.explorers?.sui || 'https://suiscan.xyz/testnet/object/';
      const dotColor2 = info.storageMode === 'testnet' ? '#22d3ee' : '#d4a052';
      footer.className = 'shared-footer';
      footer.innerHTML = `
        <div class="chain-item">
          <div class="chain-dot" style="background:#4ade80;"></div>
          <span class="chain-label">Sui testnet —</span>
          <a href="${sui}${info.contracts.package.id}" target="_blank" rel="noopener">Package</a>
        </div>
        <div class="chain-item">
          <div class="chain-dot" style="background:${dotColor2};"></div>
          <span class="chain-label">Walrus testnet —</span>
          <a href="${sui}${info.memwal.registry.id}" target="_blank" rel="noopener">Memory Registry</a>
        </div>
        <div class="chain-item">
          <div class="chain-dot" style="background:#86efac;"></div>
          <span class="chain-label">LLM —</span>
          <a href="https://windfallrouter.xyz" target="_blank" rel="noopener">Windfall Router</a>
        </div>`;
    } catch {
      if (footer) footer.innerHTML = '';
    }
  }

  // ── Deity counter ──
  async function updateDeityCounter() {
    const el = document.getElementById('deity-counter');
    if (!el) return;
    try {
      const r = await fetch('/api/game/state');
      if (!r.ok) { el.innerHTML = ''; return; }
      const state = await r.json();
      if (!state.players) { el.innerHTML = ''; return; }
      const players = Object.values(state.players);
      const connected = players.filter(p => p.connected).length;
      const total = players.length;
      let dots = '';
      players.forEach(p => {
        const bg = p.walletAddress ? '#d4a052' : p.connected ? '#4ade80' : 'var(--bg-elevated, #161b22)';
        const shadow = p.walletAddress ? 'box-shadow:0 0 4px rgba(212,160,82,0.5);' : '';
        dots += `<div style="width:6px;height:6px;border-radius:50%;background:${bg};${shadow}"></div>`;
      });
      el.innerHTML = `
        <span class="deity-count">${connected}/${total}</span>
        <span class="deity-label">deities</span>
        <div class="deity-dots">${dots}</div>`;
    } catch { if (el) el.innerHTML = ''; }
  }

  loadChainInfo();
  updateDeityCounter();
  setInterval(updateDeityCounter, 10000);
})();
