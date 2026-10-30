#!/usr/bin/env python3
"""Build and verify a deterministic, local plugin ZIP without credentials."""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
version = json.loads((ROOT / 'plugin.json').read_text())['version']
out = ROOT / 'dist' / f'cotizave-plugin-{version}.zip'
paths = [ROOT / p for p in ['plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json', 'LICENSE']]
paths += sorted((ROOT / 'assets').rglob('*'))
paths += sorted((ROOT / 'skills').rglob('*'))
paths = [p for p in paths if p.is_file()]
assert all(not p.is_symlink() and p.resolve().is_relative_to(ROOT) for p in paths)
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in paths:
        name = path.relative_to(ROOT).as_posix()
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, path.read_bytes())
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    names = set(z.namelist())
    assert 'skills/cotizave/SKILL.md' in names
    assert all(p.relative_to(ROOT).as_posix() in names for p in paths)
    assert json.loads(z.read('plugin.json'))['version'] == version
print(f'OK {out.relative_to(ROOT)}: {len(paths)} files, CRC verified')
