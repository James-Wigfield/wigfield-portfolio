"""Dream Rooms · the full bake (render-workflow step 8): build_world.py in --full mode.

    blender.exe -b --factory-startup --python tools/dream-rooms/blender/bake_export.py -- \
        --world <abs world.json> --out <abs out dir> --work <abs work dir> --glb-name world-v<N>.glb \
        [--scratch <abs build dir>] [--samples 384] [--atlas 2048] [--png-copies]

2048 px atlases (<= 4 per module), ~384 adaptive samples, COMBINED baked in context and written
display-referred through AgX, unlit WebP GLB, and a 1280x800 Cycles still per module with volumetric
haze following look.fog.density (stills/<module>.webp; a fallback world gets stills/still-<k>.webp
only). tools/dream-rooms/bake.mjs runs this and then measures the real GLB against the budget.
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import build_world  # noqa: E402

if __name__ == "__main__":
    build_world.run(force_full=True)
