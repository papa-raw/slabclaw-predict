#!/usr/bin/env python3
"""build-snapshot.py — Build the demo registry snapshot DIRECTLY from the
SlabClaw SQLite DB (read-only), independent of the (sometimes-hung) API.

Produces frontend/src/data/registry-snapshot.json in the exact shape the
frontend selectors expect (product, oracles, pop, soldComps, soldTransactions,
history, bands). Reading the DB read-only does not disturb the registry app.
"""
import json, sqlite3, os

DB = "/Users/pat/Desktop/1_projects/slabclaw/slabclaw-app/backend/data/slabclaw.db"
OUT = os.path.join(os.path.dirname(__file__), "../frontend/src/data/registry-snapshot.json")
CARDS = ["jp-vs-091", "neo1-1st-18", "base5-1st-83", "base2-1st-3"]  # Umbreon, Typhlosion, Dark Raichu, Flareon

con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
con.row_factory = sqlite3.Row

# Never surface upstream aggregator links/hosts in the shipped snapshot.
def clean_url(u):
    return None if (u and "pricecharting" in u.lower()) else u
LOCAL_IMG = {"jp-vs-091": "/cards/jp-vs-091.jpg"}
def clean_img(pid, u):
    if pid in LOCAL_IMG: return LOCAL_IMG[pid]
    return None if (u and "pricecharting" in u.lower()) else u

def q(sql, args=()):
    return [dict(r) for r in con.execute(sql, args).fetchall()]

def build(pid):
    prod = q("""SELECT p.id, p.name, p.number, p.variant, COALESCE(s.name,'') setname,
                COALESCE(s.edition,'') edition, COALESCE(s.language,'en') lang, p.image, p.set_id
                FROM products p LEFT JOIN sets s ON p.set_id=s.id WHERE p.id=?""", (pid,))[0]
    product = {
        "id": prod["id"], "name": prod["name"], "number": prod["number"],
        "variant": prod["variant"], "set": prod["setname"], "setId": prod["set_id"],
        "edition": prod["edition"], "language": prod["lang"], "image": clean_img(pid, prod["image"]),
    }

    oracles = [{
        "grader": o["grader"], "grade": o["grade"], "price": o["price"], "tier": o["tier"],
        "source": o["source"], "saleCount": o["sale_count"], "graderMatched": o["grader_matched"],
        "pcDisplay": o["pc_display"], "updatedAt": o["updated_at"],
    } for o in q("SELECT * FROM current_oracle WHERE product_id=? AND price IS NOT NULL", (pid,))]

    pop = []
    for r in q("SELECT * FROM current_pop WHERE product_id=?", (pid,)):
        try: grades = json.loads(r["grade_array"])
        except Exception: grades = []
        meta = None
        try: meta = json.loads(r["pop_meta"]) if r["pop_meta"] else None
        except Exception: meta = None
        pop.append({"grader": r["grader"], "totalGraded": r["total_graded"], "grades": grades, "popMeta": meta})

    # PSA comps (8/9/10) — chart uses PSA 10 only; include a couple grades for context
    soldComps = [{
        "id": c["id"], "product_id": c["product_id"], "grader": c["grader"], "grade": c["grade"],
        "source": "comp", "price": c["price"], "sale_date": c["sale_date"], "title": None, "url": clean_url(c["url"]),
    } for c in q("""SELECT * FROM sold_comps WHERE product_id=? AND grader='PSA' AND grade IN (8,9,10)
                    AND sale_date IS NOT NULL ORDER BY sale_date""", (pid,))]

    soldTransactions = [{
        "platform": t["platform"], "salePrice": t["sale_price"], "saleDate": t["sale_date"],
        "saleType": t["sale_type"], "grader": t["grader"], "grade": t["grade"],
        "certNumber": t["cert_number"], "url": clean_url(t["listing_url"]), "title": t["raw_title"],
    } for t in q("""SELECT * FROM sold_transactions WHERE product_id=? AND grader='PSA' AND grade IN (8,9,10)
                    AND sale_date IS NOT NULL ORDER BY sale_date""", (pid,))]

    history = [{
        "grader": h["grader"], "grade": h["grade"], "price": h["price"],
        "source": h["source"], "sale_count": h["sale_count"], "observed_at": h["observed_at"],
    } for h in q("""SELECT * FROM price_observations WHERE product_id=? AND grader='PSA' AND grade IN (8,9,10)
                    ORDER BY observed_at""", (pid,))]

    trendGrades = [{
        "grader": t["grader"], "grade": t["grade"], "pct": t["pct_change"], "days": t["day_span"],
        "comps": t["comp_count"], "oldAvg": t["old_avg"], "newAvg": t["new_avg"],
        "dateRange": f'{t["old_date_start"]} → {t["new_date_end"]}',
    } for t in q("SELECT * FROM product_trends WHERE product_id=?", (pid,))]

    # bands ← active listings grouped by grade_band
    listings = q("""SELECT * FROM v3_listings WHERE product_id=? AND stale=0 AND price_usd>0
                    ORDER BY grade_band DESC, price_usd ASC""", (pid,))
    bands = {}
    for l in listings:
        gb = l["grade_band"]
        if gb is None: continue
        b = bands.setdefault(gb, {"grade_band": gb, "oracle_anchor": None, "listings": []})
        if b["oracle_anchor"] is None and l["oracle_price"] is not None:
            b["oracle_anchor"] = {"price": l["oracle_price"], "tier": l["oracle_tier"]}
        b["listings"].append({
            "platform": l["platform"], "grader": l["grader"], "grade": l["grade"], "grade_band": gb,
            "price": l["price_usd"], "spread": l["spread"], "oracle_price": l["oracle_price"],
            "oracle_tier": l["oracle_tier"], "grader_matched": l["grader_matched"],
            "url": clean_url(l["url"]), "title": l["title"], "pop_exact": l["pop_exact"], "pop_total": l["pop_total"],
            "listing_type": l["listing_type"], "marketplace": l["marketplace_id"], "condition": l["condition_id"],
        })
    bands = sorted(bands.values(), key=lambda b: -(b["grade_band"] or 0))

    return {
        "id": pid, "product": product, "oracles": oracles, "pop": pop,
        "trendGrades": trendGrades, "history": history,
        "soldComps": soldComps, "soldTransactions": soldTransactions, "bands": bands,
    }

out = {pid: build(pid) for pid in CARDS}
json.dump(out, open(OUT, "w"), indent=0)
print("wrote", OUT, "(", os.path.getsize(OUT), "bytes )")
for pid in CARDS:
    c = out[pid]
    psa10 = [s for s in c["soldComps"] if s["grade"] == 10] + [s for s in c["soldTransactions"] if s["grade"] == 10]
    o10 = next((o for o in c["oracles"] if o["grader"] == "PSA" and o["grade"] == 10), None)
    print(f"  {pid:14} {c['product']['name']:16} PSA10 comps={len(psa10):3}  oracle=${round(o10['price']) if o10 else '?'}  bands={len(c['bands'])}  hist={len(c['history'])}")
