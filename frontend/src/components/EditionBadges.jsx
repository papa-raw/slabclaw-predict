/// EditionBadges — 1st-edition mark + language badge, ported from registry.html
/// (.ed-1st "1ˢᵗ", editionMark, langLabel). Used on tiles and card pages.

export function FirstEd({ edition }) {
  const ed = (edition || '').toLowerCase();
  if (ed !== '1st edition' && ed !== '1st') return null;
  return (
    <span className="font-bold text-white text-[10px] leading-none">
      1<sup className="text-[6px] align-super">st</sup>
    </span>
  );
}

export function LangBadge({ language }) {
  const lang = (language || 'en').toLowerCase();
  if (lang === 'en') {
    return <span className="inline-block text-[9px] font-semibold text-sc-dim border border-sc-border rounded px-1 leading-[1.4]">EN</span>;
  }
  if (lang === 'ja' || lang === 'jp') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-sc-accent border border-sc-accent/40 bg-sc-accent/10 rounded px-1 leading-[1.4]">
        <span className="text-[10px] leading-none">日</span> JP
      </span>
    );
  }
  return <span className="inline-block text-[9px] font-semibold text-sc-dim border border-sc-border rounded px-1 leading-[1.4]">{lang.toUpperCase()}</span>;
}

/** Combined: "· 1ˢᵗ  [EN/日JP]" — set-line trailing marks. */
export function EditionMarks({ edition, language, variant }) {
  const showFirst = ['1st edition', '1st'].includes((edition || '').toLowerCase());
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {showFirst && <><span className="text-sc-muted">·</span><FirstEd edition={edition} /></>}
      <LangBadge language={language} />
      {variant === 'reverse' && (
        <span className="text-[9px] font-semibold text-fuchsia-400 border border-fuchsia-400/40 bg-fuchsia-400/10 rounded px-1 leading-[1.4]">R-HOLO</span>
      )}
    </span>
  );
}
