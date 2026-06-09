/// LegalPage — legal notices & disclaimers (#legal), reached from the footer.
///
/// Protective posture for Ecofrontiers SARL even though this is a hackathon prototype:
/// demonstration-only / testnet / no monetary value, not financial advice, public factual
/// price data with no marketplace affiliation, third-party IP acknowledgement, PII
/// redaction, and an as-is warranty disclaimer. Plain-language, but it reflects the data-
/// rights analysis (facts aren't copyrightable; public data; good-faith sampling; redaction).

const UPDATED = 'June 2026';

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h3 className="text-[13px] font-semibold text-white mb-1.5">{title}</h3>
      <div className="text-[12px] leading-relaxed text-sc-dim space-y-2">{children}</div>
    </section>
  );
}

export default function LegalPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 lg:px-6 py-7 pb-32">
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-sc-accent uppercase tracking-wide mb-1.5">Legal &amp; disclaimers</div>
        <h2 className="text-xl lg:text-2xl font-bold text-white">Notices &amp; disclaimers</h2>
        <p className="text-sc-muted mt-1 text-[11px]">Last updated {UPDATED} · a project of Ecofrontiers SARL</p>
      </div>

      <Section title="Demonstration software — no monetary value">
        <p>
          SlabClaw Predict is a research prototype built for Sui Overflow 2026 (Walrus track) and runs on the
          Sui <strong className="text-sc-text">testnet</strong>. “tUSD” is a valueless test token minted from a
          faucet; positions carry <strong className="text-sc-text">no monetary value</strong> and cannot be
          redeemed for anything. Nothing here is an offer, solicitation, or facility to trade, stake, or
          wager anything of value.
        </p>
      </Section>

      <Section title="Not financial, investment, or legal advice">
        <p>
          The prediction markets and oracle prices shown are for demonstration and research only. They are
          not investment, financial, or legal advice, not a regulated financial product, and not offered
          where such activity is restricted or prohibited. Do not rely on any price, signal, range, or
          outcome shown here for any real-world decision.
        </p>
      </Section>

      <Section title="Price data &amp; sources">
        <p>
          Oracle values are computed from <strong className="text-sc-text">publicly available, factual</strong>{' '}
          marketplace data — such as listed and completed-sale prices. Factual prices are not, in themselves,
          subject to copyright. We collect small factual samples in good faith, do not reproduce third-party
          copyrighted page content, and <strong className="text-sc-text">redact personal and seller data</strong>{' '}
          before any evidence is published to Walrus.
        </p>
        <p>
          SlabClaw and Ecofrontiers SARL are <strong className="text-sc-text">not affiliated with, endorsed by,
          or sponsored by</strong> eBay, PriceCharting, Cardmarket, ALT, Goldin, Fanatics/PWCC, TCGPlayer,
          Yahoo, Courtyard, Beezie, Collector Crypt, PSA, BGS, CGC, SGC, or any marketplace or grading service
          referenced. All such names and marks are the property of their respective owners and are used here
          only for identification, comparison, and commentary.
        </p>
      </Section>

      <Section title="Collectible &amp; card intellectual property">
        <p>
          Pokémon and all related names, characters, and card images are trademarks and copyrights of
          Nintendo, Creatures Inc., GAME FREAK inc., and The Pokémon Company. SlabClaw is not affiliated with
          or endorsed by them. Card imagery is used solely to identify and comment on the specific graded
          asset a given market references.
        </p>
      </Section>

      <Section title="No warranty &amp; limitation of liability">
        <p>
          This prototype is provided <strong className="text-sc-text">“as is,” without warranties of any kind</strong>,
          express or implied. Prices, signals, and outcomes may be inaccurate, delayed, incomplete, or
          unavailable. To the maximum extent permitted by law, Ecofrontiers SARL disclaims all liability
          arising from or relating to use of this prototype.
        </p>
      </Section>

      <Section title="Operator">
        <p>
          SlabClaw Predict is a project of <strong className="text-sc-text">Ecofrontiers SARL</strong>. Questions
          or rights requests: <a href="mailto:support@slabclaw.com" className="text-sc-accent hover:underline">support@slabclaw.com</a>.
        </p>
      </Section>

      <p className="text-[11px] text-sc-muted border-t border-sc-border/60 pt-4">
        © 2026 Ecofrontiers SARL. Testnet demonstration for Sui Overflow 2026. Not financial advice.
      </p>
    </main>
  );
}
