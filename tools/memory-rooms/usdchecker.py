"""usdchecker --arkit, for the browser-made AR Quick Look files (ar/usdz.js).

The pip wheel `usd-core` ships no command-line tools, and from 26.x it no longer
has the old compliance checker either, so this is the same check `usdchecker
--arkit` runs, through UsdUtils.ComplianceChecker:

    python -m venv .usdvenv && .usdvenv/Scripts/python -m pip install usd-core==25.8
    .usdvenv/Scripts/python tools/memory-rooms/usdchecker.py file.usdz [more.usdz ...]

Prints the failed checks, errors and warnings per file, plus what's inside the
package (layers + textures with sizes). Exit 1 if any file fails.

The usd-core wheel also leaves out the usdShaders plugin's resources (the
UsdPreviewSurface definitions the shader check needs), so the checker crashes
with "Could not find shader resource: shaderDefs.usda". The first run fetches
them from the OpenUSD repo at the installed version (public files, ~40 KB)
into the venv's pxr/pluginfo/usdShaders/.
"""

import json
import os
import re
import sys
import urllib.request
import zipfile
from importlib.metadata import version

import pxr  # the package only: no plugin is registered until a module like Usd loads


def ensure_shader_defs():
    root = os.path.join(os.path.dirname(pxr.__file__), 'pluginfo', 'usdShaders', 'resources')
    shaders = os.path.join(root, 'shaders')
    if os.path.exists(os.path.join(shaders, 'shaderDefs.usda')):
        return
    major, minor = (int(x) for x in version('usd-core').split('.')[:2])
    tag = f'v{major}.{minor:02d}'
    src = f'https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/{tag}/pxr/usd/plugin/usdShaders/shaders/'
    os.makedirs(shaders, exist_ok=True)
    defs = urllib.request.urlopen(src + 'shaderDefs.usda').read()
    with open(os.path.join(shaders, 'shaderDefs.usda'), 'wb') as f:
        f.write(defs)
    for name in sorted(set(re.findall(rb'sourceAsset = @\./([^@]+)@', defs))):
        with open(os.path.join(shaders, name.decode()), 'wb') as f:
            f.write(urllib.request.urlopen(src + name.decode()).read())
    info = {'Plugins': [{'Info': {'Types': {'UsdShadersDiscoveryPlugin': {'bases': ['SdrDiscoveryPlugin']}}, 'ShaderResources': 'shaders'},
                         'LibraryPath': '', 'Name': 'usdShaders', 'ResourcePath': 'resources', 'Root': '..', 'Type': 'library'}]}
    with open(os.path.join(root, 'plugInfo.json'), 'w') as f:
        json.dump(info, f, indent=2)
    print(f'(fetched the usdShaders resources for {tag})')


ensure_shader_defs()
from pxr import UsdUtils  # noqa: E402  (plugins register on first use, after the resources exist)


def check(path):
    checker = UsdUtils.ComplianceChecker(arkit=True, skipARKitRootLayerCheck=False, rootPackageOnly=False, skipVariants=False, verbose=False)
    checker.CheckCompliance(path)
    failed, errors, warnings = checker.GetFailedChecks(), checker.GetErrors(), checker.GetWarnings()
    with zipfile.ZipFile(path) as z:
        entries = [(i.filename, i.file_size, i.compress_type) for i in z.infolist()]
    ok = not failed and not errors
    print(f"{'PASS' if ok else 'FAIL'} {path}")
    for name, size, comp in entries:
        print(f"    {name:48s} {size / 1e6:7.2f} MB{'' if comp == 0 else '  (compressed!)'}")
    textures = [e for e in entries if e[0].startswith('textures/')]
    print(f"    textures: {len(textures)}")
    for label, items in (('failed', failed), ('error', errors), ('warning', warnings)):
        for item in items:
            print(f"    {label}: {item}")
    return ok and len(textures) > 0


if __name__ == '__main__':
    results = [check(p) for p in sys.argv[1:]]
    sys.exit(0 if results and all(results) else 1)
