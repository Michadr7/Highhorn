"""Acquire only the approved free candidates; retain source files and license evidence."""
import json,hashlib,urllib.request,concurrent.futures,struct,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';OUT.mkdir(parents=True,exist_ok=True)
DEST=ROOT/'Models/AssetSweepSources/2026-11-01';DEST.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'Exports/AssetResearch/2026-11-01/Grab3D_Selected_Metadata.json').read_text())['models']
jobs=[]
for m in catalog:
 if m['slug'] in ['man-base-character','woman-base-character']:continue
 r=m['rigged'];file=next(f for f in r['files'] if f['format']=='glb')
 jobs.append({'id':m['slug'],'kind':'character','url':file['url'],'expected_bytes':file['bytes'],'target':DEST/m['slug']/file['file'],'source_page':m['page'],'license_url':r['origin']['licenseUrl'],'manifest_url':r['origin']['manifestUrl']})
for pack in ['hair01','bodyparts05','skins01','skins02']:
 jobs.append({'id':pack,'kind':'appearance-pack','url':f'https://files2.makehumancommunity.org/asset_packs/{pack}/{pack}_cc0.zip','target':DEST/'AppearancePacks'/(pack+'_cc0.zip'),'source_page':f'https://static.makehumancommunity.org/assets/assetpacks/{pack}.html','license':'CC0 as listed; verify bundled license files'})
def retrieve(url,path,expected=None):
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists() and (not expected or path.stat().st_size==expected):return
 temporary=path.with_suffix(path.suffix+'.part')
 if 'files2.makehumancommunity.org' in url and 'bodyparts05' not in url:
  # The primary server's large full responses stalled. Its documented secondary
  # mirror supports ranges; verify each range and retain the source URL evidence.
  mirror=url.replace('files2.makehumancommunity.org','files.makehumancommunity.org')
  with urllib.request.urlopen(urllib.request.Request(mirror,method='HEAD'),timeout=20) as response:total=int(response.headers['Content-Length'])
  chunk_size=4*1024*1024
  with temporary.open('wb') as output:
   for start in range(0,total,chunk_size):
    end=min(total-1,start+chunk_size-1);block=None
    for attempt in range(3):
     try:
      request=urllib.request.Request(mirror,headers={'Range':f'bytes={start}-{end}'})
      with urllib.request.urlopen(request,timeout=30) as response:
       assert response.status==206 and response.headers['Content-Range']==f'bytes {start}-{end}/{total}'
       block=response.read()
      assert len(block)==end-start+1;break
     except Exception:
      if attempt==2:raise
    output.write(block);output.flush()
    if start==0 or (start//chunk_size+1)%8==0:print(json.dumps({'pack':path.name,'downloaded_mb':round((end+1)/1e6,1),'total_mb':round(total/1e6,1),'mirror':'secondary'}),flush=True)
  assert temporary.stat().st_size==total;temporary.replace(path);return
 last=None
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url,timeout=60) as response,temporary.open('wb') as output:
    while True:
     block=response.read(1024*1024)
     if not block:break
     output.write(block)
   if expected:assert temporary.stat().st_size==expected,(url,temporary.stat().st_size,expected)
   temporary.replace(path);return
  except Exception as error:last=error;time.sleep(attempt+1)
 raise last
def download(job):
 row={k:str(v) if isinstance(v,Path) else v for k,v in job.items()}
 try:
  retrieve(job['url'],job['target'],job.get('expected_bytes'))
  path=job['target'];digest=hashlib.sha256()
  with path.open('rb') as source:
   while block:=source.read(1024*1024):digest.update(block)
  row.update(status='downloaded',bytes=path.stat().st_size,sha256=digest.hexdigest())
  if job['kind']=='character':
   with path.open('rb') as source:
    header=source.read(20);magic,version,size,n,kind=struct.unpack('<IIIII',header);assert magic==0x46546c67 and version==2 and size==path.stat().st_size
    doc=json.loads(source.read(n))
   row['structure']={'meshes':len(doc.get('meshes',[])),'skins':len(doc.get('skins',[])),'joints':[len(s['joints']) for s in doc.get('skins',[])],'animations':[a['name'] for a in doc.get('animations',[])],'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'] if 'indices' in p),'images':len(doc.get('images',[])),'morph_targets':sum(len(p.get('targets',[])) for m in doc.get('meshes',[]) for p in m['primitives'])}
   assert {'walk','run'}<=set(row['structure']['animations'])
   for key,name in [('license_url','LICENSE.txt'),('manifest_url','manifest.json')]:retrieve(job[key],path.parent/name)
  else:retrieve(job['source_page'],path.parent/(job['id']+'_source.html'))
  print(json.dumps({'id':job['id'],'status':row['status'],'bytes':row['bytes'],'structure':row.get('structure')}),flush=True)
 except Exception as error:row.update(status='failed',error=str(error));print(json.dumps({'id':job['id'],'status':'failed','error':str(error)}),flush=True)
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(download,jobs))
report={'download_date':'2026-11-01','paid_assets':False,'sources':results}
(OUT/'Download_Manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('DOWNLOAD SUMMARY',json.dumps({'complete':sum(r['status']=='downloaded' for r in results),'failed':sum(r['status']!='downloaded' for r in results),'bytes':sum(r.get('bytes',0) for r in results)}),flush=True)
