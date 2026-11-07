#!/usr/bin/env python3
"""Build and verify a deterministic ZIP of the plugin folder without credentials."""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLUGIN = ROOT / 'plugins' / 'cotizave'
version = json.loads((PLUGIN / '.claude-plugin' / 'plugin.json').read_text())['version']
out = ROOT / 'dist' / f'cotizave-plugin-{version}.zip'
paths = sorted(p for p in PLUGIN.rglob('*') if p.is_file())
assert all(not p.is_symlink() and p.resolve().is_relative_to(PLUGIN) for p in paths)
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in paths:
        name = path.relative_to(PLUGIN).as_posix()
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, path.read_bytes())
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    names = set(z.namelist())
    for required in ('.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'skills/cotizave/SKILL.md', 'LICENSE', 'README.md'):
        assert required in names, required
    assert all(p.relative_to(PLUGIN).as_posix() in names for p in paths)
    assert json.loads(z.read('.claude-plugin/plugin.json'))['version'] == version
print(f'OK {out.relative_to(ROOT)}: {len(paths)} files, CRC verified')
