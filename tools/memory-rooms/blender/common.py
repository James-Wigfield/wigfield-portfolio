"""Shared Blender plumbing for the Memory Rooms kit: argv, GPU, render settings.

Every headless script runs as
    blender.exe -b --factory-startup --python <script> -- <args>
and calls `bootstrap()` first so `import scene_io`, `import materials`, `import kit` work.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

_T0 = time.perf_counter()


def log(*parts):
    print(f"[mr {time.perf_counter() - _T0:6.1f}s]", *parts, flush=True)


def script_args(parser: argparse.ArgumentParser):
    """Parse only the arguments after `--` (Blender's own flags come before it)."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def enable_gpu(scene) -> list[str]:
    """OptiX on every RTX device; falls back to CUDA, then CPU. Returns the device names in use."""
    import bpy

    prefs = bpy.context.preferences.addons["cycles"].preferences
    used: list[str] = []
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        devices = [d for d in prefs.devices if d.type == backend]
        for d in prefs.devices:
            d.use = d.type == backend
        if devices:
            used = [f"{backend}:{d.name}" for d in devices]
            break
    scene.cycles.device = "GPU" if used else "CPU"
    if not used:
        used = ["CPU"]
    return used


def reset_scene():
    """An empty scene (factory startup still has a cube, a light and a camera)."""
    import bpy

    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def set_render(scene, *, samples=64, res_x=1200, res_y=900, denoise=True, exposure=0.0, transparent=False):
    """Cycles + AgX, the one look every spot shares."""
    scene.render.engine = "CYCLES"
    enable_gpu(scene)
    scene.cycles.samples = int(samples)
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = bool(denoise)
    if denoise:
        try:
            scene.cycles.denoiser = "OPTIX"
        except TypeError:
            scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 8
    scene.render.resolution_x = int(res_x)
    scene.render.resolution_y = int(res_y)
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = bool(transparent)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Base Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = float(exposure)
    return scene


def render_to(scene, camera_obj, path: Path):
    import bpy

    path = Path(path).resolve()  # Blender resolves relative render paths against the .blend, not the cwd
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.camera = camera_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path
