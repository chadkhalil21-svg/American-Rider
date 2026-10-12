#!/usr/bin/env python3
"""Read-only diagnostic of official BLS May 2025 metro/nonmetro wage archive."""
import io
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
URL="https://www.bls.gov/oes/special-requests/oesm25ma.zip"
REQ=urllib.request.Request(URL,headers={"User-Agent":"American-Rider-Research/1.0"})
with urllib.request.urlopen(REQ,timeout=45) as f:
    archive=f.read(35_000_001)
assert 0<len(archive)<=35_000_000,"BLS archive unexpectedly large or missing"
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    print("BLS original archive members:",[(n,z.getinfo(n).file_size) for n in z.namelist()][:12])
    files=[n for n in z.namelist() if n.lower().endswith(".xlsx")]
    assert files,"No XLSX in official BLS file"
    first=z.read(files[0])
    print("BLS first XLSX member bytes:",len(first))
    with zipfile.ZipFile(io.BytesIO(first)) as book:
        print("XLSX worksheets:",[(n,book.getinfo(n).file_size) for n in book.namelist() if n.startswith("xl/worksheets/sheet")][:8])
        part=next(n for n in book.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))
        namespace="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
        with book.open(part) as x:
            seen=0
            for _,node in ET.iterparse(x,events=("end",)):
                if node.tag==namespace+"row":
                    print("First raw BLS row:",ET.tostring(node,encoding="unicode")[:1600])
                    seen+=1
                    if seen>=2:break
                    node.clear()
print("BLS live source reachable; this preview is NOT an approved wage or actual Operator-pay estimate")
