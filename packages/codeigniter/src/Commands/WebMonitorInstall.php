<?php

namespace Ruyalab\WebMonitor\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * php spark webmonitor:install
 * Generates WEBMONITOR_API_KEY in .env (keeps an existing key unless --new) and prints it for the dashboard.
 */
class WebMonitorInstall extends BaseCommand
{
    protected $group = 'Web Monitor';
    protected $name = 'webmonitor:install';
    protected $description = 'Set up Web Monitor: create the API key and show the connection details.';
    protected $usage = 'webmonitor:install [--new]';
    protected $options = ['--new' => 'Replace the existing key with a new one'];

    public function run(array $params)
    {
        $envPath = ROOTPATH . '.env';
        if (!is_file($envPath)) {
            // CodeIgniter ships an "env" template; start from it
            if (is_file(ROOTPATH . 'env')) {
                copy(ROOTPATH . 'env', $envPath);
            } else {
                file_put_contents($envPath, '');
            }
        }

        $env = (string) file_get_contents($envPath);
        $existing = preg_match('/^WEBMONITOR_API_KEY\s*=\s*(.*)$/m', $env, $m) ? trim($m[1], " \"'") : '';
        $replace = array_key_exists('new', $params) || CLI::getOption('new');

        if ($existing !== '' && !$replace) {
            $key = $existing;
            CLI::write('Web Monitor is already set up. Existing API key kept (use --new to replace it).', 'green');
        } else {
            $key = bin2hex(random_bytes(32));
            $line = "WEBMONITOR_API_KEY = {$key}";
            $env = preg_match('/^#?\s*WEBMONITOR_API_KEY\s*=.*$/m', $env)
                ? preg_replace('/^#?\s*WEBMONITOR_API_KEY\s*=.*$/m', $line, $env)
                : rtrim($env, "\n") . "\n\n{$line}\n";
            file_put_contents($envPath, $env);
            CLI::write('API key saved to .env as WEBMONITOR_API_KEY.', 'green');
        }

        $url = rtrim(env('WEBMONITOR_SITE_URL') ?: (string) config('App')->baseURL, '/');
        CLI::newLine();
        CLI::write('  Add this site in your Web Monitor dashboard:');
        CLI::write('  ' . CLI::color('URL', 'yellow') . "       {$url}");
        CLI::write('  ' . CLI::color('Platform', 'yellow') . '  CodeIgniter');
        CLI::write('  ' . CLI::color('API key', 'yellow') . "   {$key}");
        CLI::newLine();
        CLI::write("  Test: curl -H \"Authorization: Bearer {$key}\" {$url}/api/webmonitor/health");
    }
}
