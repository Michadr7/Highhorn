"""Resume approved archives with one transfer at a time; honor HTTP retry delays."""
import json,hashlib,subprocess,zipfile,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';DEST=ROOT/'Models/AssetSweepSources/2026-11-01/AppearancePacks'
report=json.loads((OUT/'Download_Manifest.json').read_text())
for pack in ['hair01','skins01','skins02']:
 target=DEST/(pack+'_cc0.zip');partial=target.with_suffix('.zip.part');url=f'https://files.makehumancommunity.org/asset_packs/{pack}/{pack}_cc0.zip'
 if not target.exists():
  print('RESUMING',pack,'from',partial.stat().st_size if partial.exists() else 0,flush=True)
  command=['curl.exe','--fail','--location','--retry','3','--retry-delay','30','--connect-timeout','15','--max-time','240','--no-progress-meter','--continue-at','-','--output',str(partial),url]
  subprocess.run(command,check=True)
  with zipfile.ZipFile(partial) as archive:assert archive.testzip() is None
  partial.replace(target)
 page=f'https://static.makehumancommunity.org/assets/assetpacks/{pack}.html'
 with urllib.request.urlopen(page,timeout=30) as response:(DEST/(pack+'_source.html')).write_bytes(response.read())
 row=next(r for r in report['sources'] if r['id']==pack);row.update(status='downloaded',bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),actual_download_mirror=url,archive_crc_passed=True);row.pop('error',None)
 (OUT/'Download_Manifest.json').write_text(json.dumps(report,indent=2));print('COMPLETED',pack,row['bytes'],flush=True)
