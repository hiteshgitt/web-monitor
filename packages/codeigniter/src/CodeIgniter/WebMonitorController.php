<?php

namespace Ruyalab\WebMonitor\CodeIgniter;

use CodeIgniter\CodeIgniter;
use CodeIgniter\Controller;
use CodeIgniter\HTTP\ResponseInterface;
use Ruyalab\WebMonitor\WebMonitorCore;

class WebMonitorController extends Controller
{
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
        ]);

        [$status, $data] = $core->handle($endpoint === 'plugins' ? 'packages' : $endpoint, $this->request->getHeaderLine('Authorization'));

        return $this->response
            ->setStatusCode($status)
            ->setHeader('Cache-Control', 'no-store')
            ->setJSON($data);
    }
}
