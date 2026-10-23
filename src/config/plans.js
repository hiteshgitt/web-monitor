// What each plan includes. Shared by the upgrade dialog and the marketing site,
// so the promise and the product never drift apart. Only list features that exist.

export const PLANS = {
  basic: {
    name: 'Basic',
    price: 'Free',
    tagline: 'Know your sites are up, fast and healthy.',
  },
  pro: {
    name: 'Pro',
    price: 'On request',
    tagline: 'Deep analytics, AI insights and audits for every site.',
  },
};

// value: true = included, false = not included, string = included with this detail
export const PLAN_COMPARISON = [
  { group: 'Monitoring' },
  { feature: 'Websites monitored', basic: 'Unlimited', pro: 'Unlimited' },
  { feature: 'Health check frequency', basic: 'Every minute', pro: 'Every minute' },
  { feature: 'Real response time & uptime', basic: true, pro: true },
  { feature: 'Downtime incidents & 30-day history', basic: true, pro: true },
  { feature: 'SEO & security scores with fix checklist', basic: true, pro: true },
  { feature: 'Web dashboard & mobile app', basic: true, pro: true },
  { group: 'Advanced view (Pro)' },
  { feature: 'AI insights & Zealot assistant', basic: false, pro: true },
  { feature: 'Plugin & package audit (outdated, inactive)', basic: false, pro: true },
  { feature: 'Server infrastructure & downtime hours', basic: false, pro: true },
  { feature: 'PageSpeed & Core Web Vitals', basic: false, pro: true },
  { feature: 'Deep security: SSL grade, malware, vulnerabilities', basic: false, pro: true },
  { feature: 'Logs, alert center & CSV reports', basic: false, pro: true },
];
