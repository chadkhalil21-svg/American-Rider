#!/usr/bin/env python3
"""Real XLSX/ZIP reader, synthetic nationwide data; no live API or Firestore."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

script = Path(__file__).with_name("import-national-geography.py")
spec = importlib.util.spec_from_file_location("national_geography", script)
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)
N = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def fake_files(*, invalid_metro=False, missing_county=False, duplicate=False):
    counties = ["USPS|GEOID|GEOIDFQ|NAME|ALAND|AWATER|INTPTLAT|INTPTLONG"]
    county_ids = []
    for state in sorted(geo.STATES):
        for i in range(61):
            fips = state + f"{2*i+1:03}"
            county_ids.append(fips)
            counties.append(f"XX|{fips}|0500000US{fips}|County {fips}|10|0|0|0")
    if missing_county:
        counties = [c for c in counties if "|01001|" not in c]
    if duplicate:
        counties.append(counties[1])
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("2025_gaz_counties_national.txt", "\n".join(counties))

    # Inline-string XLSX with the real Census column names and row-3 headers.
    xmlns = "{%s}" % N
    root = ET.Element(xmlns + "worksheet")
    sheet = ET.SubElement(root, xmlns + "sheetData")
    def add_row(number, values):
        row = ET.SubElement(sheet, xmlns + "row", {"r": str(number)})
        for ci, val in enumerate(values):
            col = chr(ord("A") + ci)
            cell = ET.SubElement(row, xmlns + "c",
                {"r": f"{col}{number}", "t": "inlineStr"})
            inline = ET.SubElement(cell, xmlns + "is")
            ET.SubElement(inline, xmlns + "t").text = str(val)
    add_row(1, ["US Census Bureau List 1"])
    add_row(2, ["July 2023"])
    add_row(3, ["CBSA Code", "CBSA Title",
        "Metropolitan/Micropolitan Statistical Area",
        "FIPS State Code", "FIPS County Code"])
    for i, fips in enumerate(county_ids[:2200]):
        add_row(i + 4, ["12345", "Synthetic Area",
            "Unknown" if invalid_metro and i == 0 else
            ("Metropolitan Statistical Area" if i < 1600 else "Micropolitan Statistical Area"),
            fips[:2], fips[2:]])
    buf2 = io.BytesIO()
    with zipfile.ZipFile(buf2, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("xl/worksheets/sheet1.xml", ET.tostring(root, encoding="utf-8"))
    return buf.getvalue(), buf2.getvalue()


class GeographyTests(unittest.TestCase):
    def test_two_complete_nationwide_runs(self):
        raw_zip, raw_xlsx = fake_files()
        for _ in range(2):
            result = geo.build(raw_zip, raw_xlsx)
            self.assertEqual(result["status"], "research-only")
            self.assertFalse(result["bookable"])
            self.assertFalse(result["marketPricesVerified"])
            self.assertEqual(len(result["counties"]), 3111)
            self.assertEqual(set(f[:2] for f in result["counties"]), geo.STATES)
            self.assertEqual(sum(result["counts"].values()), 3111)
            self.assertGreater(result["counts"]["nonmetro"], 500)
            self.assertEqual(result["counties"]["01001"]["category"], "metro")
            with tempfile.TemporaryDirectory() as td:
                a = Path(td) / "county.zip"
                b = Path(td) / "cbsa.xlsx"
                o = Path(td) / "out.json"
                a.write_bytes(raw_zip)
                b.write_bytes(raw_xlsx)
                parsed = geo.build(a.read_bytes(), b.read_bytes())
                o.write_text(json.dumps(parsed))
                self.assertEqual(json.loads(o.read_text()), result)

    def test_bad_data_fail_closed(self):
        for options in ({"invalid_metro": True},
                        {"missing_county": True},
                        {"duplicate": True}):
            with self.subTest(options=options):
                a, b = fake_files(**options)
                with self.assertRaises(ValueError):
                    geo.build(a, b)
        with self.assertRaises(ValueError):
            geo.build(b"invalid zip", fake_files()[1])
        with self.assertRaises(ValueError):
            geo.build(fake_files()[0], b"invalid xlsx")
        with self.assertRaises(ValueError):
            geo.download("http://random-price-provider.example/data")


if __name__ == "__main__":
    unittest.main()
