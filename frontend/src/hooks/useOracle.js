/// useOracle — fetch oracle price data from SlabClaw backend API.

import { useState, useEffect } from 'react';

export function useOraclePrice(productId, grader = 'PSA', grade = 10) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);

    fetch(`/api/v3/product/${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.product) {
          // Oracles are at top level, not inside product
          const oracles = json.oracles || [];
          const match = oracles.find(
            (o) => o.grader === grader && o.grade === grade
          );
          setData({
            price: match?.price || null,
            source: match?.source || null,
            tier: match?.tier || null,
            saleCount: match?.sale_count || 0,
            name: json.product.name,
            set: json.product.set_name,
            image: json.product.image,
            allOracles: oracles,
          });
        } else {
          setError('Product not found');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [productId, grader, grade]);

  return { data, loading, error };
}
