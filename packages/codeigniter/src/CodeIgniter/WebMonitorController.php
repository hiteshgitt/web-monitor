<?php

namespace Ruyalab\WebMonitor\CodeIgniter;

use CodeIgniter\CodeIgniter;
use CodeIgniter\Controller;
use CodeIgniter\HTTP\ResponseInterface;
use Ruyalab\WebMonitor\WebMonitorCore;

class WebMonitorController extends Controller
{
    /** CodeIgniter checks: database connection and a writable writable/ folder. */
    public static function components(): array
    {
        $out = [];
        $out[] = WebMonitorCore::guard('database', 'Database', function () {
            $start = microtime(true);
            $db = \Config\Database::connect();
            $db->initialize();
            $db->query('SELECT 1');
            $ms = round((microtime(true) - $start) * 1000);
            return WebMonitorCore::component('database', 'Database', $ms > 1000 ? 'warning' : 'ok', "Connected ({$db->DBDriver}, {$ms} ms).");
        }, 'Check the database server is running and the database settings in .env (database.default.*).');
        $writable = is_writable(WRITEPATH) && is_writable(WRITEPATH . 'logs');
        $out[] = WebMonitorCore::component('storage', 'writable/ folder', $writable ? 'ok' : 'error',
            $writable ? 'writable/ is writable.' : 'writable/ or writable/logs is not writable.',
            $writable ? null : 'Give the web server user write access to the writable/ folder.');
        if (ENVIRONMENT === 'development' && !in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1'], true)) {
            $out[] = WebMonitorCore::component('debug_mode', 'Environment', 'warning', 'CI_ENVIRONMENT is "development" on a public site: errors show code to visitors.',
                'Set CI_ENVIRONMENT = production in .env.');
        }
        return $out;
    }

    public function handle(string $endpoint = 'health'): ResponseInterface
    {
        $siteUrl = env('WEBMONITOR_SITE_URL') ?: rtrim((string) config('App')->baseURL, '/');
        $core = new WebMonitorCore([
            'apiKey' => (string) env('WEBMONITOR_API_KEY', ''),
            'framework' => 'CodeIgniter',
            'frameworkVersion' => CodeIgniter::CI_VERSION,
            'basePath' => ROOTPATH,
            'debug' => ENVIRONMENT !== 'production',
            'siteUrl' => $siteUrl ?: null,
            'logPaths' => [WRITEPATH . 'logs/log-' . date('Y-m-d') . '.log'],
            'components' => $endpoint === 'health' ? [self::class, 'components'] : null,
        ]);

        [$status, $data] = $core->handle($endpoint === 'plugins' ? 'packages' : $endpoint, $this->request->getHeaderLine('Authorization'));

        return $this->response
            ->setStatusCode($status)
            ->setHeader('Cache-Control', 'no-store')
            ->setJSON($data);
    }
}
