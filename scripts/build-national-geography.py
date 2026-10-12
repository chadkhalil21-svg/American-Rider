#!/usr/bin/env python3
"""One-time OFFLINE REVIEW of official US county geography, never live Fare authority.

Usage:
  python3 scripts/build-national-geography.py --self-test
  python3 scripts/build-national-geography.py --fetch --output /tmp/county-areas.json
  python3 scripts/build-national-geography.py --gazetteer counties.zip --cbsa list1.xlsx --output /tmp/areas.json

No Firestore/API booking calls, no market opening, no source polling schedule.
Only downloads with an explicit --fetch flag from Census.gov HTTPS endpoints.
"""
import argparse
import csv
import hashlib
import io
import itertools
import json
import re
import sys
import urllib.request
import zipfile
from xml.etree import ElementTree as ET

GAZ_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip"
CBSA_URL = "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx"
MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
STATES = set("01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56".split())
LIMIT = 4_000_000


def download_once(url):
    if not url.startswith("https://www2.census.gov/"):
        raise ValueError("Only approved federal source permitted")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "AmericanRiderResearch/1.0"}), timeout=30) as response:
        data = response.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError("Unreasonably large source, refuse")
    return data


def digest(content):
    return hashlib.sha256(content).hexdigest()


def parse_counties(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".txt") and not n.startswith("__MACOSX")]
        if len(names) != 1:
            raise ValueError("Expected one county Gazetteer TXT")
        with z.open(names[0]) as stream:
            lines = io.TextIOWrapper(stream, encoding="utf-8-sig")
            first = lines.readline()
            delimiter = "|" if first.count("|") >= 5 else "\t"
            reader = csv.DictReader(itertools.chain([first], lines), delimiter=delimiter)
            result = {}
            for row in reader:
                fips = (row.get("GEOID") or "").strip()
                if not re.fullmatch(r"\d{5}", fips) or fips[:2] not in STATES:
                    continue
                if fips in result:
                    raise ValueError("Duplicate county FIPS " + fips)
                name = (row.get("NAME") or "").strip()
                if not name:
                    raise ValueError("Missing name for county " + fips)
                result[fips] = {"countyFips": fips, "countyName": name,
                                "stateFips": fips[:2], "category": "nonmetro",
                                "cbsaCode": None, "cbsaTitle": None,
                                "economicAreaId": None}
            if not result:
                raise ValueError('Official gazetteer parsed zero US counties; header=' + repr(reader.fieldnames))
            return result


def xl_text(cell, shared):
    kind = cell.attrib.get("t", "")
    if kind == "inlineStr":
        return "".join(t.text or "" for t in cell.iter(MAIN + "t")).strip()
    v = cell.find(MAIN + "v")
    if v is None or v.text is None:
        return ""
    if kind == "s":
        i = int(v.text)
        return shared[i].strip()
    return v.text.strip()


def xl_col(reference):
    letters = re.match(r"^[A-Z]+", reference or "")
    if not letters:
        raise ValueError("Invalid Excel cell coordinate")
    number = 0
    for char in letters.group():
        number = 26 * number + ord(char) - 64
    return number - 1


def parse_cbsa(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in si.iter(MAIN + "t")) for si in root.findall(MAIN + "si")]
        if "xl/worksheets/sheet1.xml" not in z.namelist():
            raise ValueError("Expected Census List 1 sheet not present")
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        result, header, previous = {}, None, {}
        for row in root.findall(".//" + MAIN + "sheetData/" + MAIN + "row"):
            values = {}
            for cell in row.findall(MAIN + "c"):
                values[xl_col(cell.get("r"))] = xl_text(cell, shared)
            if header is None:
                candidate = {str(v).strip(): k for k, v in values.items()}
                required = {"CBSA Code", "CBSA Title", "FIPS State Code",
                            "FIPS County Code", "Metropolitan/Micropolitan Statistical Area"}
                if required.issubset(candidate):
                    header = candidate
                continue
            v = {name: values.get(index, "").strip() for name, index in header.items()}
            # Census List 1 sometimes uses merged cells; inherit the last
            # confirmed grouping only when no new CBSA code is supplied.
            for key in ("CBSA Code", "CBSA Title", "Metropolitan/Micropolitan Statistical Area"):
                if v.get(key):
                    previous[key] = v[key]
                else:
                    v[key] = previous.get(key, "")
            state, county = v.get("FIPS State Code", ""), v.get("FIPS County Code", "")
            if not state and not county:
                continue
            if not state.isdigit() or not county.isdigit():
                raise ValueError("Invalid county/state FIPS inside CBSA sheet")
            fips = state.zfill(2) + county.zfill(3)
            if fips[:2] not in STATES:
                continue
            cbsa = v.get("CBSA Code", "").split(".")[0]
            if not re.fullmatch(r"\d{5}", cbsa):
                raise ValueError("Invalid CBSA code for " + fips)
            typ = v.get("Metropolitan/Micropolitan Statistical Area", "").lower()
            if "micropolitan" in typ:
                category = "micro"
            elif "metropolitan" in typ:
                category = "metro"
            else:
                raise ValueError("Invalid CBSA classification for " + fips)
            value = {"category": category, "cbsaCode": cbsa,
                     "cbsaTitle": v.get("CBSA Title") or None,
                     "economicAreaId": "cbsa-" + cbsa}
            if fips in result and result[fips] != value:
                raise ValueError("Conflicting official CBSA records for " + fips)
            result[fips] = value
        if header is None:
            raise ValueError("Census CBSA worksheet header missing")
        return result


