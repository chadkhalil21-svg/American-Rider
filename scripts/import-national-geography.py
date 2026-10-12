#!/usr/bin/env python3
"""Build a read-only, versioned U.S. county -> metro/micro/nonmetro reference.

Only official Census downloads; no Firestore, payments, commercial pricing,
market admission, or automatic re-pricing. Python standard library only.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

COUNTY_URL = ("https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
              "2025_Gazetteer/2025_Gaz_counties_national.zip")
CBSA_URL = ("https://www2.census.gov/programs-surveys/metro-micro/"
            "geographies/reference-files/2023/delineation-files/list1_2023.xlsx")
STATES = set("01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 "
             "24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 "
             "45 46 47 48 49 50 51 53 54 55 56".split())
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REF_PATTERN = re.compile(r"([A-Z]+)[0-9]+")


def download(url: str, limit: int = 5_000_000) -> bytes:
    if url not in (COUNTY_URL, CBSA_URL):
        raise ValueError("Unapproved download host or source")
    with urllib.request.urlopen(urllib.request.Request(
            url, headers={"User-Agent": "American-Rider-Geographic-Research/1.0"}),
            timeout=30) as response:
        raw = response.read(limit + 1)
    if not raw or len(raw) > limit:
        raise ValueError("Official geographic file empty or exceeded size bound")
    return raw


def xlsx_rows(raw: bytes):
    if len(raw) > 4_000_000:
        raise ValueError("Census delineation file too large")
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise ValueError('Invalid official XLSX archive')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = set(z.namelist())
        if "xl/worksheets/sheet1.xml" not in names:
            raise ValueError("No first worksheet in Census delineations")
        strings = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            strings = ["".join(t.text or "" for t in item.iter(NS + "t"))
                       for item in root.findall(NS + "si")]
        data = z.read("xl/worksheets/sheet1.xml")
        if len(data) > 30_000_000:
            raise ValueError("Worksheet unexpectedly large")
    root = ET.fromstring(data)
    for row in root.iter(NS + "row"):
        cells = {}
        for cell in row.findall(NS + "c"):
            ref = cell.get("r", "")
            match = REF_PATTERN.fullmatch(ref)
            if not match:
                continue
            col = 0
            for letter in match.group(1):
                col = col * 26 + ord(letter) - ord("A") + 1
            v = cell.find(NS + "v")
            inline = cell.find(NS + "is")
            val = v.text if v is not None and v.text is not None else ""
            if cell.get("t") == "s":
                idx = int(val)
                val = strings[idx]
            elif cell.get("t") == "inlineStr" and inline is not None:
                val = "".join(x.text or "" for x in inline.iter(NS + "t"))
            cells[col - 1] = str(val).strip()
        if cells:
            yield [cells.get(i, "") for i in range(max(cells) + 1)]


def normalized_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def census_cbsa_map(raw: bytes):
    rows = iter(xlsx_rows(raw))
    header = None
    for row in rows:
        keys = {normalized_header(s): i for i, s in enumerate(row) if s}
        if {"fipsstatecode", "fipscountycode", "cbsacode"}.issubset(keys):
            header = keys
            break
    if not header:
        raise ValueError("Unrecognized official CBSA spreadsheet schema")
    out = {}
    for cells in rows:
        def field(name):
            index = header.get(name, -1)
            return (cells[index] if 0 <= index < len(cells) else "").strip()
        state = field("fipsstatecode").split(".")[0].zfill(2)
        county = field("fipscountycode").split(".")[0].zfill(3)
        cbsa = field("cbsacode").split(".")[0].zfill(5)
        if state not in STATES or not re.fullmatch(r"\d{3}", county):
            continue
        if not re.fullmatch(r"\d{5}", cbsa):
            continue
        title = field("cbsatitle")
        kind = field("metropolitanmicropolitanstatisticalarea").lower()
        category = ("metro" if kind.startswith("metropolitan") else
                    "micro" if kind.startswith("micropolitan") else None)
        if category is None:
            # Detect changed terminology without quietly inventing a category.
            raise ValueError("Unknown Census metro/micro category for " + state + county)
        fips = state + county
        record = {"cbsa": cbsa, "category": category, "areaName": title}
        if fips in out and out[fips] != record:
            raise ValueError("Conflicting CBSA assignment for " + fips)
        out[fips] = record
    if len(out) < 1500:
        raise ValueError("Census metropolitan county coverage unexpectedly small")
    return out


def county_rows(raw: bytes):
    if len(raw) > 4_000_000:
        raise ValueError("County Gazetteer archive too large")
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise ValueError('Invalid official county ZIP archive')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        files = [n for n in z.namelist() if n.lower().endswith(".txt")]
        if len(files) != 1:
            raise ValueError("Expected one Census national county text file")
        data = z.read(files[0])
        if len(data) > 3_000_000:
            raise ValueError("County Gazetteer content unexpectedly large")
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")), delimiter="|")
    if not reader.fieldnames or not {"GEOID", "NAME"}.issubset(set(reader.fieldnames)):
        raise ValueError("Unrecognized Census county Gazetteer schema")
    for row in reader:
        fips = (row.get("GEOID") or "").strip()
        if re.fullmatch(r"\d{5}", fips) and fips[:2] in STATES:
            yield fips, (row.get("NAME") or "").strip()


def build(counties_zip: bytes, cbsa_xlsx: bytes) -> dict:
    metro = census_cbsa_map(cbsa_xlsx)
    counties = {}
    for fips, name in county_rows(counties_zip):
        if fips in counties:
            raise ValueError("Duplicate county FIPS " + fips)
        match = metro.get(fips)
        counties[fips] = {"name": name, **(match or {
            "cbsa": None, "category": "nonmetro", "areaName": None})}
    if not 3000 <= len(counties) <= 3400:
        raise ValueError("Unexpected national county count: " + str(len(counties)))
    if {fips[:2] for fips in counties} != STATES:
        raise ValueError("County geography does not cover 50 states and DC")
    if not any(x["category"] == "nonmetro" for x in counties.values()):
        raise ValueError("No nonmetropolitan counties - coverage likely defective")
    missing = sorted(set(metro) - set(counties))
    if missing:
        # Official reference versions can disagree due to changing boundaries.
        # Never emit a false national "complete" label until reconciled.
        raise ValueError("Census 2023/2025 county mismatch; review: " + ",".join(missing[:12]))
    return {
        "status": "research-only", "bookable": False,
        "marketPricesVerified": False, "promoted": False,
        "source": {
            "censusCounties": COUNTY_URL, "countiesYear": 2025,
            "censusCbsaDelineations": CBSA_URL, "cbsaYear": 2023,
            "sha256CountyZip": hashlib.sha256(counties_zip).hexdigest(),
            "sha256CbsaXlsx": hashlib.sha256(cbsa_xlsx).hexdigest(),
        },
        "counts": {key: sum(c["category"] == key for c in counties.values())
                   for key in ("metro", "micro", "nonmetro")},
        "counties": dict(sorted(counties.items())),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--county-zip", type=Path)
    parser.add_argument("--cbsa-xlsx", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    if bool(args.county_zip) != bool(args.cbsa_xlsx):
        parser.error("Both local source files must be supplied together")
    county = args.county_zip.read_bytes() if args.county_zip else download(COUNTY_URL)
    cbsa = args.cbsa_xlsx.read_bytes() if args.cbsa_xlsx else download(CBSA_URL)
    result = build(county, cbsa)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, separators=(",", ":"), sort_keys=True) + "\n")
    print("Census research counties: ", len(result["counties"]), result["counts"])
    print("No Fare changes, no database writes, no service markets activated")


if __name__ == "__main__":
    main()
