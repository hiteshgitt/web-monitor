<?php

/**
 * Discovered automatically by CodeIgniter 4 (Config\Modules: discoverInComposer).
 * Error tracking for Web Monitor: fatal errors (shutdown) and uncaught exceptions. CodeIgniter's own exception
 * handler is wrapped, not replaced: the error is recorded, then CodeIgniter handles it exactly as before.
 */

use CodeIgniter\Events\Events;
use Ruyalab\WebMonitor\ErrorTracker;

Events::on('pre_system', static function (): void {
    ErrorTracker::install(null, defined('ROOTPATH') ? ROOTPATH : null);
    $previous = set_exception_handler(null);
    set_exception_handler(static function (\Throwable $e) use ($previous): void {
        ErrorTracker::recordThrowable($e);
        if (is_callable($previous)) {
            $previous($e);
        } else {
            throw $e;
        }
    });
});