def compile_geography(gazetteer, cbsa, *, production_validation=True):
    counties, groups = parse_counties(gazetteer), parse_cbsa(cbsa)
    if not set(groups).issubset(counties):
        missing = sorted(set(groups) - set(counties))
        raise ValueError("CBSA references unknown county FIPS: " + ",".join(missing[:20]) +
                         " (count=" + str(len(missing)) + ", counties=" + str(len(counties)) +
                         ", cbsaCounties=" + str(len(groups)) + ")")
    for fips, area in groups.items():
        counties[fips].update(area)
    states = {f[:2] for f in counties}
    if production_validation and (len(counties) < 3000 or not STATES.issubset(states) or len(groups) < 1000):
        raise ValueError("Incomplete official 50-state county/CBSA coverage")
    return {"status": "research-only", "bookingEnabled": False,
            "competitorPriceVerified": False,
            "sources": {"counties": {"url": GAZ_URL, "sha256": digest(gazetteer), "year": 2025},
                        "cbsa": {"url": CBSA_URL, "sha256": digest(cbsa), "year": 2023}},
            "countyCount": len(counties), "cbsaCountyCount": len(groups),
            "notAssignedEconomicAreaCount": sum(not v["economicAreaId"] for v in counties.values()),
            "counties": {k: counties[k] for k in sorted(counties)}}


def self_test():
    gaz = io.BytesIO()
    with zipfile.ZipFile(gaz, "w") as z:
        z.writestr("counties.txt", "GEOID\tNAME\n12086\tMiami-Dade County\n38001\tAdams County\n31001\tAdams County\n")
    sheet = (f'<worksheet xmlns="{MAIN[1:-1]}"><sheetData>'
             '<row r="3"><c r="A3" t="inlineStr"><is><t>CBSA Code</t></is></c>'
             '<c r="D3" t="inlineStr"><is><t>CBSA Title</t></is></c>'
             '<c r="E3" t="inlineStr"><is><t>Metropolitan/Micropolitan Statistical Area</t></is></c>'
             '<c r="I3" t="inlineStr"><is><t>FIPS State Code</t></is></c>'
             '<c r="J3" t="inlineStr"><is><t>FIPS County Code</t></is></c></row>'
             '<row r="4"><c r="A4"><v>33100</v></c><c r="D4" t="inlineStr"><is><t>Miami, FL</t></is></c>'
             '<c r="E4" t="inlineStr"><is><t>Metropolitan Statistical Area</t></is></c>'
             '<c r="I4"><v>12</v></c><c r="J4"><v>86</v></c></row>'
             '<row r="5"><c r="A5"><v>10100</v></c><c r="D5" t="inlineStr"><is><t>Aberdeen, SD</t></is></c>'
             '<c r="E5" t="inlineStr"><is><t>Micropolitan Statistical Area</t></is></c>'
             '<c r="I5"><v>38</v></c><c r="J5"><v>1</v></c></row>'
             '</sheetData></worksheet>')
    wb = io.BytesIO()
    with zipfile.ZipFile(wb, "w") as z:
        z.writestr("xl/worksheets/sheet1.xml", sheet)
    out = compile_geography(gaz.getvalue(), wb.getvalue(), production_validation=False)
    assert out["countyCount"] == 3
    assert out["counties"]["12086"]["economicAreaId"] == "cbsa-33100"
    assert out["counties"]["12086"]["category"] == "metro"
    assert out["counties"]["38001"]["category"] == "micro"
    assert out["counties"]["31001"]["category"] == "nonmetro"
    assert out["counties"]["31001"]["economicAreaId"] is None
    assert out["bookingEnabled"] is False
    print("PASS three-area synthetic Census importer, no national price/permission assertion")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--self-test", action="store_true")
    p.add_argument("--fetch", action="store_true", help="Explicit one-time official Census download")
    p.add_argument("--gazetteer", help="Offline official Census counties ZIP")
    p.add_argument("--cbsa", help="Offline official Census List 1 XLSX")
    p.add_argument("--output", help="Research-only JSON output")
    args = p.parse_args()
    if args.self_test:
        self_test()
    else:
        if not args.output:
            p.error("--output is mandatory for official file processing")
        if args.fetch and (args.gazetteer or args.cbsa):
            p.error("Use either --fetch or two offline paths")
        if not args.fetch and not (args.gazetteer and args.cbsa):
            p.error("Use --fetch or --gazetteer and --cbsa")
        gaz = download_once(GAZ_URL) if args.fetch else open(args.gazetteer, "rb").read()
        cbsa = download_once(CBSA_URL) if args.fetch else open(args.cbsa, "rb").read()
        out = compile_geography(gaz, cbsa)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(out, f, separators=(",", ":"), sort_keys=True)
        print(json.dumps({key: out[key] for key in ("status","countyCount","cbsaCountyCount",
                                                    "notAssignedEconomicAreaCount")}, sort_keys=True))
