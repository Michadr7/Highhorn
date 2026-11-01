# Highhorn — project instructions for Codex

## Project overview
Highhorn is an in-development fantasy-themed game with a web/Three.js front end and a Hero Creator. The user prefers a cohesive, detailed stylized 3D look, with warm wooden/fantasy UI elements, believable character proportions, and no blocky clothing overlays. Preserve the working game and existing character prototype while iterating.

## Repository and paths
- Project root: `Documents/Projects/Highhorn` on Windows.
- Existing game files include `index.html`, `css/`, `js/`, `worker/`, and Git files. Do not overwrite or restructure these without approval.
- Asset workspaces under the root: `Models/`, `Cloting/` (this is the existing folder name, intentionally spelled that way), `Scripts/`, and `Exports/`.
- Blender script: `Scripts/Highhorn_Male_Commoner_Setup.py`.
- Blender output goes under `Exports/`. Keep generated/test assets distinct from production game files.
- Do not assume any source asset exists in a particular nested folder without verifying the real path.

## Current Hero Creator direction
- Use whole Grab3D character models rather than mixing heads from one character system with bodies from another.
- Male and Female Commoner are the level-1 bases. Viking and Wizard are whole-character unlock previews (provisional levels 10 and 20).
- Preserve the Grab3D faces, proportions, textures, and working animations.
- The modern T-shirts and shorts on the Commoner bases do not suit the fantasy setting. Goal: replace or properly cover them with textured medieval tunic, trousers, boots, and a shoulder garment from a downloaded peasant clothing asset.
- The original peasant clothing asset has 4 static FBX meshes with textures. It is NOT yet skinned to the Grab3D skeleton. Do not describe an overlay as completed rigged clothing.
- Avoid simple cylinders, boxes, or other primitive clothing substitutes: that earlier experiment looked poor.
- Blender fitting/mesh editing is preferred over adding more browser-only offset sliders.

## Current status and known problem
- A Blender setup script has been run from Blender's Scripting/Text Editor on Windows. Blender version shown was 4.4.3.
- The imported Blender scene showed a large grey sphere-like object and tiny clothing markers in the viewport. This is **not yet diagnosed**; it may involve viewport framing, fitting pivot geometry, or unexpectedly scaled imported objects.
- Before making more modeling changes, inspect actual imported meshes, dimensions, origins, transforms, collection structure, visibility, and the scene's fitting pivot objects. Fix the viewport/geometry issue with evidence, not guesswork.
- Prior browser fitting showed the clothing could visually align with the male base near relative scale `0.89` and forward/back offset `-0.03`, but these are reference values for that particular browser coordinate system; do not blindly apply them to Blender.
- Modern base T-shirt/shorts still poke through. The base may be a single skinned mesh, so selective removal/masking requires real mesh editing and proper treatment of skinning and texture UVs.

## Working rules
1. Inspect existing code, assets, and dimensions before editing. Explain what is actually wrong.
2. Make small, reversible changes. Prefer new scripts/exports or Git commits; do not overwrite original source models.
3. Do not remove unrelated objects or collections. If clearing a Blender scene, do so only in a dedicated new working scene/file.
4. Preserve materials, textures, bone weights and animations where practical; report any unsupported behavior.
5. Validate Python syntax and Blender scripts where possible; report clearly whether a Blender GUI visual check was or was not performed.
6. Do not claim successful animation, fitting, or removal of modern garments without testing.
7. Keep the system as simple as possible: two coherent starter characters, later full-model unlocks.
8. Before destructive operations or adding dependencies, ask for approval. Do not alter `worker/` or deployment settings unless explicitly asked.
9. When providing Windows test-server instructions, use `py -3 -m http.server 8000` from the relevant web project directory and `http://localhost:8000`; user's `python` command may refer to Python 2.7.

## Immediate next task
Investigate `Scripts/Highhorn_Male_Commoner_Setup.py` and the Blender scene generated in `Exports/`. Identify why the viewport initially showed a large grey sphere-like object instead of a properly framed character. Inspect mesh bounds/transforms and the FIT_MASTER object, then propose and implement the smallest safe fix. Do not begin rigging until the imported base character and clothing appear correctly in Blender.

## Version reconciliation and deployment (user update, 2026-10-31)
- The Hero Creator integration was built on an older checkout. Reconcile it with the user's confirmed newer version before further character/UI changes.
- Preserve all character assets, Blender files, exports, scripts, and integration work. Use a recovery snapshot and a three-way merge; do not replace the working folder with a newer download.
- The user accepted the browser Hero preview. Defer the standing-pose issue and remaining procedural-character avatars/board pieces until after version reconciliation.
- Every Git push automatically deploys to `highhorn.ghostjumper007.workers.dev`. Treat all pushes as production deployments; do not push without explicit user instruction. Local comparisons, snapshots and merge preparation must not publish anything.
- The user requested local servers closed for now. Do not restart them until asked.
- Reconciled the accepted Commoner integration with confirmed GitHub `main` commit `e403c3eb51676e2a34e829a53c6ea0edd90cf4ff` (v0.26.8) on local branch `work/commoner-on-v0.26.8`. A pre-merge recovery archive is under `Exports/VersionMergeSafety/Snapshot_20261031_192546/`. Complete a browser layout check when the user authorizes reopening the server.
