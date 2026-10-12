#!/usr/bin/env python3
"""Twice-run fully offline publisher-format importer trials; all records fictional."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
import zipfile
from xml.sax.saxutils import escape

script = Path(__file__).with_name("assemble-national-economic-geography.py")
spec = importlib.util.spec_from_file_location("geography", script)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
HEADER1 = ["CBSA Code", "CBSA Title", "Metropolitan/Micropolitan Statistical Area",
           "FIPS State Code", "FIPS County Code"]
HEADER2 = ["State FIPS Code", "County FIPS Code", "Area Code"]


def workbook(header, entries):
    def cell(i, value):
        col = ""
        i += 1
        while i:
            i, r = divmod(i - 1, 26)
            col = chr(65 + r) + col
        return '<c r="%s" t="inlineStr"><is><t>%s</t></is></c>' % (col, escape(str(value)))
    def row(index, items):
        return '<row r="%d">%s</row>' % (index, "".join(cell(j,v) for j,v in enumerate(items)))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData>' + row(1, ["Publisher export"]) + row(2, ["2025 evidence fixture"]) +
        row(3, header) + "".join(row(i + 4, r) for i, r in enumerate(entries)) +
        '</sheetData></worksheet>'
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<Types/>')
        z.writestr("xl/workbook.xml",
                   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                   '<sheets><sheet name="Publisher" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/worksheets/sheet1.xml", xml)
    return buf.getvalue()


def fixture(*, big=False):
    if big:
        counties = [(state + str(i).zfill(3), "Fictional County")
                    for state in sorted(mod.STATES) for i in range(1, 62)]
    else:
        counties = [("12086", "Miami-Dade"),("12011", "Broward"),
                    ("12099", "Palm Beach"),("12029", "Dixie"),("39049", "Franklin")]
    census = "GEOID\tNAME\n" + "".join(code + "\t" + name + "\n" for code,name in counties)
    memberships = []
    for county,_ in counties:
        if big or county != "12029":
            memberships.append(["33100", "Fixture Area", "Metropolitan Statistical Area",
                                county[:2], county[2:]])
    mappings = [[county[:2],county[2:],"33100" if county != "12029" else "12440"]
                for county,_ in counties]
    bls = ("AREA\tAREA_TITLE\tOCC_CODE\tNAICS\tI_GROUP\tH_MEDIAN\n"
           "33100\tFixture Area\t53-3054\t000000\tcross-industry\t18.5\n"
           "12440\tFixture Nonmetro\t53-3054\t000000\tcross-industry\t19.5\n")
    raw = dict(census_counties=census.encode(),
               census_cbsa=workbook(HEADER1,memberships),
               bls_counties=workbook(HEADER2,mappings),bls_wages=bls.encode())
    manifest = {"release":"2025-05","censusCbsaVintage":"2023",
                "sources":{key:{"url":mod.SOURCES[key],
                                "sha256":hashlib.sha256(raw[source]).hexdigest()}
                           for key,source in (
                               ("censusCounties","census_counties"),
                               ("censusCbsa","census_cbsa"),
                               ("blsAreaDefinitions","bls_counties"),
                               ("blsWages","bls_wages"))}}
    return raw,manifest


class NationalCrosswalkTests(unittest.TestCase):
    def test_known_county_mapping_and_nonmetro(self):
        for _ in range(2):
            raw,manifest=fixture()
            r=mod.assemble(**raw,manifest=manifest,national=False)
            self.assertEqual(r["resolvedCountyCount"],5)
            self.assertEqual(r["unresolvedCountyCount"],0)
            self.assertFalse(r["bookable"])
            self.assertFalse(r["operatorNetPayVerified"])
            self.assertFalse(r["marketDiscountVerified"])
            self.assertEqual(r["profiles"]["12086"]["economicAreaId"],"bls-33100")
            self.assertEqual(r["profiles"]["12029"]["category"],"nonmetro")
            self.assertEqual(r["profiles"]["12029"]["blsAreaCode"],"12440")
            self.assertEqual(r["profiles"]["12029"]["blsEmployeeMedianHourlyUSD"],19.5)

    def test_official_national_gazetteer_includes_puerto_rico_out_of_scope(self):
        text = chr(10).join([
            "USPS|GEOID|NAME","FL|12086|Miami-Dade","PR|72001|Adjuntas",""])
        roster = mod.county_roster(text.encode())
        self.assertEqual(set(roster), {"12086"})
        cbsa = workbook(HEADER1,[
            ["33100","Miami","Metropolitan Statistical Area","12","086"],
            ["99999","PR metro","Metropolitan Statistical Area","72","001"]])
        self.assertEqual(set(mod.cbsa_membership(cbsa)), {"12086"})
        bls = workbook(HEADER2,[["12","086","33100"],["72","001","99999"]])
        self.assertEqual(set(mod.bls_county_definitions(bls)), {"12086"})

    def test_real_publisher_container_shapes_zip_pipe_and_bls_xlsx(self):
        for _ in range(2):
            buf = io.BytesIO()
            with zipfile.ZipFile(buf,"w",zipfile.ZIP_DEFLATED) as z:
                z.writestr("2025_Gaz_counties_national.txt",
                           chr(10).join(["USPS|GEOID|NAME","FL|12086|Miami-Dade","FL|12011|Broward",""]))
            roster = mod.county_roster(buf.getvalue())
            self.assertEqual(set(roster), {"12086","12011"})
            wage_workbook=workbook(
                ["AREA","AREA_TITLE","OCC_CODE","NAICS","I_GROUP","H_MEDIAN"],
                [["33100","Miami Metro","53-3054","000000","cross-industry","18.50"],
                 ["33100","Miami Metro","53-3053","000000","cross-industry","*"]])
            outer=io.BytesIO()
            with zipfile.ZipFile(outer,"w",zipfile.ZIP_DEFLATED) as z:
                z.writestr("oesm25ma.xlsx",wage_workbook)
            wages=mod.official_wages(outer.getvalue())
            self.assertEqual(wages["33100:53-3054"]["hourlyMedianUSD"],18.5)
            self.assertEqual(len(wages),1)

    def test_source_pinning_and_future_revisions_fail(self):
        raw,manifest=fixture()
        for updated in (
            dict(manifest,release="2026-05"),
            dict(manifest,censusCbsaVintage="2022"),
            {**manifest,"sources":{**manifest["sources"],"blsWages":{
                "url":mod.SOURCES["blsWages"],"sha256":"0"*64}}},
            {**manifest,"sources":{**manifest["sources"],"censusCbsa":{
                "url":"https://attacker.example/data.xlsx",
                "sha256":manifest["sources"]["censusCbsa"]["sha256"]}}},
        ):
            with self.assertRaises(ValueError):
                mod.assemble(**raw,manifest=updated,national=False)

    def test_duplicate_census_and_cbsa_rows_refused(self):
        raw,manifest=fixture()
        bad=dict(raw,census_counties=raw["census_counties"]+b"12086\tDUP\n")
        with self.assertRaises(ValueError):
            mod.county_roster(bad["census_counties"])
        bad=workbook(HEADER1,[["33100","Miami","Metropolitan Statistical Area","12","086"],
                              ["99999","Elsewhere","Micropolitan Statistical Area","12","086"]])
        with self.assertRaises(ValueError):
            mod.cbsa_membership(bad)

    def test_unknown_bls_area_rejected_not_substituted(self):
        raw,manifest=fixture()
        altered=dict(raw,bls_counties=workbook(HEADER2,[
            ["12","086","33100"],["12","011","33100"],["12","099","33100"],
            ["12","029","99999"],["39","049","33100"]]))
        newmanifest=json.loads(json.dumps(manifest))
        newmanifest["sources"]["blsAreaDefinitions"]["sha256"]=mod.digest(altered["bls_counties"])
        r=mod.assemble(**altered,manifest=newmanifest,national=False)
        self.assertEqual(r["unresolved"]["12029"],
                         "BLS 2025 comparison occupation missing or suppressed")
        self.assertNotIn("12029",r["profiles"])
        self.assertFalse(r["nationwideComplete"])

    def test_missing_nonmetro_assignment_never_guessed(self):
        raw,manifest=fixture()
        altered=dict(raw,bls_counties=workbook(HEADER2,[
            ["12","086","33100"],["12","011","33100"],["12","099","33100"],
            ["39","049","33100"]]))
        m=json.loads(json.dumps(manifest))
        m["sources"]["blsAreaDefinitions"]["sha256"]=mod.digest(altered["bls_counties"])
        r=mod.assemble(**altered,manifest=m,national=False)
        self.assertEqual(r["unresolved"]["12029"],"BLS 2025 county area absent")

    def test_large_fictional_national_fixture_twice(self):
        for _ in range(2):
            raw,manifest=fixture(big=True)
            r=mod.assemble(**raw,manifest=manifest,national=True)
            self.assertEqual(r["countyCount"],61*51)
            self.assertEqual(r["resolvedCountyCount"],61*51)
            self.assertEqual(r["unresolvedCountyCount"],0)
            self.assertTrue(r["nationwideComplete"])
            self.assertFalse(r["bookable"])
            self.assertFalse(r["liveFareModified"])

    def test_small_roster_fails_national_completeness(self):
        raw,manifest=fixture()
        with self.assertRaisesRegex(ValueError,"incomplete Census nationwide"):
            mod.assemble(**raw,manifest=manifest,national=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
