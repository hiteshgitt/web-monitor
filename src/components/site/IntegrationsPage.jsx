import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, Copy, Download, KeyRound, Code2 } from 'lucide-react';
import Logo from '../Logo';
import PlatformIcon from '../PlatformIcon';

// Zip downloads (WordPress, Core PHP) are built by scripts/build-integration-downloads.py;
// Next.js, Laravel and CodeIgniter install as packages from packages/
const INTEGRATIONS = [
  {
    id: 'wordpress',
    name: 'WordPress',
    platform: 'WordPress',
    download: '/downloads/web-monitor-wordpress.zip',
    summary: 'A single plugin. Upload, activate, copy the API key — done.',
    steps: [
      { title: 'Download the plugin', text: 'Download web-monitor-wordpress.zip below.' },
      { title: 'Upload and activate', text: 'In WordPress admin go to Plugins → Add New → Upload Plugin, choose the zip, then Install and Activate “Web Monitor API (Advanced)”.' },
      { title: 'Copy the API key', text: 'Open Settings → Web Monitor API. A key is generated on activation; copy it.' },
      { title: 'Add the site', text: 'In your dashboard click Add site, enter https://your-site.com, choose WordPress and paste the key.' },
    ],
    snippets: [],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    platform: 'Next.js',
    download: null,
    summary: 'An npm package. One command creates the API route and your key.',
    steps: [
      { title: 'Install the package', text: 'In your Next.js project run the install command below (works with App Router and Pages Router).' },
      { title: 'Run the setup', text: 'npx webmonitor-nextjs init creates app/api/webmonitor/[...slug]/route and saves a new WEBMONITOR_API_KEY in .env.local. It prints the key.' },
      { title: 'Add the key to your host', text: 'Add the same WEBMONITOR_API_KEY to your hosting environment variables (e.g. Vercel → Settings → Environment Variables), then deploy.' },
      { title: 'Add the site', text: 'In the dashboard click Add site, choose Next.js and paste the key.' },
    ],
    snippets: [
      { label: 'Terminal', code: 'npm install @ruyalab/webmonitor-nextjs\nnpx webmonitor-nextjs init' },
      { label: 'Optional: public URL for SEO checks (.env.local)', code: 'WEBMONITOR_SITE_URL=https://your-site.com' },
    ],
  },
  {
    id: 'laravel',
    name: 'Laravel',
    platform: 'Laravel',
    download: null,
    summary: 'A Composer package. Routes register themselves; one command creates the key.',
    steps: [
      { title: 'Install the package', text: 'Run composer require in your Laravel project. It registers /api/webmonitor automatically — no route or controller to edit.' },
      { title: 'Run the setup', text: 'php artisan webmonitor:install saves a new WEBMONITOR_API_KEY in .env and prints it with your site URL.' },
      { title: 'Check APP_URL', text: 'Make sure APP_URL in .env is your public https:// address — it is used for the SEO and security checks.' },
      { title: 'Add the site', text: 'In the dashboard click Add site, choose Laravel and paste the key.' },
    ],
    snippets: [
      { label: 'Terminal', code: 'composer require ruyalab/webmonitor-laravel\nphp artisan webmonitor:install' },
    ],
  },
  {
    id: 'codeigniter',
    name: 'CodeIgniter',
    platform: 'CodeIgniter',
    download: null,
    summary: 'A Composer package for CodeIgniter 4. Routes are discovered automatically.',
    steps: [
      { title: 'Install the package', text: 'Run composer require in your CodeIgniter 4 project. CodeIgniter discovers the /api/webmonitor route by itself.' },
      { title: 'Run the setup', text: 'php spark webmonitor:install saves a new WEBMONITOR_API_KEY in .env and prints it with your site URL.' },
      { title: 'Check the base URL', text: 'Set app.baseURL (or WEBMONITOR_SITE_URL) in .env to your public https:// address.' },
      { title: 'Add the site', text: 'In the dashboard click Add site, choose CodeIgniter and paste the key.' },
    ],
    snippets: [
      { label: 'Terminal', code: 'composer require ruyalab/webmonitor-codeigniter\nphp spark webmonitor:install' },
    ],
  },
  {
    id: 'php',
    name: 'Core PHP',
    platform: 'Core PHP',
    download: '/downloads/web-monitor-php.zip',
    summary: 'Works on any PHP site, with or without a framework. No Composer needed.',
    steps: [
      { title: 'Copy the files', text: 'Download the zip and copy its api/ folder into your site root (your-site/api/webmonitor.php).' },
      { title: 'Set the API key', text: 'Open api/webmonitor-config.php and replace the placeholder with a long random key (openssl rand -hex 32). It is a PHP file on purpose, so the key can’t be downloaded.' },
      { title: 'Route the URL', text: 'Send /api/webmonitor/* to the file with one of the rules below.' },
      { title: 'Add the site', text: 'In the dashboard click Add site, choose Core PHP and paste the same key.' },
    ],
    snippets: [
      { label: 'Apache (.htaccess in site root)', code: 'RewriteEngine On\nRewriteRule ^api/webmonitor/(.*)$ api/webmonitor.php?endpoint=$1 [QSA,L]' },
      { label: 'Nginx (server block)', code: 'location /api/webmonitor/ {\n    rewrite ^/api/webmonitor/(.*)$ /api/webmonitor.php?endpoint=$1 last;\n}' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    platform: 'Custom (any stack)',
    download: null,
    summary: 'Python, Ruby, .NET, Go… implement one small endpoint and you’re monitored.',
    steps: [
      { title: 'Add a health endpoint', text: 'Serve GET /api/webmonitor/health. Reject requests whose Authorization header isn’t “Bearer <your key>” with 401.' },
      { title: 'Return JSON', text: 'Respond with {"status": "healthy"} — or "warning" / "error" when your own checks fail. Optionally include response_time (ms your server spent).' },
      { title: 'Add the site', text: 'In the dashboard click Add site and choose Custom (any stack). Without the endpoint we can still check that the URL is reachable.' },
    ],
    snippets: [
      {
        label: 'Response contract',
        code: 'GET /api/webmonitor/health\nAuthorization: Bearer <your key>\n\n200 OK\n{ "status": "healthy", "response_time": 4.2 }\n\n401 Unauthorized when the key is wrong',
      },
      {
        label: 'Node.js (Express)',
        code: "app.get('/api/webmonitor/health', (req, res) => {\n  if (req.get('Authorization') !== `Bearer ${process.env.WEBMONITOR_API_KEY}`) {\n    return res.status(401).json({ error: 'Invalid API key' });\n  }\n  res.json({ status: 'healthy' });\n});",
      },
      {
        label: 'Python (Flask)',
        code: "@app.get('/api/webmonitor/health')\ndef webmonitor_health():\n    if request.headers.get('Authorization') != f\"Bearer {os.environ['WEBMONITOR_API_KEY']}\":\n        return {'error': 'Invalid API key'}, 401\n    return {'status': 'healthy'}",
      },
    ],
  },
];

const CodeBlock = ({ label, code }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (e.g. non-HTTPS): the code is still selectable
    }
  };
  return (
    <div className="rounded-2xl overflow-hidden bg-ink text-white shadow-card">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 text-[12px] font-bold text-white/70">
        <span>{label}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1.5 hover:text-white transition-colors">
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <pre className="px-4 py-3.5 text-[13px] leading-relaxed overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
};

const IntegrationsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const fromHash = location.hash.replace('#', '');
  const [active, setActive] = useState(INTEGRATIONS.some((i) => i.id === fromHash) ? fromHash : 'wordpress');
  const integration = INTEGRATIONS.find((i) => i.id === active);

  useEffect(() => {
    document.title = 'Integrations · Web Monitor';
    return () => { document.title = 'Web Monitor Dashboard'; };
  }, []);

  const select = (id) => {
    setActive(id);
    navigate(`/integrations#${id}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="relative overflow-hidden bg-linear-to-br from-brand-400 via-brand-500 to-brand-700 text-white">
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-white/10 animate-float" />
        <div className="relative max-w-6xl mx-auto px-5 pt-8 pb-24">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <Logo variant="white" className="h-6" />
              <span className="font-extrabold text-lg tracking-tight">Web Monitor</span>
            </Link>
            <Link to="/signup" className="h-10 px-5 rounded-xl bg-white text-brand-700 font-bold text-[12px] uppercase tracking-wider flex items-center gap-2 hover:-translate-y-0.5 transition-transform">
              Get started <ArrowRight size={14} />
            </Link>
          </div>
          <h1 className="mt-14 text-4xl sm:text-5xl font-extrabold tracking-tight">Integrations</h1>
          <p className="mt-4 text-white/80 text-lg max-w-2xl">
            Install a small integration on your site so Web Monitor can read real health, performance, SEO and
            security data. Pick your platform — each takes a few minutes.
          </p>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-5 -mt-14 pb-20">
        {/* Platform picker */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {INTEGRATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item.id)}
              className={`rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-300
                bg-white ${active === item.id ? 'shadow-card-hover -translate-y-1 ring-2 ring-brand-500' : 'shadow-card hover:-translate-y-0.5 hover:shadow-card-hover'}`}
            >
              {item.id === 'custom'
                ? <Code2 size={28} className="text-brand-600" />
                : <PlatformIcon platform={item.id} className="w-7 h-7" />}
              <span className="text-[13px] font-bold text-ink">{item.name}</span>
            </button>
          ))}
        </div>

        {/* Selected guide */}
        <section key={integration.id} className="mt-8 grid lg:grid-cols-2 gap-8 animate-fade-in">
          <div className="panel p-7 sm:p-9 min-w-0">
            <h2 className="text-2xl font-extrabold text-ink">{integration.name}</h2>
            <p className="mt-2 text-ink-muted">{integration.summary}</p>
            <ol className="mt-8 space-y-6">
              {integration.steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="w-9 h-9 rounded-xl bg-linear-to-br from-brand-400 to-brand-600 text-white font-extrabold flex items-center justify-center shrink-0 shadow-btn">{i + 1}</span>
                  <div>
                    <h3 className="font-bold text-ink">{step.title}</h3>
                    <p className="mt-1 text-[14px] text-ink-soft leading-relaxed">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-9 flex flex-wrap gap-3">
              {integration.download && (
                <a href={integration.download} download className="btn-primary !h-12 !px-6">
                  <Download size={16} /> Download {integration.name} integration
                </a>
              )}
              <Link to="/signup" className="h-12 px-6 rounded-xl border border-brand-200 text-brand-700 font-bold text-[12px] uppercase tracking-wider flex items-center gap-2 hover:bg-brand-50">
                Add your site <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="space-y-4 min-w-0">
            {integration.snippets.map((snippet) => <CodeBlock key={snippet.label} {...snippet} />)}
            <div className="panel p-5 flex gap-3">
              <KeyRound size={20} className="text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[14px] text-ink-soft leading-relaxed">
                <span className="font-bold text-ink">About the API key.</span> It lets only Web Monitor read your
                site’s health data. Use a long random value, keep it secret, and enter the same key in the dashboard
                when you add the site (platform: <span className="font-semibold">{integration.platform}</span>).
              </p>
            </div>
          </div>
        </section>

        <div className="mt-12 flex justify-between text-sm font-semibold">
          <Link to="/" className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-800"><ArrowLeft size={15} /> Back to website</Link>
          <span className="flex gap-4 text-ink-muted">
            <Link to="/privacy" className="hover:text-brand-600">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-600">Terms</Link>
          </span>
        </div>
      </main>
    </div>
  );
};

export default IntegrationsPage;
