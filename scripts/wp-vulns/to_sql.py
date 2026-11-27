#!/usr/bin/env python3
"""Turn extract.py rows into D1 SQL. Only rows whose hash changed are written (pass the current hashes as JSON from
`SELECT cve, slug, hash FROM wp_vulns`); rejected CVEs are deleted. A full sync also deletes rows that are no longer
in the CVE List.

Usage: python3 -I to_sql.py rows.jsonl --mode full|delta --source <release> [--existing hashes.json] > sync.sql
"""
import argparse, json, sys

def q(v):
    if v is None: return 'NULL'
    if isinstance(v, (int, float)): return repr(v)
    return "'" + str(v).replace("'", "''") + "'"

ap = argparse.ArgumentParser()
ap.add_argument('rows'); ap.add_argument('--mode', choices=['full', 'delta'], required=True)
ap.add_argument('--source', required=True); ap.add_argument('--existing')
a = ap.parse_args()

existing = {}
if a.existing:
    data = json.load(open(a.existing))
    rows = data[0]['results'] if isinstance(data, list) and data and 'results' in data[0] else data
    existing = {(r['cve'], r['slug']): r['hash'] for r in rows}

rows = [json.loads(l) for l in open(a.rows) if l.strip()]
live = {(r['cve'], r['slug']): r for r in rows if not r.get('rejected')}
# A full sync removes anything not in the list anyway; deltas carry the few CVEs rejected today.
rejected = sorted({r['cve'] for r in rows if r.get('rejected')}) if a.mode == 'delta' else []
out, written = [], 0
for key, r in live.items():
    if existing.get(key) == r['hash']:
        continue
    written += 1
    out.append('INSERT INTO wp_vulns (cve, slug, title, ranges, cvss_score, cvss_vector, severity, published, url, hash) VALUES ('
               + ', '.join(q(x) for x in [r['cve'], r['slug'], r['title'], json.dumps(r['ranges'], separators=(',', ':')), r['cvss_score'],
                                          r['cvss_vector'], r['severity'], r['published'], r['url'], r['hash']])
               + ') ON CONFLICT (cve, slug) DO UPDATE SET title = excluded.title, ranges = excluded.ranges, cvss_score = excluded.cvss_score, '
               'cvss_vector = excluded.cvss_vector, severity = excluded.severity, published = excluded.published, url = excluded.url, hash = excluded.hash;')
for cve in rejected:
    out.append(f'DELETE FROM wp_vulns WHERE cve = {q(cve)};')
removed = 0
if a.mode == 'full':
    for (cve, slug) in existing:
        if (cve, slug) not in live:
            removed += 1
            out.append(f'DELETE FROM wp_vulns WHERE cve = {q(cve)} AND slug = {q(slug)};')
out.append('INSERT INTO wp_vulns_sync (id, synced_at, mode, source, row_count) VALUES (1, '
           f"strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), {q(a.mode)}, {q(a.source)}, (SELECT count(*) FROM wp_vulns)) "
           'ON CONFLICT (id) DO UPDATE SET synced_at = excluded.synced_at, mode = excluded.mode, source = excluded.source, row_count = excluded.row_count;')
sys.stdout.write('\n'.join(out) + '\n')
print(f'{written} rows written, {len(rejected)} rejected CVEs, {removed} removed', file=sys.stderr)
