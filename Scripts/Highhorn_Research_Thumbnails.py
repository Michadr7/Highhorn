"""Download publisher preview images only, for the offline research contact sheet."""
import json,urllib.request,concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetResearch/2026-11-01';DEST=OUT/'Thumbnails';DEST.mkdir(exist_ok=True)
models=json.loads((OUT/'Grab3D_Selected_Metadata.json').read_text())['models']
def download(m):
 target=DEST/(m['slug']+'.webp');url=m['media']['thumbnailSmall'];assert url.startswith('https://grab3d.com/m/')
 if not target.exists():
  with urllib.request.urlopen(url,timeout=20) as response:data=response.read()
  assert data[:4]==b'RIFF' and data[8:12]==b'WEBP';target.write_bytes(data)
 return {'id':m['slug'],'bytes':target.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(download,models))
(OUT/'Thumbnail_Manifest.json').write_text(json.dumps(results,indent=2));print(json.dumps({'images':len(results),'bytes':sum(r['bytes'] for r in results)}))
