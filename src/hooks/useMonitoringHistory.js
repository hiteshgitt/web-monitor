import { useState, useEffect } from 'react';
import ApiService from '../services/api';

const REFRESH_MS = 60000; // matches the backend check interval
const UP_STATUSES = ['healthy', 'warning'];

// Average response time of successful checks, grouped into fixed time buckets for charting
const toLatencySeries = (checks, bucketMinutes) => {
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map();
  checks.forEach((check) => {
    if (!UP_STATUSES.includes(check.status) || check.responseTime == null) return;
    const key = Math.floor(new Date(check.timestamp).getTime() / bucketMs) * bucketMs;
    const bucket = buckets.get(key) || { total: 0, count: 0 };
    bucket.total += check.responseTime;
    bucket.count += 1;
    buckets.set(key, bucket);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, { total, count }]) => ({
      time: new Date(key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      response: Math.round(total / count),
    }));
};

/**
 * Real monitoring checks for a website over the last `hours`, refreshed every minute.
 * Returns checks newest-first, a bucketed latency series, and availability for the window.
 */
const useMonitoringHistory = (websiteId, hours = 24, bucketMinutes = 15) => {
  const [checks, setChecks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!websiteId) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        // One check per minute, so this covers the whole window
        const data = await ApiService.getMonitoringData(websiteId, hours, hours * 60 + 60);
        if (!cancelled) setChecks(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load monitoring history:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [websiteId, hours]);

  const upCount = checks.filter((c) => UP_STATUSES.includes(c.status)).length;

  return {
    checks,
    loaded,
    latencySeries: toLatencySeries(checks, bucketMinutes),
    availability: checks.length > 0 ? Math.round((upCount / checks.length) * 1000) / 10 : null,
  };
};

export default useMonitoringHistory;
