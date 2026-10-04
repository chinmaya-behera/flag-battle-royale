import base64
import json
import pathlib
import urllib.request
import zipfile
import io

root = pathlib.Path(__file__).resolve().parents[1]
dist = root / 'dist'
dist.mkdir(parents=True, exist_ok=True)
url = 'https://codeload.github.com/lipis/flag-icons/zip/refs/heads/main'
archive = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url, timeout=90).read()))
prefix = 'flag-icons-main/'
countries = json.loads(archive.read(prefix + 'country.json'))
print(json.dumps(countries[:2]))
result = []
for country in countries:
    code = country['code'].lower()
    # The source includes country and territory flags plus Kosovo.
    if len(code) != 2 or (not country.get('iso') and code != 'xk'):
        continue
    filename = prefix + 'flags/4x3/' + code + '.svg'
    if filename not in archive.namelist():
        raise RuntimeError('Missing flag: ' + code)
    svg = base64.b64encode(archive.read(filename)).decode('ascii')
    result.append({'code': code, 'name': country['name'], 'region': country.get('continent', 'Other'), 'flag': 'data:image/svg+xml;base64,' + svg})
result.sort(key=lambda country: country['name'])
(dist / 'countries.js').write_text('window.FLAG_COUNTRIES = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
(dist / 'flag-icons-LICENSE.txt').write_bytes(archive.read(prefix + 'LICENSE'))
print('Prepared', len(result), 'offline flag assets.')
