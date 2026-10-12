#!/usr/bin/env python3
"""Independent research evidence only: NO fare, Firestore or market activation writes.

Chicago records are reported historical transactions, not real-time quotes.
BLS estimates are employee wages, NOT independent-Operator net income.
IRS mileage rates are tax deductions, NOT local actual vehicle operating costs.
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import statistics
import urllib.parse
import urllib.request

CHICAGO_DATASET = "6dvr-xwnh"
CHICAGO_URL = "https://data.cityofchicago.org/resource/" + CHICAGO_DATASET + ".json"
BLS_RELEASE = "https://www.bls.gov/oes/tables.htm"
IRS_RELEASE = "https://www.irs.gov/tax-professionals/standard-mileage-rates"
# Verified against IRS Announcement 2026-11. A TAX proxy, not a local driver cost.
IRS_2026_SECOND_HALF_CENTS_PER_MILE = 76
BLS_OCCUPATIONS = {"53-3054", "53-3053"}  # Taxi drivers and shuttle drivers/chauffeurs.
MAX_SAMPLE = 200
STATES = set("01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 "
             "24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 "
             "45 46 47 48 49 50 51 53 54 55 56".split())


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def iso_date(value: str) -> dt.date:
    return dt.date.fromisoformat(value[:10])


def wage_records(raw: bytes) -> dict:
    """Accept BLS native all-data TXT/CSV after authenticated source verification.

    No implicit national, state or metro fallback; BLS nonmetro boundaries are
    not assumed to be equal to Census 2023 CBSA categories.
    """
    try:
        decoded = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("BLS wage file is not valid UTF-8") from exc
    first = decoded.splitlines()[0] if decoded.splitlines() else ""
    delimiter = "\t" if "\t" in first else ","
    rows = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
    required = {"AREA", "AREA_TITLE", "OCC_CODE", "H_MEDIAN"}
    if not rows.fieldnames or not required.issubset({s.upper() for s in rows.fieldnames}):
        raise ValueError("Unrecognized BLS OEWS area wage header")
    result = {}
    for original in rows:
        r = {k.upper(): (v or "").strip() for k, v in original.items() if k}
        if r.get("OCC_CODE") not in BLS_OCCUPATIONS:
            continue
        if r.get("I_GROUP", "cross-industry").lower() not in ("cross-industry", "cross industry", ""):
            continue
        if r.get("NAICS", "000000") not in ("000000", ""):
            continue
        area = r["AREA"]
        # Native OEWS geographical codes are NOT the same as county FIPS.
        if not (area.isdigit() and 2 <= len(area) <= 7):
            continue
        raw_median = r["H_MEDIAN"].replace(",", "").replace("$", "")
        if raw_median in ("", "*", "#", "**", "N/A"):
            continue
        try:
            amount = float(raw_median)
        except ValueError:
            raise ValueError("Unrecognized BLS wage value") from None
        if not math.isfinite(amount) or not 1 <= amount <= 300:
            raise ValueError("Invalid published BLS hourly wage estimate")
        key = area + ":" + r["OCC_CODE"]
        value = {"area": area, "occupation": r["OCC_CODE"],
                 "areaTitle": r["AREA_TITLE"], "hourlyMedianUSD": round(amount, 2)}
        if key in result and result[key] != value:
            raise ValueError("Conflicting BLS occupation area records")
        result[key] = value
    if not result:
        raise ValueError("No unsuppressed area estimates for named driver occupations")
    return dict(sorted(result.items()))


def fare_sample(rows: list) -> dict:
    """Chicago city trip data is sampled only, not treated as a live market."""
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_SAMPLE:
        raise ValueError("Missing/unbounded Chicago source sample")
    totals = []
    dates = []
    for r in rows:
        if not isinstance(r, dict):
            raise ValueError("Malformed official sample row")
        try:
            miles = float(r["trip_miles"])
            seconds = float(r["trip_seconds"])
            fare = float(r["fare"])
            tip = float(r.get("tip", 0) or 0)
            charges = float(r["additional_charges"])
            total = float(r["trip_total"])
        except (KeyError, ValueError, TypeError):
            # Withheld/suppressed records are not zero-price journeys.
            continue
        if not all(math.isfinite(x) for x in (miles, seconds, fare, tip, charges, total)):
            raise ValueError("Invalid numerical observation")
        if not (0 < miles < 250 and 0 < seconds < 10 * 3600 and
                0 <= fare < 2000 and 0 <= tip < 1000 and
                0 <= charges < 1000 and 0 < total < 4000):
            continue
        # Rounded published components may not sum to the unrounded total.
        # Do not silently assume breakdown of tolls, taxes or airport fees.
        if abs(total - (fare + tip + charges)) > 4.00:
            continue
        try:
            date = iso_date(r["trip_start_timestamp"])
        except (KeyError, ValueError, TypeError):
            continue
        dates.append(date)
        # Full amount paid includes discretionary tip: not a comparable quote.
        totals.append(round(total * 100))
    if not totals:
        raise ValueError("No usable published TNC observations")
    return {
        "dataset": CHICAGO_DATASET,
        "source": "City of Chicago TNP 2025+ published trip reports",
        "sourceUrl": "https://data.cityofchicago.org/d/" + CHICAGO_DATASET,
        "sampleSize": len(totals),
        "startDate": min(dates).isoformat(),
        "endDate": max(dates).isoformat(),
        "medianFullTripCentsIncludingTips": int(statistics.median(totals)),
        "representative": False,
        "livePassengerQuotes": False,
        "priceComparableWithoutRouteAndTollMatching": False,
        "limitations": "Order-dependent <=200 rows; rounded fares, tips and charges; historic completed trips; no real-time quote or sufficient nationwide coverage",
    }


def limited_chicago_download() -> bytes:
    # One bounded public-source query for a periodic *audit*, never per ride.
    # No trip IDs, GPS coordinates, rider or Operator personal information.
    params = {
        "$select": "trip_start_timestamp,trip_miles,trip_seconds,fare,tip,additional_charges,trip_total",
        "$limit": str(MAX_SAMPLE)
    }
    url = CHICAGO_URL + "?" + urllib.parse.urlencode(params)
    if not url.startswith("https://data.cityofchicago.org/resource/6dvr-xwnh.json?"):
        raise ValueError("Unexpected external source")
    req = urllib.request.Request(url, headers={
        "User-Agent": "American-Rider-public-research/1.0",
        "Accept": "application/json"
    })
    with urllib.request.urlopen(req, timeout=25) as response:
        payload = response.read(350_001)
    if not payload or len(payload) > 350_000:
        raise ValueError("Empty or oversized public city response")
    return payload


def build_report(*, chicago_raw: bytes | None = None, bls_raw: bytes | None = None,
                 as_of: str = "2026-10-12") -> dict:
    date = dt.date.fromisoformat(as_of)
    if not dt.date(2026, 7, 1) <= date <= dt.date(2026, 12, 31):
        raise ValueError("Vehicle benchmark outside verified IRS period; refresh source")
    wages = wage_records(bls_raw) if bls_raw is not None else {}
    sampled = fare_sample(json.loads(chicago_raw)) if chicago_raw is not None else None
    if sampled and iso_date(sampled["endDate"]) > date:
        raise ValueError("Published trip is future-dated")
    return {
        "status": "research-only",
        "bookable": False, "farePromotionAllowed": False,
        "tenPercentBelowMarketVerified": False,
        "nationalPricingCertified": False,
        "asOf": as_of,
        "vehicle": {
            "benchmark": "IRS business standard mileage TAX rate, not actual Operator fleet expense",
            "centsPerMile": IRS_2026_SECOND_HALF_CENTS_PER_MILE,
            "validFrom": "2026-07-01", "validThrough": "2026-12-31",
            "source": IRS_RELEASE,
            "actualCostsVerified": False,
            "localInsuranceFuelDepreciationVerified": False,
            "noDoubleCounting": "Do not add fuel/depreciation already approximated by this proxy.",
        },
        "wages": {
            "source": BLS_RELEASE, "release": "2025-05",
            "loadedPublishedAreaOccupationRecords": len(wages),
            "sha256": digest(bls_raw) if bls_raw is not None else None,
            "areaRecords": wages,
            "countyCrosswalkVerified": False,
            "operatorNetHourlyTargetVerified": False,
            "note": "BLS employees' median hourly wages are not net contractor earnings.",
        },
        "market": sampled or {"source": CHICAGO_URL, "status": "not-connected",
                             "livePassengerQuotes": False},
        "missingForRelease": [
            "BLS verified May 2025 native source file and matching OEWS county definitions",
            "Locally measured fixed/variable vehicle costs and commercial insurance",
            "Actual Operator net hourly targets and deadhead utilization",
            "Representative route-matched, independently sourced, legally usable current traveler totals",
            "Full company cost and per-jurisdiction admission and physical-device evidence",
        ],
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--chicago-json", type=Path)
    p.add_argument("--fetch-chicago", action="store_true")
    p.add_argument("--bls-raw", type=Path)
    p.add_argument("--as-of", default="2026-10-12")
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()
    if args.chicago_json and args.fetch_chicago:
        p.error("Supply offline Chicago file OR one live sample, not both")
    chicago = (args.chicago_json.read_bytes() if args.chicago_json else
               limited_chicago_download() if args.fetch_chicago else None)
    bls = args.bls_raw.read_bytes() if args.bls_raw else None
    report = build_report(chicago_raw=chicago, bls_raw=bls, as_of=args.as_of)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, sort_keys=True, separators=(",", ":")) + "\n")
    print("Research-only; BLS wage rows:", report["wages"]["loadedPublishedAreaOccupationRecords"],
          "City TNC sample:", report["market"].get("sampleSize", 0),
          "10%-below-market verified:", report["tenPercentBelowMarketVerified"])


if __name__ == "__main__":
    main()
