#!/usr/bin/env python3
"""WordPress plugin vulnerabilities from the official CVE List (github.com/CVEProject/cvelistV5).

Reads a CVE List zip (the daily full "all_CVEs_at_midnight.zip.zip", whose cves.zip is nested inside, or an hourly
"delta_CVEs" zip) and writes one JSON line per (CVE, plugin slug):
  {"cve", "slug", "title", "ranges", "cvss_vector", "cvss_score", "severity", "published", "url", "rejected", "hash"}

A CVE counts as a WordPress plugin vulnerability only when its references name a plugin slug on wordpress.org,
plugins.trac.wordpress.org, Wordfence, Patchstack or WPScan, and its affected versions can be read. Nothing is guessed:
a record without a readable version range is skipped.

Usage: python3 -I extract.py <zip> [<zip> ...] > rows.jsonl
"""
import hashlib, io, json, re, shutil, sys, tempfile, zipfile
from collections import Counter

SLUG_PATTERNS = [re.compile(p) for p in (
    r'https?://plugins\.trac\.wordpress\.org/(?:browser|log|changeset/\d+)/([a-z0-9][a-z0-9-]{0,99})(?:[/?#]|$)',
    r'https?://(?:[a-z]{2,3}\.)?wordpress\.org/plugins/([a-z0-9][a-z0-9-]{0,99})(?:[/?#]|$)',
    r'https?://(?:www\.)?wordfence\.com/threat-intel/vulnerabilities/wordpress-plugins/([a-z0-9][a-z0-9-]{0,99})/',
    r'https?://patchstack\.com/database/(?:wordpress/plugin|vulnerability)/([a-z0-9][a-z0-9-]{0,99})/',
    r'https?://wpscan\.com/plugin/([a-z0-9][a-z0-9-]{0,99})(?:[/?#]|$)',
)]
NOT_SLUGS = {'tags', 'trunk', 'branches', 'wordpress', 'plugin', 'plugins', 'database', 'vulnerability'}
ADVISORY_HOSTS = ('wordfence.com', 'patchstack.com', 'wpscan.com')
NO_LOWER = {'', '*', '0', 'n/a', '-', 'all', 'unspecified'}

