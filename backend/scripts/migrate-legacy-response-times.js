/**
 * One-time fix for checks stored before real round-trip timing was added.
 *
 * Those checks saved the integration's own PHP/Node processing time (e.g. 0.2 ms) as
 * `responseTime`. This moves that value to `metrics.serverProcessingTime` and clears
 * `responseTime`, so charts and trends only use real response times. Status and
 * uptime history are untouched. Safe to run more than once.
 *
 * Usage (from backend/): node scripts/migrate-legacy-response-times.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env'), quiet: true });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webmonitor');
  const collection = mongoose.connection.db.collection('monitoringdatas');

  // New-style checks always have metrics.serverProcessingTime (possibly null); legacy ones don't
  const result = await collection.updateMany(
    { 'metrics.serverProcessingTime': { $exists: false }, responseTime: { $ne: null } },
    [{
      $set: {
        'metrics.serverProcessingTime': '$responseTime',
        'metrics.loadTime': null,
        responseTime: null
      }
    }]
  );

  console.log(`Legacy checks updated: ${result.modifiedCount}`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
