"""Build a research-only manifest/review sheet from official public metadata."""
import json,csv,html
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetResearch/2026-11-01'
catalog=json.loads((OUT/'Grab3D_Catalog.json').read_text(encoding='utf-8-sig'))
plans=[
 ('man-base-character','male','approved starter','Keep','Already fitted and tested locally.'),
 ('woman-base-character','female','approved starter','Keep','Already fitted and tested locally.'),
 ('man','male','starter diversity candidate','Conditional','Bearded face; modern outfit replacement and style comparison required.'),
 ('businessman','male','reserve starter candidate','Reserve','Publisher preview resembles Casual Man; verify a genuinely different face before counting it. Suit replacement required.'),
 ('woman','female','starter diversity candidate','Conditional','Auburn wavy hair; modern outfit replacement and style comparison required.'),
 ('elderly-woman','female','starter diversity candidate','Conditional','Older face and silver bun; modern outfit replacement required.'),
 ('elderly-man','male','starter diversity candidate','Conditional','Older face/moustache; glasses, cap and modern clothes require inspection.'),
 ('viking','male','level 10 suggestion','Priority sweep','Whole warrior; inspect beard, fur, axe, hand pose and actual rig.'),
 ('armored-knight','unverified','level 15 suggestion','Priority sweep','Whole plate-armored hero; do not infer sex from armor or claim a female counterpart.'),
 ('wizard','male','level 20 suggestion','Priority sweep','Whole mage; inspect robe/leg clearance and beard deformation.'),
 ('witch','female','level 20 suggestion','Priority sweep','Whole magic/herbalist hero; inspect skirt, braid, hat and held props.'),
 ('elf','female','level 10-15 optional ranger','Conditional','Female-presenting elf/cartographer; pointed ears imply fantasy race, not a human counterpart.'),
 ('king','male','level 25-30 optional royalty','Conditional','Whole ruler; inspect cape and crown; different face from the Commoner.'),
 ('queen','female','level 25-30 optional royalty','Conditional','Whole ruler; cultural/art-direction comparison required, not automatically a matching royal set.')
]
by_slug={m['slug']:m for m in catalog['models']};rows=[];snapshots=[]
for slug,sex,tier,status,notes in plans:
 m=by_slug[slug];r=m.get('rigged') or {};files=r.get('files',[]);glb=next((f for f in files if f['format']=='glb'),{})
 row=dict(id=slug,name=m['name']['en'],sex_or_presentation=sex,suggested_role=tier,status=status,license=m['license'],animations=','.join(r.get('animations',[])),rigged_glb_bytes=glb.get('bytes',''),rigged_glb_url=glb.get('url',''),source_page=m['page'],thumbnail=m['media']['thumbnailSmall'],notes=notes,binary_inspected='no',hair_separable='unverified',skin_variants='unverified',face_variants='unverified')
 assert row['animations']=='walk,run',slug
 rows.append(row);snapshots.append(m)
(OUT/'Grab3D_Selected_Metadata.json').write_text(json.dumps({'checked_on':'2026-11-01','source':'https://grab3d.com/api/v1/models.json','models':snapshots},indent=2),encoding='utf-8')
with (OUT/'Sweep_Candidates.csv').open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.DictWriter(f,fieldnames=rows[0].keys());writer.writeheader();writer.writerows(rows)
esc=html.escape
cards=[]
for r in rows:
 cards.append(f'''<article><a href="{esc(r['source_page'])}"><img src="Thumbnails/{esc(r['id'])}.webp" alt="{esc(r['name'])} — publisher preview" loading="lazy"></a><div><span class="status">{esc(r['status'])}</span><h2><a href="{esc(r['source_page'])}">{esc(r['name'])}</a></h2><p>{esc(r['suggested_role'])} · {esc(r['sex_or_presentation'])}</p><p>{esc(r['notes'])}</p><small>Listed: CC0 · rigged GLB {int(r['rigged_glb_bytes'])/1e6:.1f} MB · walk/run<br>Mesh and animation inspection pending.</small></div></article>''')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Highhorn asset research — 2026-11-01</title><style>
body{margin:0;background:#221d19;color:#ede4d4;font:16px/1.5 system-ui,sans-serif}main{max-width:1360px;margin:auto;padding:32px}h1{font:700 36px Georgia,serif}h2{font-size:20px;margin:8px 0}a{color:#e5b477}header{max-width:1000px;margin-bottom:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px}article{background:#342d26;border:1px solid #5c4b39;border-radius:12px;overflow:hidden}article img{width:100%;height:250px;object-fit:contain;background:#e4e0db}article>div{padding:18px}p{margin:8px 0}.status{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#d2ad78}small{color:#c4b6a2}.note{background:#3e3427;padding:16px;border-radius:8px}footer{margin-top:30px}
</style><main><header><h1>Highhorn: character candidates</h1><p>Research checked 1 November 2026. Images are publisher previews, not in-game renders. Levels are suggestions. The two approved Commoners remain our reference.</p><p class="note">Compare faces and proportions before selecting new starters. These are whole characters, not modular hair/skin packs. Rigged download sizes come from the official catalog; static triangle counts have deliberately not been presented as rigged counts. The full 3D downloads and mesh inspection belong to the next asset sweep.</p><p><a href="Asset_Shortlist.md">Research notes and appearance options</a> · <a href="Sweep_Candidates.csv">Sweep manifest</a></p></header><section class="grid">'''+''.join(cards)+'''</section><footer>Original previews © their respective source authors; Grab3D lists these assets as CC0. All character links lead to their official source pages. No purchase, game change, server launch or deployment is part of this research.</footer></main></html>'''
(OUT/'Asset_Review.html').write_text(page,encoding='utf-8')
print(json.dumps({'candidates':len(rows),'new_rigged_download_bytes':sum(int(r['rigged_glb_bytes']) for r in rows if r['status']!='Keep'),'rows':[{k:r[k] for k in ['id','status','rigged_glb_bytes']} for r in rows]},indent=2))
