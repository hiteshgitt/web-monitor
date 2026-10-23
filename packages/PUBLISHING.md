# Publishing the integration packages

| Package | Folder | Registry |
|---|---|---|
| `@ruyalab/webmonitor-nextjs` | `packages/nextjs` | npm |
| `ruyalab/webmonitor-laravel` | `packages/laravel` | Packagist (Composer) |
| `ruyalab/webmonitor-codeigniter` | `packages/codeigniter` | Packagist (Composer) |

The PHP packages share one core: edit `packages/php-core/WebMonitorCore.php`, then run
`python3 scripts/sync-php-core.py` (copies it into each PHP package and the Core PHP zip).
After changing the WordPress plugin or Core PHP files, run `python3 scripts/build-integration-downloads.py`.

## npm (Next.js)

One-time: create the free `ruyalab` organization on npmjs.com and enable 2FA.

```bash
cd packages/nextjs
npm login                 # opens the browser; no token needed
npm publish               # publishes @ruyalab/webmonitor-nextjs (public)
```

For a new release: bump `version` in `package.json` (and `VERSION` in `src/core.js`), then `npm publish`.

## Packagist (Laravel, CodeIgniter)

Packagist reads packages from **public** Git repositories with `composer.json` at the repository root,
so each PHP package lives in its own public repo (they contain only the integration code):

1. Create public GitHub repos, e.g. `ruyalab/webmonitor-laravel` and `ruyalab/webmonitor-codeigniter`.
2. Push the folder contents to each (from this repo):
   ```bash
   git subtree split --prefix=packages/laravel -b split-laravel
   git push git@github.com:ruyalab/webmonitor-laravel.git split-laravel:main
   git subtree split --prefix=packages/codeigniter -b split-codeigniter
   git push git@github.com:ruyalab/webmonitor-codeigniter.git split-codeigniter:main
   ```
3. Tag a version in each repo: `git tag v1.0.0 && git push --tags`.
4. On packagist.org → **Submit**, paste each repo URL. Enable the GitHub hook so new tags publish
   automatically.

For a new release: sync the core, push with the subtree commands above, and tag the next version.