def cvss3_score(vector):
    """CVSS v3.x base score (FIRST CVSS v3.1 spec, section 7); None when it cannot be scored. Same as the Worker's."""
    parts = str(vector or '').split('/')
    if not re.fullmatch(r'CVSS:3\.[01]', parts[0]):
        return None
    m = dict(p.split(':', 1) for p in parts[1:] if ':' in p)
    W = {'AV': {'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.2}, 'AC': {'L': 0.77, 'H': 0.44}, 'UI': {'N': 0.85, 'R': 0.62},
         'C': {'H': 0.56, 'L': 0.22, 'N': 0}, 'I': {'H': 0.56, 'L': 0.22, 'N': 0}, 'A': {'H': 0.56, 'L': 0.22, 'N': 0}}
    scope = m.get('S')
    pr = ({'N': 0.85, 'L': 0.68, 'H': 0.5} if scope == 'C' else {'N': 0.85, 'L': 0.62, 'H': 0.27}).get(m.get('PR'))
    vals = {k: W[k].get(m.get(k)) for k in W}
    if scope not in ('U', 'C') or pr is None or any(v is None for v in vals.values()):
        return None
    iss = 1 - (1 - vals['C']) * (1 - vals['I']) * (1 - vals['A'])
    impact = 6.42 * iss if scope == 'U' else 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15
    if impact <= 0:
        return 0.0
    expl = 8.22 * vals['AV'] * vals['AC'] * pr * vals['UI']
    x = min(impact + expl if scope == 'U' else 1.08 * (impact + expl), 10)
    i = round(x * 100000)
    return i / 100000 if i % 10000 == 0 else (i // 10000 + 1) / 10

def slug_of(urls):
    found = Counter()
    for u in urls:
        for p in SLUG_PATTERNS:
            mm = p.search(u)
            if mm and mm.group(1) not in NOT_SLUGS:
                found[mm.group(1)] += 1
    return found.most_common(1)[0][0] if found else None

def ranges_of(affected):
    out = []
    for a in affected or []:
        for v in a.get('versions') or []:
            if v.get('status') != 'affected':
                continue
            lower = str(v.get('version') or '').strip()
            lt, lte = v.get('lessThan'), v.get('lessThanOrEqual')
            lt = None if str(lt or '').strip() in NO_LOWER else str(lt).strip()
            lte = None if str(lte or '').strip() in NO_LOWER else str(lte).strip()
            if lt or lte:
                out.append({'from': None if lower.lower() in NO_LOWER else lower, 'lt': lt, 'lte': lte})
            elif lower.lower() not in NO_LOWER and re.match(r'^\d', lower):
                out.append({'exact': lower})
    uniq = {json.dumps(r, sort_keys=True) for r in out}
    return [json.loads(r) for r in sorted(uniq)]

def cvss_of(containers):
    best = None
    for c in [containers.get('cna') or {}] + list(containers.get('adp') or []):
        for m in c.get('metrics') or []:
            for key in ('cvssV3_1', 'cvssV3_0'):
                vec = (m.get(key) or {}).get('vectorString')
                score = cvss3_score(vec)
                if score is not None and (best is None or score > best[1]):
                    best = (vec, score)
        if best:
            return best  # the CNA's own score wins over ADP enrichment
    return best or (None, None)

def severity(score):
    if score is None: return 'unknown'
    return 'critical' if score >= 9 else 'high' if score >= 7 else 'moderate' if score >= 4 else 'low' if score > 0 else 'unknown'

def row_of(rec):
    meta = rec.get('cveMetadata') or {}
    cve = meta.get('cveId')
    if not cve:
        return None
    if meta.get('state') == 'REJECTED':
        return {'cve': cve, 'rejected': True}  # rejected records lose their references; remove the CVE everywhere
    containers = rec.get('containers') or {}
    cna = containers.get('cna') or {}
    urls = [r.get('url', '') for r in cna.get('references') or []]
    slug = slug_of(urls)
    if not slug:
        return None
    desc = next((d.get('value') for d in cna.get('descriptions') or [] if str(d.get('lang', '')).startswith('en')), '')
    about = ' '.join([cna.get('title') or '', desc or ''] + [str(a.get('product') or '') for a in cna.get('affected') or []])
    if re.search(r'\btheme\b', about, re.I) and not re.search(r'\bplugin\b', about, re.I):
        return None  # a theme; the integration reports plugins, and slugs can collide
    ranges = ranges_of(cna.get('affected'))
    if not ranges:
        return None
    vec, score = cvss_of(containers)
    title = (cna.get('title') or desc or cve).strip().replace('\n', ' ')[:200]
    url = next((u for u in urls if any(h in u for h in ADVISORY_HOSTS)), f'https://www.cve.org/CVERecord?id={cve}')
    row = {'cve': cve, 'slug': slug, 'title': title, 'ranges': ranges, 'cvss_vector': vec, 'cvss_score': score,
           'severity': severity(score), 'published': (meta.get('datePublished') or '')[:10] or None, 'url': url[:500], 'rejected': False}
    row['hash'] = hashlib.sha1(json.dumps(row, sort_keys=True).encode()).hexdigest()[:16]
    return row

def records(path):
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        if names == ['cves.zip']:  # the daily full release nests the real archive
            with tempfile.TemporaryFile() as tmp:
                with z.open('cves.zip') as inner:
                    shutil.copyfileobj(inner, tmp, 1 << 20)
                tmp.seek(0)
                with zipfile.ZipFile(tmp) as z2:
                    yield from _json_entries(z2)
        else:
            yield from _json_entries(z)

def _json_entries(z):
    for n in z.namelist():
        if re.search(r'CVE-\d{4}-\d+\.json$', n):
            try:
                yield json.loads(z.read(n))
            except ValueError:
                continue

if __name__ == '__main__':
    seen = 0
    for path in sys.argv[1:]:
        for rec in records(path):
            seen += 1
            r = row_of(rec)
            if r:
                sys.stdout.write(json.dumps(r, separators=(',', ':')) + '\n')
    print(f'scanned {seen} CVE records', file=sys.stderr)
