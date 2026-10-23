#!/usr/bin/env python3
"""Copy the shared PHP core (packages/php-core/WebMonitorCore.php) into every PHP package.

Each package is published from its own repository, so it ships its own copy; this keeps them identical.
Run after editing the core:  python3 scripts/sync-php-core.py
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORE = ROOT / 'packages' / 'php-core' / 'WebMonitorCore.php'
TARGETS = [
    ROOT / 'packages' / 'laravel' / 'src' / 'WebMonitorCore.php',
    ROOT / 'packages' / 'codeigniter' / 'src' / 'WebMonitorCore.php',
    ROOT / 'packages' / 'php' / 'WebMonitorCore.php',
]

if __name__ == '__main__':
    for target in TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(CORE, target)
        print(f'synced {target.relative_to(ROOT)}')
