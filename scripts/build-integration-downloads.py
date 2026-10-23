#!/usr/bin/env python3
"""Package the zip-installed integrations (WordPress plugin, Core PHP) into public/downloads/.

Next.js, Laravel and CodeIgniter install from npm/Composer instead (see packages/).

Files are laid out exactly where they go in the customer's project, with a short README.
Re-run after changing wordpress-plugin/ or packages/php*/:

    python3 scripts/build-integration-downloads.py
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'downloads'
PACKAGES_DIR = ROOT / 'packages'

API_KEY_TIP = (
    'Generate a long random API key, e.g.:\n'
    '  openssl rand -hex 32\n'
    'Use the same key in your site and in the Web Monitor dashboard.\n'
)

PACKAGES = {
    'web-monitor-wordpress.zip': {
        'files': {
            'web-monitor-api/web-monitor-api-advanced.php': ROOT / 'wordpress-plugin' / 'web-monitor-api-advanced.php',
        },
        'readme': (
            'Web Monitor - WordPress plugin\n\n'
            '1. WordPress admin -> Plugins -> Add New -> Upload Plugin -> choose this zip -> Install -> Activate.\n'
            '2. Settings -> Web Monitor API: copy the API key (generated on activation).\n'
            '3. In the Web Monitor dashboard: Add site -> your site URL (https://your-site.com),\n'
            '   platform WordPress, paste the API key.\n'
        ),
    },
    'web-monitor-php.zip': {
        'files': {
            'api/webmonitor.php': PACKAGES_DIR / 'php' / 'webmonitor.php',
            'api/WebMonitorCore.php': PACKAGES_DIR / 'php-core' / 'WebMonitorCore.php',
        },
        'extra': {
            'api/webmonitor-config.php': (
                "<?php\n"
                "// Web Monitor settings. This is a PHP file on purpose: the web server runs it instead of\n"
                "// sending it, so your key can't be downloaded. Paste the same key into the dashboard.\n"
                "return [\n"
                "    'api_key' => 'paste-a-long-random-key-here',   // generate with: openssl rand -hex 32\n"
                "    'site_url' => null,                            // e.g. 'https://your-site.com' (optional)\n"
                "];\n"
            ),
        },
        'readme': (
            'Web Monitor - Core PHP integration (works for any PHP site)\n\n'
            '1. Copy the api/ folder into your site root (your-site/api/webmonitor.php).\n'
            '2. Edit api/webmonitor-config.php and set api_key (never put keys in a .env file inside the web root:\n'
            '   many servers let anyone download it).\n'
            '3. Route /api/webmonitor/* to the file.\n\n'
            '   Apache - add to the .htaccess in your site root:\n'
            '     RewriteEngine On\n'
            '     RewriteRule ^api/webmonitor/(.*)$ api/webmonitor.php?endpoint=$1 [QSA,L]\n\n'
            '   Nginx - inside your server block:\n'
            '     location /api/webmonitor/ {\n'
            '         rewrite ^/api/webmonitor/(.*)$ /api/webmonitor.php?endpoint=$1 last;\n'
            '     }\n\n'
            + API_KEY_TIP +
            '\nIn the dashboard: Add site -> platform Core PHP.\n'
        ),
    },
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # Remove packages that are no longer distributed as zips
    for old in OUT.glob('web-monitor-*.zip'):
        if old.name not in PACKAGES:
            old.unlink()
    for name, spec in PACKAGES.items():
        with zipfile.ZipFile(OUT / name, 'w', zipfile.ZIP_DEFLATED) as archive:
            for target, source in spec['files'].items():
                archive.write(source, target)
            for target, text in spec.get('extra', {}).items():
                archive.writestr(target, text)
            archive.writestr('README.txt', spec['readme'])
        print(f'{name}: {(OUT / name).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
