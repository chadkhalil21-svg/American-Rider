# Nationwide regional pricing — versioned economic data and safe candidate generation
**October 12, 2026. Status: candidate research integration, NOT live or nationally sourced prices.**

## Research first, code second
Official [2025 Census national county Gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html) establishes the complete county FIPS roster, including counties **outside** any statistical area. [Census 2023 List 1](https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx) provides the actual metro/micro membership. **BLS's [2025 area definitions](https://www.bls.gov/oes/area_definitions_m2025.xlsx) are an independently necessary join**, especially for nonmetropolitan wages. [BLS May 2025 OEWS published tables](https://www.bls.gov/oes/tables.htm) contain wages for taxi drivers and shuttle drivers/chauffeurs. BLS employees' wages are NOT net profit for self-employed Operators. [IRS 2026 H2 76-cent business mileage rate](https://www.irs.gov/irb/2026-29_irb) is a tax approximation, NOT a billable regional Operator vehicle cost. These URLs are publisher primary sources, not endorsement or Council participation.

The decision remains one nationally reusable calculation engine, event/release-driven public data research, no paid local pricing collector, and no mandatory repeated city or county lookup. Actual public records, observed Operator duty time, pickups, insurance, local costs, company payments and representative current comparable Traveler totals constrain what can ever be promoted.

## Implemented in PR under review
- `scripts/assemble-national-economic-geography.py` reads **provided official publisher files**: Census national county Gazetteer ZIP or delimited TXT, Census List 1 XLSX, BLS 2025 county-to-wage-area XLSX, and BLS 2025 metropolitan/nonmetro ZIP containing XLSX (or native wage TXT). The ZIP is materially smaller than the full 331 MB BLS time-series TXT; source input is bounded. It uses Python standard library only, not paid services or scraping. All four input files require matching independent source URL metadata, stated vintages and exact **SHA256** checksums in a manifest; source integrity is NOT signature/proof of government issuance without separately authenticating the download.
- Census metro/micro categories and BLS wage areas remain **distinct**. County codes are always five characters including leading zeroes. The pipeline rejects duplicates, conflicting/malformed FIPS, unsupported source layouts, unknown county records, mismatched checksums and non-national rosters. A county without its **specific** BLS area wage remains in an explicit unresolved list—no invisible wage substitution. Micro areas may be part of a BLS nonmetro wage market; they are never assumed equal.
- `backend/national-regional-pricing.js` reads the research snapshot and an explicit, dated **study policy** containing local vehicle costs, unpaid duty/utilization, deadhead pickup mileage, travel fixed costs, an Operator earnings floor and a labeled BLS wage adjustment factor. It uses the existing real `regionalStartingRateCandidate()` module. Even with all inputs, result is `bookable:false`, `research-candidate`, `marketTargetVerified:false`. Missing/wrong county or source is `research-hold`.
- `backend/national-regional-pricing.test.js` and `scripts/assemble-national-economic-geography.test.py` simulate 3,111 county records across 50 states + DC **twice**, separately test source alterations, out-of-vintage files, missing nonmetro area assignments, unobserved wages and operator 99%-of-fare cost-floor arithmetic. The test records are FICTIONAL, not actual live government data.
- Existing production fare curves, pricing publication controls, jurisdiction activation and the app are **not connected** to this research module. Nothing is automatically deployed as a new Traveler price.

## How to produce an official research candidate set
1. Download the listed versions from the original Census and BLS publisher sites. Keep the original ZIP/XLSX/TXT and record the source URI, publisher date and SHA256 for each in a JSON manifest with keys `censusCounties`, `censusCbsa`, `blsAreaDefinitions`, `blsWages`; include `release: 2025-05` and `censusCbsaVintage: 2023`.
2. Run (in an isolated offline runner):

```sh
python3 scripts/assemble-national-economic-geography.py \
  --census-counties /tmp/2025_Gaz_counties_national.zip \
  --census-cbsa /tmp/list1_2023.xlsx \
  --bls-county-definitions /tmp/area_definitions_m2025.xlsx \
  --bls-wages /tmp/oesm25ma.zip \
  --source-manifest /tmp/source-manifest.json \
  --out /tmp/national-regional-evidence.json
```

3. The command exits nonzero on insufficient county coverage or unresolved geography/wage records, and writes an audit artifact for investigating missing areas. It cannot silently publish. When real official files are available, test their **actual** schema and issuer version. Run the existing Node research candidate bridge with evidence-backed, **independently justified** operating-cost assumptions. Keep prospective rates separate from promoted Fares. Do NOT set the 90% market target as verified from Census/BLS/IRS research.


**Publisher link choices:** The exact Census national ZIP is https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip . The dedicated BLS area wage ZIP is https://www.bls.gov/oes/special-requests/oesm25ma.zip (linked from the May 2025 metropolitan/nonmetropolitan XLSX table on the official BLS tables page). BLS also offers a 331 MB uncompressed all-data time-series TXT file; **do not** fetch that file per county or on every fare request. Source download access and publisher workbook layouts are NOT yet validated in this runtime. A parser accepting the fictional zipped format does not prove acceptance of the genuine workbook.

## Remaining evidence (not bypassed by simulation)
- **Acquire and validate complete real Census/BLS input files**, including 2025 BLS county definitions. Previous CI research download of the BLS archive returned HTTP 403; none of the new geographic records is claimed to be genuinely commissioned or populated. The standard library importer validates schemas against fictional fixtures; publisher files may require a reviewed schema adapter, **not** a silent column guess.
- Region-specific independent Operator actual costs, mandatory insurance, unpaid duty/pickup time, company margin, local airport/toll fees, statutory wage or permit rules, representative current comparable market totals and hold-out tests. Versioned source approval must not be confused with fare promotion authority.
- Confirm actual route-time and toll accuracy, real device outcomes, actual provider callbacks, real cloud resource usage and commercial regulatory admission for each opened region.

This is material software progress toward one national pricing system but does **not** complete nationwide live rate coverage. No added vendor cost, real funds, new market, fare change, or claim of endorsement by historical Council figures and research institutions.
