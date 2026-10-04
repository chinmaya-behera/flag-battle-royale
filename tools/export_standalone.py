import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
dist = root / 'dist'
html = (dist / 'index.html').read_text(encoding='utf-8')
css = (dist / 'style.css').read_text(encoding='utf-8')
css = re.sub(r'@import url\([^;]+;', '', css)
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
for name in ['countries.js', 'physics.js', 'app.js']:
    source = (dist / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = html.replace(f'<script src="{name}" defer></script>', '')
    html = html.replace('</body>', '<script>\n' + source + '\n</script>\n</body>')
output = root / 'Flag Battle Royale.html'
license_text = (dist / 'flag-icons-LICENSE.txt').read_text(encoding='utf-8')
html = html.replace('</html>', '<!-- Flag artwork license:\n' + license_text.replace('--', '—') + '\n-->\n</html>')
output.write_text(html, encoding='utf-8')
print('Offline game:', output, 'bytes:', output.stat().st_size)
