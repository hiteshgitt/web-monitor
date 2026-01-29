<?php
/**
 * Laravel Routes Example
 * 
 * Add this to your routes/api.php file:
 */

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\WebMonitorController;

Route::prefix('webmonitor')->group(function () {
    Route::get('/{endpoint}', [WebMonitorController::class, 'handle']);
});

// Or with middleware for additional security:
// Route::prefix('webmonitor')->middleware('throttle:60,1')->group(function () {
//     Route::get('/{endpoint}', [WebMonitorController::class, 'handle']);
// });

