"""Create a read-only recovery snapshot before reconciling Highhorn versions."""
from pathlib import Path
from datetime import datetime
import subprocess,json,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1]
GIT=r'C:\Users\Michael\AppData\Local\GitHubDesktop\app-3.6.10\resources\app\git\cmd\git.exe'
def git(*args):return subprocess.check_output([GIT,*args],cwd=ROOT)
OUT=ROOT/'Exports/VersionMergeSafety'/datetime.now().strftime('Snapshot_%Y%m%d_%H%M%S');OUT.mkdir(parents=True)
tracked=[Path(p) for p in git('ls-files','-z').decode().split('\0') if p]
new_files=[Path('AGENTS.md'),Path('README-START-HERE.md'),Path('js/hero-commoner.js')]
for folder in ['Models','Cloting','Scripts']:
 new_files.extend(p.relative_to(ROOT) for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
files=sorted(set(tracked+new_files));manifest=[]
with zipfile.ZipFile(OUT/'Current_Application_And_Assets.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
 for rel in files:
  path=ROOT/rel
  if path.is_file():
   archive.write(path,rel.as_posix());manifest.append({'path':rel.as_posix(),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 # Include the pre-integration ancestor for manual or three-way conflict resolution.
 before=ROOT/'Exports/HeroCreatorIntegration/Before_20261031_183014'
 for path in before.iterdir():
  if path.is_file():archive.write(path,'Pre_Integration_Base/'+path.name)
(OUT/'Tracked_Integration_Changes.patch').write_bytes(git('diff','--binary','--full-index','HEAD'))
report={'head':git('rev-parse','HEAD').decode().strip(),'cached_origin_main':git('rev-parse','origin/main').decode().strip(),'status':git('status','--short','--untracked-files=normal').decode(),'files':manifest,'untouched_asset_workspaces':['Exports (all Blender files and test exports remain in their existing paths)','Models','Cloting','Scripts'],'note':'No pull, reset, checkout, commit or push was performed. ZIP is code/source-assets recovery, not a browser localStorage backup.'}
(OUT/'Snapshot_Manifest.json').write_text(json.dumps(report,indent=2),encoding='utf8')
with zipfile.ZipFile(OUT/'Current_Application_And_Assets.zip') as archive:assert archive.testzip() is None
(OUT/'README.txt').write_text('Recovery snapshot before reconciling the older working base with newer code.\nThe ZIP contains current tracked application files, new source assets, all Scripts,\nand pre-integration ancestor files. The patch contains tracked application changes.\nBlender .blend files and Exports are left intact in their original locations.\nBrowser saved games/profiles are separate localStorage and are not in this archive.\nDo not push: this repository automatically deploys pushes to production.\n',encoding='utf8')
print(json.dumps({'snapshot':str(OUT),'zip_bytes':(OUT/'Current_Application_And_Assets.zip').stat().st_size,'files':len(manifest),'zip_verified':True}),flush=True)
