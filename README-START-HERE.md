# Highhorn — Blender Male Commoner fitting setup (first pass)

This installs alongside your existing game. **It does not overwrite index.html, JS, CSS, .git, or your current character tests.**

## Install
1. Extract this ZIP into your existing `Documents\Projects\Highhorn` folder. Let it merge the four existing `Models`, `Cloting`, `Scripts`, `Exports` folders. This bundle uses **Cloting**, the spelling visible in your screenshot. It makes only new named subfolders/files.
2. Launch Blender and switch to **Scripting**.
3. In the Text Editor: **Open** `Scripts\Highhorn_Male_Commoner_Setup.py`, then click **Run Script** (or press **Alt+P** with the editor focused).
4. If your Documents folder is redirected to OneDrive, change `PROJECT_ROOT` near the top of the script to the full path shown by File Explorer (click the address bar to get it). Use `Path(r"C:\...")`.
5. Open the saved file `Exports\Highhorn_Male_Commoner_Fit.blend`, or inspect the current viewport after script execution.

## What to inspect
- **Outliner**: `01 - Grab3D ORIGINAL Male` and `02 - REAL Peasant outfit`.
- Click `FIT_MASTER - scale and initial alignment` and use G/S/R for overall transforms.
- Click individual clothing meshes under the outfit collection to make local mesh adjustments; save the `.blend` when satisfied.
- Inspect whether the original shirt and shorts protrude, and whether boots fit feet.
- Save a screenshot of front and side views for the next fitting pass.

## Limitations (important)
- The FBX garments are currently **static**, not skinned to the Grab3D skeleton.
- This script does **not** remove the original modern clothing or export an animated outfit.
- Blender's OBJ/FBX material imports can require relinking textures; the script attempts color/roughness mapping from included images.
- The script initially matches the clothing's *overall* height to ~89% of the base body height, not per-garment perfect sizing. The previous browser depth offset (-0.03) is not applied blindly because the Blender FBX axis system may differ.
- It creates a new `.blend` file. It does not modify the original source GLB or FBX files.

The test is intended to establish real relative placement and visible material quality before skinned rigging.
