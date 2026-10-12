#!/usr/bin/env python3
"""Assemble national economic geography as RESEARCH evidence, not live prices.

The inputs are publisher files supplied as files (never downloaded per Travel).
Census 2025 county Gazetteer + 2023 OMB List 1 + native BLS May 2025
county/area definitions + May 2025 OEWS occupation wages. SHA256 is checked
against a separate manifest. No guessed county areas, rates or fallback.
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

SOURCES = {
    "censusCounties": "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip",
    "censusCbsa": "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx",
    "blsAreaDefinitions": "https://www.bls.gov/oes/area_definitions_m2025.xlsx",
    "blsWages": "https://www.bls.gov/oes/special-requests/oesm25ma.zip",
}
TERRITORIES_OUT_OF_SCOPE = {"60", "66", "69", "72", "78"}  # publisher island-area additions, not state markets
STATES = set("01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56".split())
N = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
PKG = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
MAX_FILE_BYTES = 24_000_000


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def safe_input(path: Path) -> bytes:
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("source file over size limit")
    raw = path.read_bytes()
    if not raw:
        raise ValueError("empty official source input")
    return raw


def clean(value: object) -> str:
    return str(value or "").strip().replace("\ufeff", "")


def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", clean(value).lower())


def csv_rows(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8-sig")
    if not text.strip():
        raise ValueError("empty CSV")
    first = text.splitlines()[0]
    delimiter = "|" if "|" in first else "\t" if "\t" in first else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise ValueError("no CSV headers")
    return [{norm(k): clean(v) for k, v in row.items() if k} for row in reader]


def col(row: dict, *names: str, required: bool = True) -> str:
    for name in names:
        if norm(name) in row and row[norm(name)]:
            return clean(row[norm(name)])
    if required:
        raise ValueError("missing required column: " + "/".join(names))
    return ""


def fips(state: str, county: str) -> str:
    # Official publisher may store leading zeroes numerically in Excel.
    s, c = clean(state), clean(county)
    if not (s.isdigit() and 1 <= len(s) <= 2 and c.isdigit() and 1 <= len(c) <= 3):
        raise ValueError("invalid state/county FIPS")
    code = s.zfill(2) + c.zfill(3)
    if code[:2] in TERRITORIES_OUT_OF_SCOPE:
        return None  # separately admitted island jurisdictions never become US-state rates
    if code[:2] not in STATES:
        raise ValueError("county outside the configured 50 states + DC")
    return code


def xlsx_rows(raw: bytes, sheet_name: str | None = None) -> list[list[str]]:
    """Read a genuine .xlsx using only stdlib; rejects unsafe or ambiguous workbooks."""
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = set(z.namelist())
        if "[Content_Types].xml" not in names or "xl/workbook.xml" not in names:
            raise ValueError("not a valid XLSX")
        strings = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall(N + "si"):
                strings.append("".join(t.text or "" for t in si.iter(N + "t")))
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        sheets = wb.find(N + "sheets")
        if sheets is None:
            raise ValueError("XLSX contains no worksheets")
        selected = [s for s in sheets if sheet_name is None or s.get("name") == sheet_name]
        if sheet_name and len(selected) != 1:
            raise ValueError("expected one named Excel sheet")
        if not selected:
            raise ValueError("empty XLSX")
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        relpaths = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        target = relpaths.get(selected[0].get(PKG + "id"))
        if not target:
            raise ValueError("missing XLSX sheet relationship")
        filename = target.lstrip("/") if target.startswith("/") else "xl/" + target
        filename = filename.replace("xl/xl/", "xl/")
        if filename not in names or ".." in filename:
            raise ValueError("invalid Excel sheet target")
        root = ET.fromstring(z.read(filename))
        out = []
        for r in root.iter(N + "row"):
            cells = {}
            for c in r.findall(N + "c"):
                address = c.get("r", "")
                match = re.match(r"([A-Z]+)", address)
                if not match:
                    continue
                index = 0
                for letter in match.group(1):
                    index = index * 26 + ord(letter) - ord("A") + 1
                index -= 1
                val = c.find(N + "v")
                inline = c.find(N + "is")
                if c.get("t") == "s" and val is not None:
                    idx = int(val.text or "-1")
                    if idx < 0 or idx >= len(strings):
                        raise ValueError("invalid XLSX string index")
                    value = strings[idx]
                elif c.get("t") == "inlineStr" and inline is not None:
                    value = "".join(t.text or "" for t in inline.iter(N + "t"))
                else:
                    value = val.text if val is not None else ""
                cells[index] = clean(value)
            if cells:
                if max(cells) > 100:
                    raise ValueError("unexpected XLSX worksheet width")
                out.append([cells.get(i, "") for i in range(max(cells) + 1)])
        return out


def table(rows: list[list[str]], required: list[list[str]]) -> list[dict]:
    """Find actual publisher headers, including a title page above the header row."""
    for idx, raw_header in enumerate(rows[:35]):
        headers = [norm(v) for v in raw_header]
        if all(any(norm(alias) in headers for alias in alternatives) for alternatives in required):
            result = []
            for values in rows[idx + 1:]:
                row = {h: clean(values[i]) if i < len(values) else ""
                       for i, h in enumerate(headers) if h}
                if any(row.values()):
                    result.append(row)
            if result:
                return result
    raise ValueError("cannot identify required publisher workbook headings")


def county_roster(raw: bytes) -> dict:
    # Census 2025 national Gazetteer is usually ZIP containing pipe-delimited
    # TXT. Verify the outer archive's checksum BEFORE extracting any member.
    if zipfile.is_zipfile(io.BytesIO(raw)):
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            members = [n for n in z.namelist() if n.lower().endswith(".txt") and "/" not in n]
            if len(members) != 1 or z.getinfo(members[0]).file_size > 5_000_000:
                raise ValueError("unsafe or ambiguous Census counties archive")
            raw = z.read(members[0])
    counties = {}
    for row in csv_rows(raw):
        code = col(row, "GEOID", "COUNTYFIPS", "COUNTY_FIPS")
        if code[:2] in TERRITORIES_OUT_OF_SCOPE and len(code) == 5 and code.isdigit():
            continue  # Census 2025 national ZIP includes Puerto Rico; other island areas are distinct
        if not (len(code) == 5 and code.isdigit() and code[:2] in STATES):
            raise ValueError("invalid national county GEOID")
        name = col(row, "NAME", "COUNTYNAME")
        if code in counties:
            raise ValueError("duplicate national county " + code)
        counties[code] = name
    if not counties:
        raise ValueError("no counties in official roster")
    return counties


def cbsa_membership(raw: bytes) -> dict:
    rows = table(xlsx_rows(raw), [
        ["CBSA Code"], ["FIPS State Code"], ["FIPS County Code"],
        ["Metropolitan/Micropolitan Statistical Area"],
    ])
    out = {}
    cbsa_kind = {}
    for row in rows:
        code = col(row, "CBSA Code", required=False)
        if not (len(code) == 5 and code.isdigit()):
            continue  # total/footnote; never silently classify as a county
        county = fips(col(row, "FIPS State Code"), col(row, "FIPS County Code"))
        if county is None:
            continue
        typ = col(row, "Metropolitan/Micropolitan Statistical Area")
        if norm(typ) == "metropolitanstatisticalarea":
            category = "metro"
        elif norm(typ) == "micropolitanstatisticalarea":
            category = "micro"
        else:
            raise ValueError("unknown CBSA metropolitan/micropolitan indicator")
        title = col(row, "CBSA Title")
        if county in out:
            raise ValueError("county listed in two CBSAs")
        if code in cbsa_kind and cbsa_kind[code] != category:
            raise ValueError("CBSA has conflicting category across states")
        cbsa_kind[code] = category
        out[county] = {"category": category, "cbsaCode": code, "cbsaTitle": title}
    if not out:
        raise ValueError("no Census CBSAs")
    return out


def bls_county_definitions(raw: bytes) -> dict:
    # BLS 2025 OEWS nonmetro definitions do NOT equal 2023 Census CBSA.
    # Parse BLS's own worksheet, reject unfamiliar schemas instead of guessing.
    rows = table(xlsx_rows(raw), [
        ["State FIPS Code", "FIPS State Code", "STATE_FIPS"],
        ["County FIPS Code", "FIPS County Code", "COUNTY_FIPS"],
        ["Area Code", "OEWS Area Code", "AREA"],
    ])
    out = {}
    for row in rows:
        s = col(row, "State FIPS Code", "FIPS State Code", "STATE_FIPS", required=False)
        c = col(row, "County FIPS Code", "FIPS County Code", "COUNTY_FIPS", required=False)
        code = col(row, "Area Code", "OEWS Area Code", "AREA", required=False)
        if not (s and c and code):
            continue
        county = fips(s, c)
        if county is None:
            continue
        if not (code.isdigit() and 2 <= len(code) <= 7):
            raise ValueError("invalid BLS area code")
        if county in out:
            raise ValueError("duplicate BLS county assignment")
        out[county] = code
    if not out:
        raise ValueError("no BLS county assignments")
    return out


def official_wages(raw: bytes) -> dict:
    """Read a publisher ZIP, XLSX, native tab TXT or CSV; never all-data 331MB scrape."""
    if zipfile.is_zipfile(io.BytesIO(raw)):
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            names = set(z.namelist())
            if "[Content_Types].xml" not in names:
                members = [n for n in names if n.lower().endswith((".xlsx", ".txt", ".csv"))
                           and not n.startswith("/") and ".." not in n]
                if len(members) != 1 or z.getinfo(members[0]).file_size > 40_000_000:
                    raise ValueError("unsupported or oversized BLS occupation archive")
                raw = z.read(members[0])
    if zipfile.is_zipfile(io.BytesIO(raw)):
        rows = table(xlsx_rows(raw), [
            ["AREA", "Area Code"], ["AREA_TITLE", "Area Title"],
            ["OCC_CODE", "Occupation Code"], ["H_MEDIAN", "Median Hourly Wage"],
        ])
        # The production BLS wage validator remains the authority for filtering
        # occupations, suppressed cells and duplicate data.
        data = io.StringIO()
        keys = ["AREA", "AREA_TITLE", "OCC_CODE", "NAICS", "I_GROUP", "H_MEDIAN"]
        writer = csv.DictWriter(data, fieldnames=keys, delimiter=chr(9))
        writer.writeheader()
        for r in rows:
            writer.writerow({
                "AREA": col(r, "AREA", "Area Code"),
                "AREA_TITLE": col(r, "AREA_TITLE", "Area Title"),
                "OCC_CODE": col(r, "OCC_CODE", "Occupation Code"),
                "NAICS": col(r, "NAICS", required=False) or "000000",
                "I_GROUP": col(r, "I_GROUP", required=False) or "cross-industry",
                "H_MEDIAN": col(r, "H_MEDIAN", "Median Hourly Wage", required=False) or "*",
            })
        raw = data.getvalue().encode()
    spec = importlib.util.spec_from_file_location(
        "national_wage_importer", Path(__file__).with_name("collect-national-pricing-evidence.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.wage_records(raw)


def assemble(*, census_counties: bytes, census_cbsa: bytes, bls_counties: bytes,
             bls_wages: bytes, manifest: dict, national: bool = True) -> dict:
    if manifest.get("release") != "2025-05" or manifest.get("censusCbsaVintage") != "2023":
        raise ValueError("invalid Census/BLS source vintage")
    payloads = dict(censusCounties=census_counties, censusCbsa=census_cbsa,
                    blsAreaDefinitions=bls_counties, blsWages=bls_wages)
    for name, raw in payloads.items():
        item = manifest.get("sources", {}).get(name, {})
        if item.get("url") != SOURCES[name] or item.get("sha256") != digest(raw):
            raise ValueError("source origin or checksum invalid for " + name)
    roster = county_roster(census_counties)
    cbsa = cbsa_membership(census_cbsa)
    bls = bls_county_definitions(bls_counties)
    wages = official_wages(bls_wages)
    if any(code not in roster for code in cbsa):
        raise ValueError("CBSA county absent from Census county roster")
    if any(code not in roster for code in bls):
        raise ValueError("BLS county absent from Census county roster")
    if national and (len(roster) < 3000 or len({x[:2] for x in roster}) != 51):
        raise ValueError("incomplete Census nationwide county roster")
    profiles, unresolved = {}, {}
    for county, name in sorted(roster.items()):
        geo = cbsa.get(county, {"category": "nonmetro", "cbsaCode": None,
                                "cbsaTitle": None})
        area = bls.get(county)
        if not area:
            unresolved[county] = "BLS 2025 county area absent"
            continue
        comparisons = [wages.get(area + ":" + oc) for oc in ("53-3054", "53-3053")]
        wage = next((w for w in comparisons if w), None)
        if not wage:
            unresolved[county] = "BLS 2025 comparison occupation missing or suppressed"
            continue
        profiles[county] = {
            "countyFips": county, "countyName": name,
            "category": geo["category"], "cbsaCode": geo["cbsaCode"],
            "economicAreaId": "bls-" + area,
            "blsAreaCode": area,
            "blsComparisonOccupation": wage["occupation"],
            "blsEmployeeMedianHourlyUSD": wage["hourlyMedianUSD"],
        }
    return {
        "status": "research-only", "bookable": False, "liveFareModified": False,
        "operatorNetPayVerified": False, "marketDiscountVerified": False,
        "sourceVerifiedByChecksum": True,
        "sourceVintage": {"cbsa": "2023", "blsOews": "2025-05"},
        "sourceSha256": {name: digest(raw) for name, raw in payloads.items()},
        "countyCount": len(roster), "resolvedCountyCount": len(profiles),
        "unresolvedCountyCount": len(unresolved),
        "nationwideComplete": national and not unresolved and len(roster) >= 3000,
        "profiles": profiles, "unresolved": unresolved,
        "note": "Geography and employee wage comparison only; vehicle costs, duty utilization and approved net targets needed to generate research rate candidates.",
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--census-counties", required=True, type=Path)
    p.add_argument("--census-cbsa", required=True, type=Path)
    p.add_argument("--bls-county-definitions", required=True, type=Path)
    p.add_argument("--bls-wages", required=True, type=Path)
    p.add_argument("--source-manifest", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()
    sources = [safe_input(getattr(args, name)) for name in (
        "census_counties", "census_cbsa", "bls_county_definitions", "bls_wages")]
    report = assemble(census_counties=sources[0], census_cbsa=sources[1],
                      bls_counties=sources[2], bls_wages=sources[3],
                      manifest=json.loads(args.source_manifest.read_text()))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, sort_keys=True, separators=(",", ":")) + "\n")
    print("RESEARCH ONLY", "counties", report["countyCount"],
          "resolved", report["resolvedCountyCount"],
          "unresolved", report["unresolvedCountyCount"],
          "nationwide complete", report["nationwideComplete"])
    if not report["nationwideComplete"]:
        raise SystemExit(2)  # fail in automated commissioning; artifact remains for triage


if __name__ == "__main__":
    main()
