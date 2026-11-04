import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01'
catalog=json.loads((ROOT/'Exports/AssetResearch/2026-11-01/Grab3D_Selected_Metadata.json').read_text())['models'];inspection=json.loads((OUT/'Binary_Inspection.json').read_text())['models'];by_id={r['id']:r for r in inspection}
assets=[]
for m in catalog:
 if m['slug'] not in by_id:continue
 row=by_id[m['slug']];assets.append({'id':m['slug'],'name':m['name']['en'],'url':'../../../../'+row['file'].replace('\\','/'),'notes':'Untouched source. '+('Modern clothes need medieval fitting.' if m['slug'] in ['man','woman','businessman','elderly-man','elderly-woman'] else 'Unlock/bot candidate; review deformation and props.'),'bones':row['skin_joint_counts'][0],'triangles':sum(p['triangles'] for mesh in row['meshes'] for p in mesh['primitives'])})
assets.extend([{'id':'approved-male','name':'Male Commoner','url':'../../../../Models/Heroes/MaleCommoner/commoner-idle.glb?v=3','notes':'Approved fitted male, for visual comparison.','reference':True,'bones':24,'triangles':175969},{'id':'approved-female','name':'Female Commoner','url':'../../../../Models/Heroes/FemaleCommoner/commoner.glb?v=1','notes':'Approved fitted female, for visual comparison.','reference':True,'bones':24,'triangles':232439}])
(OUT/'TestGallery/assets.json').write_text(json.dumps(assets,indent=2))
# Offline renders remain useful without a running browser server.
cards=[]
for a in assets:
 if a.get('reference'):continue
 cards.append(f'<article><h2>{a["name"]}</h2><div><a href="Renders/{a["id"]}_bind.png"><img src="Renders/{a["id"]}_bind.png" alt="{a["name"]} imported bind pose"></a><a href="Renders/{a["id"]}_face.png"><img src="Renders/{a["id"]}_face.png" alt="{a["name"]} face"></a></div><p>{a["bones"]} bones · {a["triangles"]:,} triangles · walk/run</p></article>')
(OUT/'Render_Review.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Highhorn source render review</title><style>body{background:#25201b;color:#eee1cc;font:16px system-ui;margin:30px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px}article{padding:18px;background:#3a3027;border-radius:12px}article div{display:flex}img{width:100%;height:300px;object-fit:contain}a{width:50%}h1,h2{font-family:Georgia}</style><h1>Highhorn imported-source review</h1><p>Actual Blender source imports. Workbench base-texture lighting; use TestGallery for PBR animation playback. These files are candidates, not production replacements.</p><section>'+''.join(cards)+'</section></html>',encoding='utf-8')
print('Prepared',len(assets),'gallery entries')
