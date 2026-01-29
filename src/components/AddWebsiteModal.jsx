import React, { useState } from 'react';
import { X, Globe, Info, Copy, CheckCircle2, Sparkles, Key, Eye } from 'lucide-react';
import ApiService from '../services/api';

const AddWebsiteModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    platform: 'wordpress',
    apiKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [discoveredInfo, setDiscoveredInfo] = useState(null); // { url, platform }
  const [showApiKey, setShowApiKey] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate form
      if (!formData.name || !formData.apiKey) {
        setError('Please fill in name and API key');
        setLoading(false);
        return;
      }

      // Auto-discover URL and platform from API key
      let testUrl = formData.url;
      let detectedPlatform = null;
      
      if (!testUrl || testUrl.trim() === '') {
        const commonUrls = [
          'http://localhost:8000',
          'http://127.0.0.1:8000',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost',
          'http://127.0.0.1'
        ];
        
        // Try to discover URL and platform by testing common patterns
        let discoveredUrl = null;
        for (const url of commonUrls) {
          // Try WordPress first
          try {
            const wpEndpoint = `${url}/wp-json/webmonitor-advanced/v1/health`;
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 2000)
            );
            const fetchPromise = fetch(wpEndpoint, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${formData.apiKey}` }
            });
            const testRes = await Promise.race([fetchPromise, timeoutPromise]);
            if (testRes && testRes.ok) {
              discoveredUrl = url;
              detectedPlatform = 'wordpress';
              break;
            }
          } catch (_) {}
          
          // Try Next.js/PHP/Laravel
          try {
            const apiEndpoint = `${url}/api/webmonitor/health`;
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 2000)
            );
            const fetchPromise = fetch(apiEndpoint, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${formData.apiKey}` }
            });
            const testRes = await Promise.race([fetchPromise, timeoutPromise]);
            if (testRes && testRes.ok) {
              const data = await testRes.json();
              discoveredUrl = url;
              // Detect platform from response
              if (data.framework_version && data.framework_version.includes('Laravel')) {
                detectedPlatform = 'laravel';
              } else if (data.framework_version && data.framework_version.includes('CodeIgniter')) {
                detectedPlatform = 'codeigniter';
              } else if (data.nextjs_version) {
                detectedPlatform = 'nextjs';
              } else {
                detectedPlatform = 'php';
              }
              break;
            }
          } catch (_) {}
        }
        
        if (!discoveredUrl) {
          setError('Could not auto-discover URL. Please enter the website URL manually.');
          setLoading(false);
          return;
        }
        
        testUrl = discoveredUrl;
        formData.url = discoveredUrl;
        formData.platform = detectedPlatform || 'wordpress';
        setDiscoveredInfo({ url: discoveredUrl, platform: detectedPlatform || 'wordpress' });
      }
      
      // Normalize URL (remove trailing slash) and update formData
      testUrl = testUrl.replace(/\/$/, '');
      formData.url = testUrl;
      setFormData(prev => ({ ...prev, url: testUrl, platform: detectedPlatform || prev.platform }));

      // Validate API key by testing connection
      const platform = detectedPlatform || formData.platform;
      if (platform === 'wordpress') {
        try {
          const response = await fetch(`${testUrl}/wp-json/webmonitor-advanced/v1/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${formData.apiKey}`
            }
          });

          if (!response.ok) {
            if (response.status === 401) {
              setError('Invalid API key. Please check your API key from WordPress Settings → Web Monitor API');
              setLoading(false);
              return;
            } else if (response.status === 404) {
              setError('WordPress plugin not found. Please install the Web Monitor plugin first.');
              setLoading(false);
              return;
            } else {
              setError(`Connection failed: ${response.statusText}`);
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('API key validation error:', error);
          setError('Unable to connect to WordPress site. Please check the URL and ensure the plugin is installed.');
          setLoading(false);
          return;
        }
      } else if (platform === 'nextjs') {
        // Next.js validation
        try {
          const response = await fetch(`${testUrl}/api/webmonitor/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${formData.apiKey}`
            }
          });

          if (!response.ok) {
            if (response.status === 401) {
              setError('Invalid API key. Please check your API key from .env.local (WEBMONITOR_API_KEY)');
            } else if (response.status === 404) {
              setError('Next.js API route not found (404).\n\nPlease check:\n1. Run: node nextjs-integration/install.js\n2. Restart your Next.js server\n3. Verify file exists: app/api/webmonitor/[...slug]/route.ts');
            } else {
              setError(`Connection failed: ${response.status} ${response.statusText}`);
            }
            setLoading(false);
            return;
          }

          const data = await response.json();
          if (data.status !== 'healthy') {
            setError('Next.js site returned unhealthy status');
            setLoading(false);
            return;
          }
          
          // Get URL from API if available
          if (data.url || data.site_url) {
            const apiUrl = (data.url || data.site_url || '').replace(/\/$/, '');
            if (apiUrl && apiUrl !== testUrl) {
              testUrl = apiUrl;
              formData.url = apiUrl;
              setFormData(prev => ({ ...prev, url: apiUrl }));
              setDiscoveredInfo(prev => ({ ...prev, url: apiUrl }));
            }
          }
        } catch (err) {
          console.error('Next.js connection error:', err);
          let errorMsg = 'Unable to connect to Next.js site. Connection failed.\n\nPlease check:\n1. Next.js server is running\n2. API route is installed: app/api/webmonitor/[...slug]/route.ts (or pages/api/webmonitor/[...slug].ts)\n3. Restart Next.js server after installation\n4. Check URL is correct (no trailing slash)';
          setError(errorMsg);
          setLoading(false);
          return;
        }
      } else if (['laravel', 'codeigniter', 'php'].includes(platform)) {
        // PHP validation (Laravel, CodeIgniter, Core PHP)
        try {
          const response = await fetch(`${testUrl}/api/webmonitor/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${formData.apiKey}`
            }
          });

          if (!response.ok) {
            if (response.status === 401) {
              setError(`Invalid API key. Please check your API key from .env (WEBMONITOR_API_KEY)`);
            } else if (response.status === 404) {
              const frameworkName = formData.platform === 'laravel' ? 'Laravel' : 
                                   formData.platform === 'codeigniter' ? 'CodeIgniter' : 'PHP';
              setError(`${frameworkName} API route not found (404).\n\nPlease check:\n1. Run: node php-integration/install.js\n2. Verify file is installed correctly\n3. Check routes are configured\n4. Restart your PHP server/web server`);
            } else {
              setError(`Connection failed: ${response.status} ${response.statusText}`);
            }
            setLoading(false);
            return;
          }

          const data = await response.json();
          if (data.status !== 'healthy') {
            setError(`${platform} site returned unhealthy status`);
            setLoading(false);
            return;
          }
          
          // Detect platform from response if not already detected
          if (!detectedPlatform && data.framework_version) {
            if (data.framework_version.includes('Laravel')) {
              detectedPlatform = 'laravel';
              formData.platform = 'laravel';
              setFormData(prev => ({ ...prev, platform: 'laravel' }));
            } else if (data.framework_version.includes('CodeIgniter')) {
              detectedPlatform = 'codeigniter';
              formData.platform = 'codeigniter';
              setFormData(prev => ({ ...prev, platform: 'codeigniter' }));
            }
          }
          
          // Optional: use URL from API if returned (auto-fetch URL from integration)
          if (data.url || data.site_url) {
            const apiUrl = (data.url || data.site_url || '').replace(/\/$/, '');
            if (apiUrl && apiUrl !== testUrl) {
              testUrl = apiUrl;
              formData.url = apiUrl;
              setFormData(prev => ({ ...prev, url: apiUrl }));
              setDiscoveredInfo(prev => ({ ...prev, url: apiUrl }));
            }
          }
          // Validate packages endpoint so dashboard doesn't show "Healthy" then fail on Packages tab
          const packagesRes = await fetch(`${testUrl}/api/webmonitor/packages`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${formData.apiKey}` }
          });
          const packagesCt = packagesRes.headers.get('content-type') || '';
          if (packagesRes.status === 404 || packagesCt.toLowerCase().includes('text/html')) {
            setError('Health API works but Packages API is not installed.\n\nAdd the packages route so the dashboard can load Composer data. Check: 1. php-integration install, 2. Route for /api/webmonitor/packages, 3. Restart server.');
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('PHP connection error:', err);
          const frameworkName = platform === 'laravel' ? 'Laravel' : 
                               platform === 'codeigniter' ? 'CodeIgniter' : 'PHP';
          let errorMsg = `Unable to connect to ${frameworkName} site. Connection failed.\n\nPlease check:\n1. PHP server is running\n2. API route is installed correctly\n3. Restart PHP server after installation\n4. Check URL is correct (no trailing slash)`;
          setError(errorMsg);
          setLoading(false);
          return;
        }
      }

      // Add the website (use current formData; URL may have been updated from API)
      const newWebsite = await ApiService.createWebsite(formData);
      
      // Call the callback to refresh the list
      if (onAdd) {
        onAdd(newWebsite);
      }
      
      // Close modal
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        url: '',
        platform: 'wordpress',
        apiKey: ''
      });
      setDiscoveredInfo(null);
    } catch (err) {
      console.error('Error adding website:', err);
      let errorMessage = 'Failed to add website. Please try again.';
      
      if (err.message && err.message.includes('Failed to create website')) {
        errorMessage = 'Failed to connect to the backend. Please ensure the backend server is running on port 5000.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    // This would typically show instructions for WordPress
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 mobile-safe-bottom">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mobile-scroll animate-slide-up sm:animate-slide-up">
        {/* Elegant Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-white z-10 flex items-center justify-between px-5 sm:px-7 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Add Website</h2>
              <p className="text-xs text-gray-500 mt-0.5">Auto-detect platform & URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all rounded-lg no-select"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-7">

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-4 bg-red-50/80 border-l-4 border-red-400 rounded-r-lg">
              <p className="text-red-700 text-sm whitespace-pre-wrap leading-relaxed">{error}</p>
            </div>
          )}

          {/* Discovered Info */}
          {discoveredInfo && (
            <div className="mb-5 p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-emerald-900 mb-1.5 text-sm">Auto-detected</h3>
                  <div className="space-y-1 text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">URL:</span>
                      <span className="font-mono truncate">{discoveredInfo.url}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Platform:</span>
                      <span className="capitalize">{discoveredInfo.platform}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Website Name */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Website Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="admin@zealot.com"
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base transition-all placeholder:text-gray-400"
                required
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Key size={14} />
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleChange}
                  placeholder="Enter your API key"
                  className="w-full px-4 py-3.5 pr-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono transition-all placeholder:text-gray-400 placeholder:font-sans"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded hover:bg-gray-100"
                  aria-label="Toggle visibility"
                >
                  <Eye size={18} className={showApiKey ? 'text-indigo-600' : ''} />
                </button>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mt-2">
                Platform and URL will be auto-detected. Find your API key in WordPress Settings → Web Monitor API, or in .env files for Laravel/Next.js.
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-3.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors no-select"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-5 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg active:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed no-select"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </span>
                ) : (
                  'Add Website'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddWebsiteModal;

