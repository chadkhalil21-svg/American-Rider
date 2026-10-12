# ADR 0011: Research-only national geography data

Official Census county Gazetteer (2025) and Census CBSA delineations (2023) are the two public inputs. A scheduled, read-only check runs monthly, rather than fetching data for each town or booking. The script checks official source file hashes, national county coverage, and urban/suburban/nonmetropolitan classifications. It does not contact Firebase or change pricing, payments or market admission.

Government geography files are not competitor prices, and do not establish a 10% competitive discount. Regional wages, vehicle expenses and local authority must be added and validated before commissioning new markets. Any unexpected census source format or geographic mismatch blocks the research artifact. Offline tests generate 3,111 fake county records across 50 states and DC twice; a separate live-source workflow checks the actual government files.

Official references: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html and https://www.census.gov/programs-surveys/metro-micro/about/delineation-files.html .

**Verified October 12, 2026:** The independent GitHub source-audit downloaded both Census datasets successfully, identifying 3,144 U.S. county-equivalent areas (1,186 metropolitan, 658 micropolitan, 1,300 nonmetropolitan). An unattended BLS wage-archive request returned HTTP 403, so that optional step is excluded from the recurring job. No wage or vehicle-cost estimate has been invented in its place.
