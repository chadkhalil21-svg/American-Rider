#!/usr/bin/env python3
"""No network. Malformed/suppressed/ambiguous evidence must never set live fares."""
import importlib.util
import json
from pathlib import Path
import unittest

path = Path(__file__).with_name("collect-national-pricing-evidence.py")
spec = importlib.util.spec_from_file_location("economic_sources", path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

SAMPLE = [
    {"trip_start_timestamp": "2026-07-13T13:15:00", "trip_miles": "3.4",
     "trip_seconds": "732", "fare": "12.50", "tip": "1.00",
     "additional_charges": "2.50", "trip_total": "16.00"},
    {"trip_start_timestamp": "2026-07-13T15:45:00", "trip_miles": "9.2",
     "trip_seconds": "1450", "fare": "22.50", "tip": "0",
     "additional_charges": "3.00", "trip_total": "25.50"},
]
BLS = (
    "AREA\tAREA_TITLE\tOCC_CODE\tOCC_TITLE\tNAICS\tI_GROUP\tH_MEDIAN\n"
    "33100\tMiami-Fort Lauderdale-West Palm Beach, FL\t53-3054\tTaxi Drivers\t000000\tcross-industry\t18.50\n"
    "33100\tMiami-Fort Lauderdale-West Palm Beach, FL\t53-3053\tShuttle Drivers\t000000\tcross-industry\t*\n"
    "99999\tFake area\t11-1011\tExecutives\t000000\tcross-industry\t200\n"
).encode()

class ResearchEvidence(unittest.TestCase):
    def test_irs_is_explicit_tax_proxy_never_live_pricing(self):
        for _ in range(2):
            r=m.build_report(as_of="2026-10-12")
            self.assertEqual(r["vehicle"]["centsPerMile"],76)
            self.assertFalse(r["vehicle"]["actualCostsVerified"])
            self.assertFalse(r["nationalPricingCertified"])
            self.assertFalse(r["farePromotionAllowed"])
            self.assertFalse(r["tenPercentBelowMarketVerified"])
            self.assertEqual(r["wages"]["loadedPublishedAreaOccupationRecords"],0)
            self.assertFalse(r["market"]["livePassengerQuotes"])

    def test_valid_bls_native_rows_do_not_become_operator_net_or_county_mapping(self):
        r=m.build_report(bls_raw=BLS)
        self.assertEqual(r["wages"]["loadedPublishedAreaOccupationRecords"],1)
        self.assertEqual(r["wages"]["areaRecords"]["33100:53-3054"]["hourlyMedianUSD"],18.5)
        self.assertFalse(r["wages"]["countyCrosswalkVerified"])
        self.assertFalse(r["wages"]["operatorNetHourlyTargetVerified"])
        self.assertFalse(r["tenPercentBelowMarketVerified"])

    def test_bls_rejects_suppressed_only_malformed_and_conflicts(self):
        for bad in (b"AREA,PLACE,WAGE\n33100,Miami,20", 
                    b"AREA,AREA_TITLE,OCC_CODE,H_MEDIAN\n33100,Miami,53-3054,*\n",
                    b"AREA,AREA_TITLE,OCC_CODE,H_MEDIAN\n33100,Miami,53-3054,inf\n",
                    b"AREA,AREA_TITLE,OCC_CODE,H_MEDIAN\n33100,Miami,53-3054,20\n"
                    b"33100,Miami,53-3054,21\n"):
            with self.subTest(bad=bad[:40]):
                with self.assertRaises(ValueError):
                    m.wage_records(bad)

    def test_city_total_is_historical_sample_and_includes_tip(self):
        for _ in range(2):
            r=m.build_report(chicago_raw=json.dumps(SAMPLE).encode())
            market=r["market"]
            self.assertEqual(market["sampleSize"],2)
            self.assertEqual(market["medianFullTripCentsIncludingTips"],2075)
            self.assertFalse(market["representative"])
            self.assertFalse(market["livePassengerQuotes"])
            self.assertFalse(market["priceComparableWithoutRouteAndTollMatching"])
            self.assertFalse(r["tenPercentBelowMarketVerified"])

    def test_invalid_city_data_fails_closed(self):
        for rows in (
            [], [{}], [{"trip_total": "NaN", **SAMPLE[0]}],
            [{"trip_total": "1600", **SAMPLE[0]}],
            [dict(SAMPLE[0],trip_start_timestamp="2030-01-01T00:00:00")],
        ):
            with self.subTest(rows=rows):
                with self.assertRaises(ValueError):
                    m.build_report(chicago_raw=json.dumps(rows).encode())
        with self.assertRaises(ValueError):
            m.fare_sample(SAMPLE * 101)

    def test_future_and_old_irs_source_rejected(self):
        for date in ("2026-01-01", "2027-01-01"):
            with self.assertRaises(ValueError):
                m.build_report(as_of=date)

    def test_national_fake_quotes_are_not_verification(self):
        for i in range(200):
            rows=[dict(SAMPLE[0],trip_miles=str(1+(i%25)),
                       trip_total=str(16),fare=str(12.5))]
            r=m.build_report(chicago_raw=json.dumps(rows).encode())
            self.assertFalse(r["nationalPricingCertified"])
            self.assertFalse(r["tenPercentBelowMarketVerified"])

if __name__ == "__main__":
    unittest.main()
