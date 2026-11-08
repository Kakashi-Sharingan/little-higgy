"""Create a source-only Windows package. No models, keys, or user data."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parent.parent
out = root / 'dist' / 'Little-Higgy-Windows.zip'
out.parent.mkdir(exist_ok=True)
folders = ['app', 'components', 'lib', 'tests', 'scripts', '.github', 'packages/studio/src', 'windows']
names = [
    'package.json', 'package-lock.json', 'packages/studio/package.json',
    'packages/studio/tailwind.config.js', 'packages/studio/postcss.config.js',
    'packages/studio/babel.config.json', 'next.config.mjs', 'postcss.config.js',
    'tailwind.config.js', 'jsconfig.json', '.gitignore', 'START-LITTLE-HIGGY.bat',
    'LITTLE-HIGGY-WINDOWS.md', 'THIRD-PARTY.md', 'README.md',
    'SETUP-LOCAL-REQUIREMENTS.bat', 'MODEL-LICENSES.md',
]
files = [f for folder in folders for f in (root / folder).rglob('*') if f.is_file()]
files.extend(root / name for name in names)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(set(files)):
        if file.exists() and not any(part in {'__pycache__', '.next', 'node_modules'} for part in file.relative_to(root).parts):
            name = str(Path('LittleHiggy') / file.relative_to(root))
            if file.suffix.lower() == '.bat':
                archive.writestr(name, file.read_text().replace('\r\n', '\n').replace('\n', '\r\n').encode('utf-8'))
            else:
                archive.write(file, name)
with zipfile.ZipFile(out) as archive:
    if archive.testzip() is not None:
        raise RuntimeError('Package integrity check failed')
print(f'{out.name}: {out.stat().st_size} bytes')
print('SHA256:', hashlib.sha256(out.read_bytes()).hexdigest())
