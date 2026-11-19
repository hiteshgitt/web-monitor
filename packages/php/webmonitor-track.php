<?php
/**
 * Optional error tracking for Web Monitor on plain PHP sites. Load it at the very top of your front controller
 * (e.g. the first line of index.php):  require_once __DIR__ . '/api/webmonitor-track.php';
 * or for every script via php.ini / .user.ini:  auto_prepend_file = /full/path/to/api/webmonitor-track.php
 * It only adds a shutdown function that records fatal errors and uncaught exceptions; your error pages and
 * logging are unchanged. Web Monitor reads them from /api/webmonitor/errors.
 */
require_once __DIR__ . '/WebMonitorCore.php';
\Ruyalab\WebMonitor\ErrorTracker::install(null, dirname(__DIR__));
