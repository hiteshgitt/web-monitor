import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { CustomTooltip, CustomLabel } from './CustomTooltip';
import RealTimeIndicator from './RealTimeIndicator';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { 
  TrendingUp, Shield, Zap, Search, AlertTriangle, CheckCircle, Globe, Activity, MessageSquare, 
  RefreshCw, Bell, Settings, Menu, X, ChevronRight, ArrowLeft, Home, Brain, Eye, 
  BarChart3, Gauge, Lock, Users, Mail, Share2, Download, Upload, Filter, Calendar,
  Target, Award, Star, Heart, ThumbsUp, ThumbsDown, Info, HelpCircle, Lightbulb,
  AlertCircle, CheckSquare, Clock, DollarSign, ShoppingCart, CreditCard, PieChart as PieChartIcon,
  ChevronDown, ChevronUp, FileCode, Image, Server, HardDrive, Wifi, GripVertical, LogOut
} from 'lucide-react';
import { getApiUrl, API_BASE_URL } from '../config/api';
import { apiFetch } from '../services/session';
import useMonitoringHistory from '../hooks/useMonitoringHistory';

// Pro-only Advanced view, shown inside the site detail as its own tab
const AdvancedDashboard = ({ selectedWebsite }) => {
  // Drag and drop state for overview cards
  const getCardConfig = () => [
    { id: 'uptime', label: 'Uptime', icon: CheckCircle, colorClass: 'text-green-600', unit: '%', subtitle: 'Last 30 days' },
    { id: 'response', label: 'Response', icon: Activity, colorClass: 'text-brand-600', unit: 'ms', subtitle: 'Average' },
    { id: 'visitors', label: 'Visitors', icon: Users, colorClass: 'text-purple-600', unit: '', subtitle: 'This month' },
    { id: 'security', label: 'Security', icon: Shield, colorClass: 'text-red-600', unit: '', subtitle: 'Out of 100' },
  ];
  
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem(`dashboard-order-${selectedWebsite?._id}`);
    return saved ? JSON.parse(saved) : ['uptime', 'response', 'visitors', 'security'];
  });

  const getCardValue = (cardId) => {
    switch(cardId) {
      case 'uptime': return selectedWebsite?.uptime ?? 'N/A';
      case 'response': return selectedWebsite?.responseTime ?? 'N/A';
      case 'visitors': return selectedWebsite?.analytics?.totalVisitors != null ? (selectedWebsite.analytics.totalVisitors / 1000).toFixed(1) + 'K' : 'N/A';
      case 'security': return selectedWebsite?.security?.securityScore ?? 'N/A';
      default: return 'N/A';
    }
  };

  const metricCards = cardOrder.map(id => {
    const config = getCardConfig().find(c => c.id === id);
    return { ...config, id, value: getCardValue(id) };
  });

  const handleReorder = (newCards) => {
    const newOrder = newCards.map(c => c.id);
    setCardOrder(newOrder);
    localStorage.setItem(`dashboard-order-${selectedWebsite?._id}`, JSON.stringify(newOrder));
  };

  const { draggedItem, dragOverIndex, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } = useDragAndDrop(metricCards, handleReorder);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAI, setShowAI] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { type: 'ai', text: `Hello! I'm Zealot, your AI assistant for ${selectedWebsite.name}. Ask me anything about this site's analytics, performance, SEO, or security. You can also paste an error message or fix suggestion and I'll explain how it relates to your data.` }
  ]);
  const [loading, setLoading] = useState(false);
  const [advancedData, setAdvancedData] = useState(null);
  const [dateRange, setDateRange] = useState('7daysAgo');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [pluginView, setPluginView] = useState('All'); // For plugin tab switching
  const [pluginsError, setPluginsError] = useState(null);
  const [expandedActions, setExpandedActions] = useState({});
  const [alertsPriorityFilter, setAlertsPriorityFilter] = useState('all'); // 'all' | 'high' | 'medium' | 'low'
  const [reportDays, setReportDays] = useState(30);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [reportMode, setReportMode] = useState('preset'); // 'preset' | 'custom'

  // Build active alerts list for Alerts tab (with priority for filtering)
  const activeAlertsList = React.useMemo(() => {
    const list = [];
    if (!selectedWebsite?.seo?.sslEnabled) {
      list.push({
        priorityKey: 'high',
        type: 'ssl',
        title: 'SSL Certificate Disabled',
        priority: 'High Priority',
        description: 'SSL certificate is disabled - Enable SSL for better security and SEO',
        details: {
          currentStatus: 'Disabled',
          impact: 'Security and SEO',
          recommendation: 'Enable SSL certificate through your hosting provider or CDN',
          steps: [
            'Contact your hosting provider to enable SSL',
            'Configure SSL certificate in your hosting control panel',
            'Update your site URL to use HTTPS',
            'Test SSL configuration and redirect HTTP to HTTPS'
          ]
        },
        cardLabel: 'High Priority',
        cardDesc: 'SSL certificate is disabled - Enable SSL for better security and SEO',
        cardHint: 'Click to view details and fix steps',
        bgClass: 'bg-red-50 hover:bg-red-100',
        titleClass: 'text-red-800',
        descClass: 'text-red-700',
        hintClass: 'text-red-600'
      });
    }
    if (selectedWebsite?.security?.securityScore != null && selectedWebsite.security.securityScore < 70) {
      list.push({
        priorityKey: 'medium',
        type: 'security',
        title: 'Security Score Low',
        priority: 'Medium Priority',
        description: `Security score is ${selectedWebsite.security.securityScore}/100 - Below recommended threshold`,
        details: {
          currentScore: selectedWebsite.security.securityScore,
          recommendedScore: '70+',
          impact: 'Security vulnerabilities',
          recommendation: 'Improve security measures to increase score',
          steps: [
            'Enable SSL certificate',
            'Update outdated plugins',
            'Install security plugins',
            'Regular security scans',
            'Keep WordPress core updated'
          ]
        },
        cardLabel: 'Medium Priority',
        cardDesc: `Security score is ${selectedWebsite.security.securityScore}/100 - Below recommended threshold`,
        cardHint: 'Click to view details and improvement steps',
        bgClass: 'bg-yellow-50 hover:bg-yellow-100',
        titleClass: 'text-yellow-800',
        descClass: 'text-yellow-700',
        hintClass: 'text-yellow-600'
      });
    }
    if (selectedWebsite?.security?.outdatedPlugins && selectedWebsite.security.outdatedPlugins > 0) {
      list.push({
        priorityKey: 'medium',
        type: 'plugins',
        title: 'Outdated Plugins Detected',
        priority: 'Medium Priority',
        description: `${selectedWebsite.security.outdatedPlugins} outdated plugin(s) detected - Update recommended`,
        details: {
          outdatedCount: selectedWebsite.security.outdatedPlugins,
          totalPlugins: selectedWebsite.security.totalPlugins,
          impact: 'Security vulnerabilities and compatibility issues',
          recommendation: 'Update outdated plugins to latest versions',
          steps: [
            'Go to WordPress Admin Dashboard',
            'Navigate to Plugins > Installed Plugins',
            'Check for plugins with update notifications',
            'Update plugins one by one',
            'Test site functionality after each update',
            'Keep plugins updated regularly'
          ]
        },
        cardLabel: 'Medium Priority',
        cardDesc: `${selectedWebsite.security.outdatedPlugins} outdated plugin(s) detected - Update recommended`,
        cardHint: 'Click to view details and update steps',
        bgClass: 'bg-yellow-50 hover:bg-yellow-100',
        titleClass: 'text-yellow-800',
        descClass: 'text-yellow-700',
        hintClass: 'text-yellow-600'
      });
    }
    if (selectedWebsite?.seo?.metaTags === 'incomplete') {
      list.push({
        priorityKey: 'low',
        type: 'meta',
        title: 'Meta Tags Incomplete',
        priority: 'Low Priority',
        description: 'Meta tags are incomplete - Complete meta tags for better SEO',
        details: {
          currentStatus: 'Incomplete',
          impact: 'SEO performance and search visibility',
          recommendation: 'Complete meta tags for all pages and posts',
          steps: [
            'Add meta title and description to all pages',
            'Use relevant keywords in meta descriptions',
            'Keep meta descriptions under 160 characters',
            'Ensure each page has unique meta tags',
            'Use SEO plugins like Yoast or RankMath',
            'Test meta tags with SEO tools'
          ]
        },
        cardLabel: 'Low Priority',
        cardDesc: 'Meta tags are incomplete - Complete meta tags for better SEO',
        cardHint: 'Click to view details and improvement steps',
        bgClass: 'bg-brand-50 hover:bg-brand-100',
        titleClass: 'text-brand-800',
        descClass: 'text-brand-700',
        hintClass: 'text-brand-600'
      });
    }
    if (selectedWebsite?.seo?.seoIssues?.length) {
      list.push({
        priorityKey: 'medium',
        type: 'seo',
        title: 'SEO Issues Found',
        priority: 'Medium Priority',
        description: `${selectedWebsite.seo.seoIssues.length} SEO issue(s) found - Review and fix`,
        details: {
          issuesCount: selectedWebsite.seo.seoIssues.length,
          issues: selectedWebsite.seo.seoIssues,
          impact: 'SEO performance and search rankings',
          recommendation: 'Fix SEO issues to improve search visibility',
          steps: [
            'Review each SEO issue listed below',
            'Add missing excerpts to posts',
            'Complete meta descriptions',
            'Optimize content for target keywords',
            'Fix broken links and images',
            'Regular SEO audits and monitoring'
          ]
        },
        cardLabel: 'Medium Priority',
        cardDesc: `${selectedWebsite.seo.seoIssues.length} SEO issue(s) found - Review and fix`,
        cardHint: 'Click to view detailed issues and fix steps',
        bgClass: 'bg-orange-50 hover:bg-orange-100',
        titleClass: 'text-orange-800',
        descClass: 'text-orange-700',
        hintClass: 'text-orange-600'
      });
    }
    return list;
  }, [selectedWebsite]);

  const filteredAlerts = alertsPriorityFilter === 'all'
    ? activeAlertsList
    : activeAlertsList.filter(a => a.priorityKey === alertsPriorityFilter);

  // Advanced tabs with all features
  const getPluginsTabName = () => {
    if (selectedWebsite.platform === 'nextjs') return 'libraries';
    if (['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform)) return 'packages';
    return 'plugins';
  };
  
  const advancedTabs = [
    'overview', 'analytics', 'performance', 'seo', 'security', 
    'reports', 'alerts', 'logs', getPluginsTabName()
  ];
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  useEffect(() => {
    loadAdvancedData();
    // Load saved card order from localStorage when website changes
    const saved = localStorage.getItem(`dashboard-order-${selectedWebsite?._id}`);
    if (saved) {
      try {
        setCardOrder(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved card order:', e);
      }
    } else {
      setCardOrder(['uptime', 'response', 'visitors', 'security']);
    }
  }, [selectedWebsite?._id, dateRange]);

  const { latencySeries } = useMonitoringHistory(selectedWebsite?._id, 24);

  useEffect(() => {
    if (!selectedWebsite?._id) return;
    setIncidentsLoading(true);
    const url = getApiUrl(`advanced/incidents/${selectedWebsite._id}?days=30`);
    apiFetch(url)
      .then(r => r.json())
      .then(data => setIncidents(Array.isArray(data) ? data : []))
      .catch(() => setIncidents([]))
      .finally(() => setIncidentsLoading(false));
  }, [selectedWebsite?._id]);

  // Listen for switch-to-alerts event (from notification clicks)
  useEffect(() => {
    const handleSwitchToAlerts = (event) => {
      setActiveTab('alerts');
      // Optionally scroll to specific alert type if provided
      if (event.detail?.alertType) {
        setTimeout(() => {
          const alertElement = document.querySelector(`[data-alert-type="${event.detail.alertType}"]`);
          if (alertElement) {
            alertElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the alert briefly
            alertElement.classList.add('ring-2', 'ring-brand-500');
            setTimeout(() => {
              alertElement.classList.remove('ring-2', 'ring-brand-500');
            }, 2000);
          }
        }, 300);
      }
    };

    window.addEventListener('switch-to-alerts', handleSwitchToAlerts);
    return () => {
      window.removeEventListener('switch-to-alerts', handleSwitchToAlerts);
    };
  }, []);

  // Lazy-load plugins/libraries/packages data when user opens the tab (or if missing)
  useEffect(() => {
    const loadPluginsOrLibrariesOrPackagesIfNeeded = async () => {
      if (activeTab !== 'plugins' && activeTab !== 'libraries' && activeTab !== 'packages') return;
      
      // Check if we already have the data (and it's not an error)
      let hasData = false;
      if (selectedWebsite.platform === 'nextjs') {
        hasData = (advancedData?.libraries || advancedData?.nextjs?.libraries) && !advancedData?.libraries?.error;
      } else if (['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform)) {
        hasData = (advancedData?.packages || advancedData?.php?.packages) && !advancedData?.packages?.error;
      } else {
        hasData = advancedData?.plugins && !advancedData?.plugins?.error;
      }
      
      // Don't retry if we already have an error (to prevent infinite loops)
      if (hasData || pluginsError) return;
      
      // Prevent loading if already loading
      if (loading) return;
      try {
        setLoading(true);
        setPluginsError(null);
        const apiUrl = API_BASE_URL;
        const res = await apiFetch(`${apiUrl}/advanced/plugins/${selectedWebsite._id}`);
        
        // Check content type
        const contentType = res.headers.get('content-type');
        console.log('📦 Response status:', res.status);
        console.log('📦 Content-Type:', contentType);
        
        // Read response body once (can only be read once)
        const text = await res.text();
        console.log('📦 Response text (first 500 chars):', text.substring(0, 500));
        
        if (!res.ok) {
          // Try to parse as JSON, but handle non-JSON responses
          let errorData;
          try {
            errorData = JSON.parse(text);
          } catch (e) {
            // Not JSON - probably HTML error page
            console.error('❌ Error response is not JSON:', text.substring(0, 200));
            errorData = { 
              error: `HTTP ${res.status}: ${res.statusText}`,
              message: 'Server returned non-JSON response (likely HTML error page)'
            };
          }
          throw new Error(errorData.error || errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }
        
        // Parse response - handle both JSON and non-JSON
        let data;
        try {
          if (contentType && contentType.includes('application/json')) {
            data = JSON.parse(text);
          } else {
            // Not JSON - might be HTML error page
            console.error('❌ Response is not JSON. Content-Type:', contentType);
            console.error('❌ Response text:', text.substring(0, 500));
            throw new Error(`Server returned non-JSON response. Expected JSON but got ${contentType || 'unknown type'}. This usually means the endpoint URL is wrong or the server returned an HTML error page.`);
          }
        } catch (parseError) {
          if (parseError.message.includes('non-JSON')) {
            throw parseError;
          }
          console.error('❌ JSON parse error:', parseError);
          throw new Error(`Failed to parse response as JSON: ${parseError.message}`);
        }
        
        console.log('📦 Received response data:', data);
        console.log('📦 Data type:', typeof data);
        console.log('📦 Data keys:', data ? Object.keys(data) : 'null/undefined');
        
        // Validate data structure before storing
        if (!data || typeof data !== 'object') {
          console.error('❌ Invalid data structure - not an object:', data);
          throw new Error('Invalid data received from server - expected object');
        }
        
        // Store data based on platform
        if (selectedWebsite.platform === 'nextjs') {
          setAdvancedData(prev => ({ ...(prev || {}), libraries: data }));
        } else if (['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform)) {
          // Check if it's an error response FIRST (before validating structure)
          // Backend error responses have: {error, url, platform, status, message, ...}
          if (data.error && !data.total_packages && !data.all_packages) {
            console.error('❌ Error in packages response:', data);
            const errorMsg = data.error + 
              (data.message ? ': ' + data.message : '') + 
              (data.url ? ` (URL: ${data.url})` : '') +
              (data.status ? ` [Status: ${data.status}]` : '');
            throw new Error(errorMsg);
          }
          
          // Check if it has the expected packages structure
          // Laravel returns: {total_packages, dependencies_count, devDependencies_count, dependencies, devDependencies, all_packages, ...}
          const hasValidStructure = data.total_packages !== undefined || 
                                   (data.all_packages && Array.isArray(data.all_packages)) || 
                                   (data.dependencies && Array.isArray(data.dependencies)) ||
                                   (data.dependencies_count !== undefined) ||
                                   (data.devDependencies && Array.isArray(data.devDependencies));
          
          if (!hasValidStructure) {
            console.error('❌ Invalid packages structure.');
            console.error('❌ Received keys:', Object.keys(data || {}));
            console.error('❌ Full data:', JSON.stringify(data, null, 2));
            
            // If it's an empty object or has unexpected structure, show helpful error
            const receivedKeys = Object.keys(data || {});
            throw new Error(`Invalid packages data structure. Expected: total_packages, all_packages, or dependencies. Received: ${receivedKeys.length > 0 ? receivedKeys.join(', ') : 'empty object'}. Check browser console for full details.`);
          }
          
          console.log('✅ Valid packages data structure, storing...');
          console.log('✅ Total packages:', data.total_packages);
          console.log('✅ Dependencies count:', data.dependencies_count);
          setAdvancedData(prev => ({ ...(prev || {}), packages: data }));
        } else {
          setAdvancedData(prev => ({ ...(prev || {}), plugins: data }));
        }
      } catch (err) {
        console.error('Error loading plugins/libraries/packages:', err);
        let errorMsg = 'Failed to load data.';
        let errorDetails = '';
        
        if (err.message) {
          errorDetails = err.message;
        }
        
        if (selectedWebsite.platform === 'nextjs') {
          errorMsg = 'Failed to load libraries. Ensure the API key is valid and Next.js server is running.';
        } else if (['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform)) {
          errorMsg = 'Failed to load packages. Ensure the API key is valid and PHP server is running.';
          if (errorDetails.includes('404')) {
            errorMsg = 'Packages endpoint not found (404). Check: 1. URL is correct (use actual IP/domain, not localhost), 2. Laravel routes configured, 3. Server is running';
          } else if (errorDetails.includes('401')) {
            errorMsg = 'API key authentication failed. Verify API key in .env matches dashboard.';
          } else if (errorDetails.includes('503')) {
            errorMsg = 'Unable to reach PHP server. Check if server is running and URL is correct.';
          }
        } else {
          errorMsg = 'Failed to load plugins. Ensure the API key is valid in WordPress Settings → Web Monitor API.';
        }
        setPluginsError(errorMsg + (errorDetails ? ` (${errorDetails})` : ''));
      } finally {
        setLoading(false);
      }
    };
    loadPluginsOrLibrariesOrPackagesIfNeeded();
  }, [activeTab, advancedData, selectedWebsite]);

  const loadAdvancedData = async () => {
    setLoading(true);
    try {
      const apiUrl = API_BASE_URL;
      const response = await apiFetch(`${apiUrl}/advanced/comprehensive/${selectedWebsite._id}`);
      const data = await response.json();
      setAdvancedData(data);
    } catch (error) {
      console.error('Error loading advanced data:', error);
      setAdvancedData(null);
    } finally {
      setLoading(false);
    }
  };


  // Shared: send a query to Zealot and update chat (used by form submit and "Ask Zealot" from Fix Actions)
  const submitQueryToZealot = async (q) => {
    const trimmed = (q && String(q).trim()) || '';
    if (!trimmed) return;

    setAiMessages(prev => [...prev, { type: 'user', text: trimmed }]);
    setAiLoading(true);

    try {
      const apiUrl = getApiUrl(`advanced/ai-insights/${selectedWebsite._id}/query`);
      const res = await apiFetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
        ...(import.meta.env.DEV ? {} : { mode: 'cors', credentials: 'include' })
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error || data?.message || data?.details?.message || `Request failed (${res.status})`;
        let errorText = `Zealot is unavailable: ${errMsg}`;
        if (res.status === 404) {
          errorText += '\n\nPossible issues:\n- API endpoint not found\n- Invalid website ID\n- Backend route not registered';
        } else if (res.status === 503) {
          errorText += '\n\nCheck that GOOGLE_AI_API_KEY is set in backend/config.env and the backend was restarted.';
        } else if (res.status === 401 || res.status === 403) {
          errorText += '\n\nAPI key may be invalid or expired. Verify your Google Gemini API key.';
        }
        setAiMessages(prev => [...prev, { type: 'ai', text: errorText }]);
        return;
      }

      const answer = (data && (data.answer ?? data.response)) || (typeof data === 'string' ? data : 'No answer returned.');
      setAiMessages(prev => [...prev, { type: 'ai', text: answer }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { type: 'ai', text: `Zealot request failed: ${err.message}. Ensure the backend is running and an AI API key is configured (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY).` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAISubmit = async (e) => {
    e.preventDefault();
    const q = aiQuery.trim();
    if (!q) return;
    setAiQuery('');
    await submitQueryToZealot(q);
  };

  // Open Zealot and send a pre-built question (e.g. from Fix Actions "Ask Zealot")
  const askZealotAboutFix = (queryText) => {
    setShowAI(true);
    submitQueryToZealot(queryText);
  };

  // Premium Fix Actions - Only in Advanced View
  // These are general how-to guides; no file-level scan exists yet, so no file lists are shown
  const actionItems = [
    {
      id: 'fix-images',
      icon: Image,
      label: 'Fix Images',
      category: 'performance',
      description: 'Optimize large images to improve page load speed',
      files: [],
      instructions: [
        'Use image compression tools (TinyPNG, ImageOptim, or Squoosh)',
        'Convert images to WebP format for better compression',
        'Resize images to actual display dimensions',
        'Use lazy loading for images below the fold',
        'Consider using a CDN for image delivery'
      ]
    },
    {
      id: 'enable-caching',
      icon: Zap,
      label: 'Enable Caching',
      category: 'performance',
      description: 'Configure browser and server caching to speed up page loads',
      files: [],
      instructions: [
        'Add .htaccess rules for browser caching (if Apache)',
        'Configure Nginx cache headers (if Nginx)',
        'Install a caching plugin (WP Super Cache, W3 Total Cache)',
        'Enable object caching (Redis or Memcached)',
        'Set cache expiration headers (1 year for static assets)'
      ],
      configExample: `# .htaccess example
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>`
    },
    {
      id: 'minify-js',
      icon: FileCode,
      label: 'Minify JS',
      category: 'performance',
      description: 'Minify JavaScript files to reduce file size and improve load time',
      files: [],
      instructions: [
        'Use a minification plugin (Autoptimize, WP Rocket)',
        'Or manually minify using tools like UglifyJS or Terser',
        'Combine multiple JS files into one',
        'Remove unused JavaScript code',
        'Defer or async load non-critical scripts'
      ]
    },
    {
      id: 'enable-ssl',
      icon: Lock,
      label: 'Enable SSL',
      category: 'security',
      description: 'Enable SSL certificate for secure HTTPS connection',
      visible: selectedWebsite.security?.sslStatus === 'disabled',
      files: [],
      instructions: [
        'Contact your hosting provider to install SSL certificate',
        'Or use free SSL from Let\'s Encrypt',
        'Update WordPress site URL to HTTPS in Settings → General',
        'Install Really Simple SSL plugin for automatic HTTPS redirect',
        'Update all internal links to use HTTPS',
        'Force HTTPS redirect in .htaccess or server config'
      ],
      configExample: `# Force HTTPS redirect (.htaccess)
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>`
    }
  ].filter(item => item.visible !== false);

  // Toggle action expansion
  const toggleAction = (id) => {
    setExpandedActions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleExportReport = async (format = 'csv', days = 30) => {
    if (!selectedWebsite?._id) return;
    try {
      const url = getApiUrl(`advanced/export/${selectedWebsite._id}?format=${format}&days=${days}`);
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const name = `${(selectedWebsite.name || 'report').replace(/[^a-z0-9_-]/gi, '_')}-${days}days.${format}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-100 border-t-brand-600 mx-auto mb-4"></div>
          <p className="text-ink-soft font-semibold text-base">Loading advanced analytics...</p>
          <p className="text-ink-muted text-sm mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pb-6 overflow-x-hidden relative">
      {/* Main Content */}
      <div className="pb-2">
        {/* 📑 Premium Sticky Tab Navigation */}
        <div className="mb-6 bg-canvas rounded-2xl overflow-hidden">
          <div className="py-2 px-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 flex-nowrap min-w-max">
              {advancedTabs.map(tab => (
                <button
                  key={tab}
                  onClick={(e) => {
                    setActiveTab(tab);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-all duration-200 flex items-center gap-2 shrink-0 ${
                    activeTab === tab
                      ? 'bg-white text-brand-700 shadow-card'
                      : 'text-ink-muted hover:text-ink hover:bg-white/60'
                  }`}
                >
                  {tab === 'overview' && <Home size={14} />}
                  {tab === 'analytics' && <BarChart3 size={14} />}
                  {tab === 'performance' && <Zap size={14} />}
                  {tab === 'seo' && <Search size={14} />}
                  {tab === 'security' && <Shield size={14} />}
                  {tab === 'reports' && <Download size={14} />}
                  {tab === 'alerts' && <Bell size={14} />}
                  {tab === 'logs' && <FileCode size={14} />}
                  {(tab === 'plugins' || tab === 'libraries' || tab === 'packages') && <Settings size={14} />}
                  <span>{tab === 'libraries' ? 'Libraries' : tab === 'packages' ? 'Packages' : tab}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Secondary Metrics Grid - Draggable Cards */}
            <div className="grid grid-cols-2 gap-4">
              {metricCards.map((card, index) => {
                const Icon = card.icon;
                const isDragging = draggedItem === index;
                const isDragOver = dragOverIndex === index;
                
                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(index, e)}
                    onDragOver={(e) => handleDragOver(index, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(index, e)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all cursor-move relative group ${
                      isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'border-brand-600 bg-brand-50' : 'border-brand-100 hover:border-brand-100 hover:shadow-card-hover'}`}
                  >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical size={16} className="text-ink-faint" />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-2xl ${card.id === 'uptime' ? 'bg-emerald-50 text-emerald-600' : card.id === 'response' ? 'bg-brand-50 text-brand-600' : card.id === 'visitors' ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'}`}>
                        <Icon size={20} />
                      </div>
                      <span className="text-[10px] font-extrabold text-ink-muted uppercase tracking-widest">{card.label}</span>
                    </div>
                    <div className="text-3xl font-extrabold text-ink mb-1 tracking-tighter">
                      {card.value}{typeof card.value === 'number' ? card.unit : ''}
                    </div>
                    <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{card.subtitle}</div>
                  </div>
                );
              })}
            </div>

            {/* Server / Hosting Info */}
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Server size={20} />
                  </div>
                  Server Infrastructure
                </h3>
                {advancedData?.serverInfo?.lastChecked && (
                  <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider bg-brand-100 px-3 py-1.5 rounded-full">
                    Updated: {new Date(advancedData.serverInfo.lastChecked).toLocaleTimeString()}
                  </div>
                )}
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100">
                    <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-2">Downtime (24h)</div>
                    <div className="text-xl font-extrabold text-ink">
                      {advancedData?.serverInfo?.downtimeHours?.last24h != null
                        ? `${advancedData.serverInfo.downtimeHours.last24h}h`
                        : '0h'}
                    </div>
                  </div>
                  <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100">
                    <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-2">Downtime (7d)</div>
                    <div className="text-xl font-extrabold text-ink">
                      {advancedData?.serverInfo?.downtimeHours?.last7d != null
                        ? `${advancedData.serverInfo.downtimeHours.last7d}h`
                        : '0h'}
                    </div>
                  </div>
                  <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100">
                    <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-2">Downtime (30d)</div>
                    <div className="text-xl font-extrabold text-ink">
                      {advancedData?.serverInfo?.downtimeHours?.last30d != null
                        ? `${advancedData.serverInfo.downtimeHours.last30d}h`
                        : '0h'}
                    </div>
                  </div>
                  <div className="rounded-2xl p-5 border border-emerald-100 bg-emerald-50/30">
                    <div className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-widest mb-2">Avg Uptime</div>
                    <div className="text-xl font-extrabold text-emerald-700">
                      {advancedData?.serverInfo?.uptimePercent != null
                        ? `${advancedData.serverInfo.uptimePercent}%`
                        : selectedWebsite?.uptime != null ? `${selectedWebsite.uptime}%` : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center text-ink-muted">
                      <HardDrive size={22} />
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-0.5">Disk Resource</div>
                      <div className="text-sm font-extrabold text-ink">
                        {advancedData?.serverInfo?.diskSpace
                          ? `${advancedData.serverInfo.diskSpace.used ?? '—'} / ${advancedData.serverInfo.diskSpace.total ?? '—'} ${advancedData.serverInfo.diskSpace.unit || 'GB'}`
                          : 'Not connected'}
                      </div>
                    </div>
                  </div>
                  <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center text-ink-muted">
                      <Wifi size={22} />
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-0.5">Data Transfer</div>
                      <div className="text-sm font-extrabold text-ink">
                        {advancedData?.serverInfo?.bandwidth
                          ? `${advancedData.serverInfo.bandwidth.used ?? '—'} / ${advancedData.serverInfo.bandwidth.limit ?? '—'} ${advancedData.serverInfo.bandwidth.unit || 'GB'}`
                          : 'Not connected'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Breakdown - Modern List */}
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Gauge size={20} />
                  </div>
                  Performance Vitals
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: 'Response Time (round trip)', value: selectedWebsite?.responseTime, icon: Clock, color: 'bg-emerald-500' },
                  { label: 'Server Processing', value: selectedWebsite?.performance?.serverResponseTime, icon: Activity, color: 'bg-emerald-500' },
                  { label: 'DB Query Time', value: selectedWebsite?.performance?.databaseQueryTime, icon: Gauge, color: 'bg-amber-500' }
                ].map((vital, i) => (
                  <div key={i} className="px-8 py-6 flex items-center justify-between hover:bg-brand-50/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${vital.color} shadow-[0_0_8px_rgba(16,185,129,0.3)]`}></div>
                      <vital.icon size={20} className="text-ink-muted" />
                      <span className="text-sm text-ink font-bold tracking-tight">{vital.label}</span>
                    </div>
                    <span className="text-lg font-extrabold text-ink tracking-tighter">
                      {vital.value != null ? `${vital.value < 10 ? vital.value.toFixed(2) : Math.round(vital.value).toLocaleString()}ms` : '--'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Traffic Overview - Modern Card */}
            <div className="bg-white rounded-xl border border-brand-100 shadow-xs p-4">
              <h3 className="text-base font-semibold text-ink mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-600" />
                Traffic Overview
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-ink-muted mb-1">Total Sessions</div>
                  <div className="text-lg font-bold text-ink">{advancedData?.analytics?.googleAnalytics?.sessions != null ? (advancedData.analytics.googleAnalytics.sessions / 1000).toFixed(1) + 'K' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-muted mb-1">Unique Users</div>
                  <div className="text-lg font-bold text-ink">{selectedWebsite?.analytics?.totalVisitors != null ? (selectedWebsite.analytics.totalVisitors / 1000).toFixed(1) + 'K' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-muted mb-1">Page Views</div>
                  <div className="text-lg font-bold text-ink">{selectedWebsite?.analytics?.totalPageViews != null ? (selectedWebsite.analytics.totalPageViews / 1000).toFixed(1) + 'K' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-muted mb-1">Bounce Rate</div>
                  <div className="text-lg font-bold text-ink">{selectedWebsite?.analytics?.bounceRate != null ? `${selectedWebsite.analytics.bounceRate}%` : 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Site Health Summary - Modern Grid */}
            <div className="bg-white rounded-xl border border-brand-100 shadow-xs p-4">
              <h3 className="text-base font-semibold text-ink mb-4 flex items-center gap-2">
                <Activity size={18} className="text-green-600" />
                Site Health Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xs text-green-600 font-medium mb-1">SSL Status</div>
                  <div className="text-sm font-bold text-green-800">
                    {selectedWebsite?.seo?.sslEnabled ? '✅ Enabled' : '❌ Disabled'}
                  </div>
                </div>
                <div className="p-3 bg-brand-50 rounded-lg border border-brand-200">
                  <div className="text-xs text-brand-600 font-medium mb-1">Security Score</div>
                  <div className="text-sm font-bold text-brand-800">
                    {selectedWebsite?.security?.securityScore || 'N/A'}/100
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-xs text-yellow-600 font-medium mb-1">Outdated Plugins</div>
                  <div className="text-sm font-bold text-yellow-800">
                    {selectedWebsite?.security?.outdatedPlugins || 0} plugins
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-xs text-purple-600 font-medium mb-1">SEO Issues</div>
                  <div className="text-sm font-bold text-purple-800">
                    {selectedWebsite?.seo?.seoIssues?.length || 0} issues
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended actions (performance + SEO + security in one list) */}
            {((advancedData?.recommendations?.recommendations || []).length > 0) && (
              <div className="bg-white rounded-xl border border-brand-100 shadow-xs p-4">
                <h3 className="text-base font-semibold text-ink mb-3 flex items-center gap-2">
                  <Lightbulb size={18} className="text-amber-600" />
                  Recommended actions
                </h3>
                <ul className="space-y-2">
                  {(advancedData.recommendations.recommendations || []).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.source === 'performance' ? 'bg-brand-100 text-brand-800' :
                        r.source === 'seo' ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'
                      }`}>{r.source}</span>
                      <span className="text-ink-soft">{typeof r.text === 'string' ? r.text : r.text?.text || ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Downtime history (incidents from health checks) */}
            <div className="bg-white rounded-xl border border-brand-100 shadow-xs p-4">
              <h3 className="text-base font-semibold text-ink mb-3 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600" />
                Downtime history (last 30 days)
              </h3>
              {incidentsLoading ? (
                <p className="text-sm text-ink-muted">Loading...</p>
              ) : incidents.length === 0 ? (
                <p className="text-sm text-ink-muted">No incidents recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {incidents.slice(0, 10).map((inc, i) => (
                    <li key={i} className="flex items-center justify-between text-sm py-2 border-b border-brand-100 last:border-0">
                      <span className="text-ink-soft">
                        {new Date(inc.startedAt).toLocaleString()} — {inc.endedAt ? `Resolved ${new Date(inc.endedAt).toLocaleString()}` : 'Ongoing'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        inc.status === 'error' ? 'bg-red-100 text-red-800' : inc.status === 'offline' ? 'bg-gray-200 text-ink' : 'bg-amber-100 text-amber-800'
                      }`}>{inc.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 🎯 Premium Fix Actions - Advanced View Only */}
            <div className="bg-white rounded-xl border border-brand-100 shadow-xs p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  <Zap size={18} className="text-purple-600" />
                  Fix Actions
                </h3>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-sm">PREMIUM</span>
              </div>
              <div className="space-y-3">
                {actionItems.map((action) => {
                  const Icon = action.icon;
                  const isExpanded = expandedActions[action.id];
                  
                  return (
                    <div
                      key={action.id}
                      className="bg-brand-50 rounded-xl border-2 border-brand-100 overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => toggleAction(action.id)}
                        className="w-full p-4 flex items-center justify-between touch-target hover:bg-brand-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <div className="p-2 bg-brand-50 rounded-lg">
                            <Icon size={20} className="text-brand-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-ink mb-0.5">{action.label}</div>
                            <div className="text-xs text-ink-muted">{action.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {action.files && action.files.length > 0 && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded-sm">
                              {action.files.length} files
                            </span>
                          )}
                          {isExpanded ? <ChevronUp size={18} className="text-ink-muted" /> : <ChevronDown size={18} className="text-ink-muted" />}
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-brand-100 space-y-4 bg-white">
                          {/* File List */}
                          {action.files && action.files.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-ink-soft mb-2 flex items-center gap-2">
                                <FileCode size={14} />
                                Files to Fix ({action.files.length})
                              </h4>
                              <div className="bg-brand-50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                                {action.files.map((file, idx) => (
                                  <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-mono text-ink-soft truncate" title={file.path}>
                                        {file.path}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-red-600 font-medium">Current: {file.size}</span>
                                        <span className="text-ink-muted">→</span>
                                        <span className="text-green-600 font-medium">Target: {file.recommended}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Instructions */}
                          <div>
                            <h4 className="text-xs font-semibold text-ink-soft mb-2 flex items-center gap-2">
                              <CheckCircle size={14} />
                              Manual Fix Instructions
                            </h4>
                            <div className="bg-brand-50 rounded-lg p-3 space-y-2">
                              <div className="text-xs text-brand-800 font-medium mb-2">
                                ⚠️ These fixes need to be done manually on your server/files
                              </div>
                              <ol className="space-y-1.5">
                                {action.instructions.map((instruction, idx) => (
                                  <li key={idx} className="text-xs text-brand-700 flex items-start gap-2">
                                    <span className="font-semibold text-brand-800 shrink-0">{idx + 1}.</span>
                                    <span>{instruction}</span>
                                  </li>
                                ))}
                              </ol>
                              <button
                                type="button"
                                onClick={() => {
                                  const parts = [
                                    `Fix: ${action.label}. ${action.description}`,
                                    'Manual steps:',
                                    ...action.instructions.map((s, i) => `${i + 1}. ${s}`)
                                  ];
                                  if (action.files && action.files.length > 0) {
                                    parts.push('', 'Files to fix:', ...action.files.map(f => `${f.path} (${f.size} → ${f.recommended})`));
                                  }
                                  parts.push('', 'How should I apply this for my site?');
                                  askZealotAboutFix(parts.join('\n'));
                                }}
                                className="mt-3 w-full py-2 px-3 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-semibold flex items-center justify-center gap-2 touch-target transition-colors"
                              >
                                <Brain size={14} />
                                Ask Zealot
                              </button>
                            </div>
                          </div>
                          
                          {/* Config Example */}
                          {action.configExample && (
                            <div>
                              <h4 className="text-xs font-semibold text-ink-soft mb-2 flex items-center gap-2">
                                <FileCode size={14} />
                                Configuration Example
                              </h4>
                              <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                  {action.configExample}
                                </pre>
                              </div>
                              <div className="text-[10px] text-ink-muted mt-1">
                                Copy this code to your .htaccess file or server configuration
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* Analytics Overview - Modern Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-brand-100 shadow-xs p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={18} className="text-brand-600" />
                  <h3 className="text-sm font-semibold text-ink">Website Analytics</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-ink-muted">Visitors</span>
                    <span className="text-sm font-bold text-ink">{selectedWebsite?.analytics?.totalVisitors ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-ink-muted">Page Views</span>
                    <span className="text-sm font-bold text-ink">{selectedWebsite?.analytics?.totalPageViews ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-ink-muted">Bounce Rate</span>
                    <span className="text-sm font-bold text-ink">{selectedWebsite?.analytics?.bounceRate != null ? `${selectedWebsite.analytics.bounceRate}%` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-ink-muted">Avg Session</span>
                    <span className="text-sm font-bold text-ink">{selectedWebsite?.analytics?.avgSessionDuration != null ? `${selectedWebsite.analytics.avgSessionDuration}s` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                  <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Search size={20} />
                    </div>
                    Search Engine Visibility
                  </h3>
                </div>
              <div className="p-8 space-y-6">
                  {!advancedData?.analytics?.searchConsole ? (
                    <div className="bg-brand-50 border border-brand-100 rounded-2xl p-6 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                        <Search size={18} />
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-brand-700 mb-1">Google Search Console Not Connected</div>
                        <p className="text-xs text-brand-600/80 font-medium leading-relaxed">
                          Organic search data (clicks, impressions, CTR) requires Google Search Console API credentials.
                          Configure <code className="bg-brand-100 px-1 rounded-sm">GOOGLE_SEARCH_CONSOLE_ENABLED=true</code> and the related API keys in <code className="bg-brand-100 px-1 rounded-sm">backend/config.env</code>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100">
                      <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-2">Total Clicks</div>
                      <div className="text-xl font-extrabold text-ink">
                        {advancedData?.analytics?.searchConsole?.totalClicks != null
                          ? advancedData.analytics.searchConsole.totalClicks >= 1000
                            ? (advancedData.analytics.searchConsole.totalClicks / 1000).toFixed(1) + 'K'
                            : advancedData.analytics.searchConsole.totalClicks
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100">
                      <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-2">Impressions</div>
                      <div className="text-xl font-extrabold text-ink">
                        {advancedData?.analytics?.searchConsole?.totalImpressions != null
                          ? advancedData.analytics.searchConsole.totalImpressions >= 1000
                            ? (advancedData.analytics.searchConsole.totalImpressions / 1000).toFixed(1) + 'K'
                            : advancedData.analytics.searchConsole.totalImpressions
                          : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100">
                      <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-2">Avg. CTR</div>
                      <div className="text-xl font-extrabold text-brand-600">
                        {advancedData?.analytics?.searchConsole?.averageCTR != null
                          ? `${(advancedData.analytics.searchConsole.averageCTR * 100).toFixed(1)}%`
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100">
                      <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-2">Avg. Position</div>
                      <div className="text-xl font-extrabold text-brand-600">
                        {advancedData?.analytics?.searchConsole?.averagePosition != null
                          ? `#${advancedData.analytics.searchConsole.averagePosition.toFixed(1)}`
                          : '—'}
                      </div>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Traffic Sources Chart - Enhanced */}
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <PieChartIcon size={20} />
                  </div>
                  Traffic Sources
                </h3>
              </div>
              <div className="p-8">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(advancedData?.analytics?.googleAnalytics?.channelBreakdown || {}).map(([key, value]) => ({
                        name: key.charAt(0).toUpperCase() + key.slice(1),
                        value: value
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={CustomLabel}
                      outerRadius={90}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={800}
                    >
                      {Object.entries(advancedData?.analytics?.googleAnalytics?.channelBreakdown || {}).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={['#5868CF', '#6366f1', '#a5b4fc', '#e0e7ff', '#1e1b4b'][index % 5]}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Device Breakdown - Enhanced */}
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Activity size={20} />
                  </div>
                  Device Breakdown
                </h3>
              </div>
              <div className="p-8">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(advancedData?.analytics?.googleAnalytics?.deviceBreakdown || {}).map(([key, value]) => ({
                    name: key.charAt(0).toUpperCase() + key.slice(1),
                    sessions: value
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <Tooltip content={<CustomTooltip formatter={(value) => `${value.toLocaleString()} sessions`} />} />
                    <Bar 
                      dataKey="sessions" 
                      fill="#5868CF" 
                      radius={[12, 12, 0, 0]}
                      animationDuration={800}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-4">
            {/* Performance Metrics - Modern Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Response', value: selectedWebsite?.responseTime, icon: Clock, color: 'text-brand-600', bg: 'bg-brand-50', unit: 'ms' },
                { label: 'Server processing', value: selectedWebsite?.performance?.serverResponseTime, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', unit: 'ms' },
                { label: 'DB query', value: selectedWebsite?.performance?.databaseQueryTime, icon: Gauge, color: 'text-amber-600', bg: 'bg-amber-50', unit: 'ms' },
                { label: 'Memory', value: selectedWebsite?.performance?.memoryUsage, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50', unit: '%' }
              ].map((metric, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-card border border-brand-100 flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl ${metric.bg} flex items-center justify-center ${metric.color}`}>
                    <metric.icon size={20} />
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-extrabold text-ink-muted uppercase tracking-widest mb-1">{metric.label}</div>
                    <div className="text-xl font-extrabold text-ink tracking-tighter">
                      {metric.value != null ? (metric.value < 10 ? metric.value.toFixed(2) : Math.round(metric.value).toLocaleString()) : '--'}
                      {metric.value != null && <span className="text-xs ml-0.5">{metric.unit}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Response Time Chart - Enhanced Interactive */}
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Activity size={20} />
                  </div>
                  Latency History (24h)
                </h3>
              </div>
              <div className="p-8">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={latencySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <Tooltip content={<CustomTooltip formatter={(value) => `${value.toFixed(0)}ms`} />} />
                    <Line 
                      type="monotone" 
                      dataKey="response" 
                      stroke="#5868CF" 
                      strokeWidth={4}
                      dot={{ fill: '#5868CF', r: 5, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 8, fill: '#5868CF', strokeWidth: 4, stroke: 'rgba(88, 104, 207, 0.2)' }}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}


        {/* Security Tab */}
        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                    <Shield size={20} />
                  </div>
                  Security Architecture
                </h3>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(() => {
                    const vulnScan = selectedWebsite?.security?.vulnerabilityScan;
                    const hasVulnIssues = vulnScan && vulnScan !== 'Secure' && vulnScan !== 'secure' && vulnScan !== 'clean' && vulnScan !== 'Clean';
                    const vulnColor = hasVulnIssues ? 'text-rose-600' : 'text-emerald-600';
                    const vulnBg = hasVulnIssues ? 'bg-rose-50' : 'bg-emerald-50';
                    const vulnDisplay = !vulnScan ? 'N/A' : hasVulnIssues ? (vulnScan.replace(/_/g, ' ')) : 'Secure';
                    const malwareScan = selectedWebsite?.security?.malwareScan;
                    const malwareClean = malwareScan === 'clean' || malwareScan === 'Clean';
                    return [
                      { label: 'Malware Scan', value: malwareScan ? malwareScan.replace(/_/g, ' ') : 'N/A', icon: Shield, color: malwareClean ? 'text-emerald-600' : 'text-ink-muted', bg: malwareClean ? 'bg-emerald-50' : 'bg-brand-100' },
                      { label: 'Vulnerabilities', value: vulnDisplay, icon: AlertCircle, color: vulnColor, bg: vulnBg },
                      { label: 'SSL Protocol', value: selectedWebsite?.seo?.sslEnabled ? 'Encrypted' : 'Unsecured', icon: Lock, color: selectedWebsite?.seo?.sslEnabled ? 'text-emerald-600' : 'text-rose-600', bg: selectedWebsite?.seo?.sslEnabled ? 'bg-emerald-50' : 'bg-rose-50' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-brand-50 rounded-2xl p-6 border border-brand-100 flex flex-col items-center text-center gap-3 transition-all hover:bg-white hover:shadow-lg">
                        <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} shadow-xs`}>
                          <stat.icon size={24} />
                        </div>
                        <div>
                          <div className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-1">{stat.label}</div>
                          <div className={`text-lg font-extrabold tracking-tight ${stat.color}`}>{stat.value}</div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Vulnerability detail list - shown when issues found */}
                {(() => {
                  const vulnScan = selectedWebsite?.security?.vulnerabilityScan;
                  const hasVulnIssues = vulnScan && vulnScan !== 'Secure' && vulnScan !== 'secure' && vulnScan !== 'clean' && vulnScan !== 'Clean';
                  const vulnItems = selectedWebsite?.security?.vulnerabilities || [];
                  if (!hasVulnIssues) return null;
                  const defaultIssues = [
                    { title: 'Outdated core software version detected', severity: 'High' },
                    { title: 'Weak admin credentials policy', severity: 'Medium' },
                    { title: 'Exposed wp-config paths (if WordPress)', severity: 'High' },
                    { title: 'Missing HTTP security headers', severity: 'Medium' }
                  ];
                  const issues = vulnItems.length > 0 ? vulnItems : defaultIssues;
                  return (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-rose-100 flex items-center gap-3">
                        <AlertCircle size={16} className="text-rose-600" />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-700">Vulnerability Details ({issues.length} found)</span>
                      </div>
                      <div className="divide-y divide-rose-100">
                        {issues.map((issue, i) => {
                          const title = typeof issue === 'string' ? issue : issue.title;
                          const severity = typeof issue === 'object' ? issue.severity : null;
                          return (
                            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-rose-100/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                <span className="text-sm font-bold text-rose-900">{title}</span>
                              </div>
                              {severity && (
                                <span className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${
                                  severity === 'High' || severity === 'Critical' ? 'bg-rose-200 text-rose-800' : 'bg-amber-100 text-amber-700'
                                }`}>{severity}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-6 py-4 bg-rose-100/50">
                        <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">⚠️ Immediate attention required. Review your security settings and update all software.</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="bg-brand-600 rounded-2xl p-8 shadow-card relative overflow-hidden group">
              <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                <div>
                  <h3 className="text-white text-xl font-extrabold mb-2 tracking-tight">Security Integrity Rank</h3>
                  <p className="text-white/60 text-[10px] font-extrabold uppercase tracking-[0.2em]">Live automated protection status</p>
                </div>
                <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-4xl font-extrabold shadow-lg ring-4 ring-white/5">
                  {selectedWebsite?.security?.securityScore ?? '--'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEO Tab */}
        {activeTab === 'seo' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Search size={20} />
                  </div>
                  Search Engine Analysis
                </h3>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'SEO Score', value: selectedWebsite?.seo?.score ?? 'N/A', icon: Award, color: 'text-brand-600' },
                    { label: 'Meta Tags', value: selectedWebsite?.seo?.metaTags || 'N/A', icon: FileCode, color: 'text-brand-600' },
                    { label: 'Internal Links', value: selectedWebsite?.seo?.internalLinks ?? 'N/A', icon: Target, color: 'text-emerald-600' },
                    { label: 'Headings', value: (selectedWebsite?.seo?.headingStructure || 'N/A').replace(/_/g, ' '), icon: Menu, color: 'text-purple-600' }
                  ].map((seo, i) => (
                    <div key={i} className="bg-brand-50/50 rounded-3xl p-5 border border-brand-100 flex flex-col items-center gap-3">
                      <div className={`p-2 rounded-xl bg-white shadow-xs ${seo.color}`}>
                        <seo.icon size={20} />
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-ink-muted font-extrabold uppercase tracking-widest mb-1">{seo.label}</div>
                        <div className="text-lg font-extrabold text-ink tracking-tighter">{seo.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Additional SEO Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-8 pt-0">
                <div className="bg-brand-50/50 rounded-2xl p-6 border border-brand-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-1">SSL Certificate</h4>
                    <div className="flex items-center gap-2">
                       <Shield size={14} className={selectedWebsite?.seo?.sslEnabled ? 'text-emerald-500' : 'text-rose-500'} />
                       <span className="text-sm font-extrabold">{selectedWebsite?.seo?.sslEnabled ? 'Valid' : 'Invalid'}</span>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${selectedWebsite?.seo?.sslEnabled ? 'bg-emerald-500' : 'bg-rose-500'} shadow-[0_0_8px_rgba(16,185,129,0.3)]`}></div>
                </div>
                <div className="bg-brand-50/50 rounded-2xl p-6 border border-brand-100">
                  <h4 className="text-[10px] text-ink-muted font-extrabold uppercase tracking-widest mb-1">Meta Configuration</h4>
                  <span className="text-sm font-extrabold">{selectedWebsite?.seo?.metaTags || 'Default'}</span>
                </div>
              </div>
            </div>

            {/* SEO Issues List */}
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 bg-rose-50/30">
                <h3 className="text-xs font-extrabold text-rose-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <AlertCircle size={16} />
                  Critical SEO Improvements
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {(selectedWebsite?.seo?.seoIssues || [
                  'Meta descriptions missing on 4 pages',
                  'Image alt tags missing for 12 assets',
                  'H1 tag structure needs improvement',
                  'Title length exceeds 60 characters on 2 posts'
                ]).map((issue, i) => (
                  <div key={i} className="px-8 py-5 flex items-center justify-between hover:bg-brand-50 group transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-400 group-hover:scale-150 transition-transform"></div>
                      <span className="text-sm font-bold text-ink-soft tracking-tight">{issue}</span>
                    </div>
                    <ChevronRight size={14} className="text-ink-faint group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (() => {
          const presets = [
            { label: '1 Day', days: 1 },
            { label: '3 Days', days: 3 },
            { label: '7 Days', days: 7 },
            { label: '14 Days', days: 14 },
            { label: '30 Days', days: 30 },
            { label: '90 Days', days: 90 },
          ];
          const handleExport = (format) => {
            if (reportMode === 'custom' && customFromDate && customToDate) {
              const from = new Date(customFromDate);
              const to = new Date(customToDate);
              const diffDays = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)));
              handleExportReport(format, diffDays);
            } else {
              handleExportReport(format, reportDays);
            }
          };
          return (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-brand-500 to-brand-600 text-white">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest flex items-center gap-3">
                    <Download size={20} />
                    Data Export Center
                  </h3>
                </div>
                <div className="p-8 space-y-8">

                  {/* Date Range Selector */}
                  <div className="bg-brand-50/50 rounded-2xl p-6 border border-brand-100">
                    <h4 className="text-brand-900 font-extrabold text-base mb-4 flex items-center gap-2">
                      <Calendar size={18} className="text-brand-600" />
                      Select Date Range
                    </h4>
                    <div className="flex gap-3 mb-5">
                      <button
                        onClick={() => setReportMode('preset')}
                        className={`px-5 py-2 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                          reportMode === 'preset' ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'bg-white border border-brand-100 text-ink-muted hover:border-brand-300'
                        }`}
                      >
                        Quick Select
                      </button>
                      <button
                        onClick={() => setReportMode('custom')}
                        className={`px-5 py-2 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                          reportMode === 'custom' ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'bg-white border border-brand-100 text-ink-muted hover:border-brand-300'
                        }`}
                      >
                        Custom Range
                      </button>
                    </div>

                    {reportMode === 'preset' ? (
                      <div className="flex flex-wrap gap-3">
                        {presets.map(({ label, days }) => (
                          <button
                            key={days}
                            onClick={() => setReportDays(days)}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                              reportDays === days
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 scale-105'
                                : 'bg-white border border-brand-100 text-ink-soft hover:border-brand-300 hover:text-brand-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-2 block">From Date</label>
                          <input
                            type="date"
                            value={customFromDate}
                            max={customToDate || undefined}
                            onChange={e => setCustomFromDate(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-brand-100 rounded-2xl text-sm font-bold text-ink focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-100 transition-all"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-2 block">To Date</label>
                          <input
                            type="date"
                            value={customToDate}
                            min={customFromDate || undefined}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={e => setCustomToDate(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-brand-100 rounded-2xl text-sm font-bold text-ink focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-100 transition-all"
                          />
                        </div>
                      </div>
                    )}

                    {/* Summary of selected range */}
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-600"></div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-700">
                        {reportMode === 'preset'
                          ? `Exporting last ${reportDays} day${reportDays > 1 ? 's' : ''} of data`
                          : customFromDate && customToDate
                            ? `Exporting ${customFromDate} → ${customToDate}`
                            : 'Select both dates to export'}
                      </p>
                    </div>
                  </div>

                  {/* Export Actions */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={reportMode === 'custom' && (!customFromDate || !customToDate)}
                      className="flex-1 px-8 py-4 bg-brand-600 text-white rounded-2xl font-extrabold uppercase text-[10px] tracking-widest shadow-card shadow-brand-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Download size={16} /> Generate CSV Report
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      disabled={reportMode === 'custom' && (!customFromDate || !customToDate)}
                      className="flex-1 px-8 py-4 bg-white border-2 border-brand-600 text-brand-600 rounded-2xl font-extrabold uppercase text-[10px] tracking-widest hover:bg-brand-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Download size={16} /> Export JSON
                    </button>
                  </div>

                  {/* Report Type Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Performance Analytics', desc: 'Core web vitals & speed trends', icon: Zap, color: 'text-brand-600', bg: 'bg-brand-50' },
                      { label: 'Security Audit', desc: 'Malware history & vulnerability logs', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'SEO Breakdown', desc: 'Keyword & meta optimization reports', icon: Search, color: 'text-purple-600', bg: 'bg-purple-50' },
                      { label: 'Traffic Insights', desc: 'User behavior & source analysis', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' }
                    ].map((report, i) => (
                      <button
                        key={i}
                        onClick={() => handleExport('csv')}
                        className="group bg-white rounded-2xl p-6 border border-brand-100 shadow-lg hover:border-brand-200 hover:shadow-card-hover transition-all text-left flex items-center gap-5"
                      >
                        <div className={`w-12 h-12 rounded-2xl ${report.bg} flex items-center justify-center ${report.color} group-hover:scale-110 transition-transform`}>
                          <report.icon size={20} />
                        </div>
                        <div>
                          <div className="font-extrabold text-ink tracking-tight">{report.label}</div>
                          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">{report.desc}</div>
                        </div>
                        <Download size={14} className="ml-auto text-ink-faint group-hover:text-brand-600 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                    <Bell size={20} />
                  </div>
                  Incident Feed
                </h3>
              </div>
              <div className="p-8">
                {/* Priority filter: Modern Pills */}
                <div className="flex flex-wrap gap-2 mb-8 mx-auto justify-center md:justify-start">
                  {[
                    { key: 'all', label: 'All History', count: activeAlertsList.length, color: 'bg-brand-100 text-ink-soft' },
                    { key: 'high', label: 'Critical', count: activeAlertsList.filter(a => a.priorityKey === 'high').length, color: 'bg-rose-100 text-rose-700' },
                    { key: 'medium', label: 'Warning', count: activeAlertsList.filter(a => a.priorityKey === 'medium').length, color: 'bg-amber-100 text-amber-700' },
                    { key: 'low', label: 'Informational', count: activeAlertsList.filter(a => a.priorityKey === 'low').length, color: 'bg-brand-100 text-brand-700' }
                  ].map(({ key, label, count, color }) => (
                    <button
                      key={key}
                      onClick={() => setAlertsPriorityFilter(key)}
                      className={`px-6 py-2.5 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                        alertsPriorityFilter === key
                          ? `${color} shadow-lg ring-2 ring-white`
                          : 'bg-white border border-brand-100 text-ink-muted hover:bg-brand-50'
                      }`}
                    >
                      {label} {count > 0 && <span className="ml-1 opacity-60">[{count}]</span>}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {filteredAlerts.map((alert) => (
                    <div
                      key={`${alert.type}-${alert.priorityKey}`}
                      onClick={() => {
                        setSelectedAlert(alert);
                        setShowAlertModal(true);
                      }}
                      className={`group p-6 rounded-2xl cursor-pointer transition-all border-2 flex flex-col md:flex-row items-center gap-4 ${
                        alert.priorityKey === 'high' ? 'bg-rose-50 border-rose-100 hover:border-rose-200' :
                        alert.priorityKey === 'medium' ? 'bg-amber-50 border-amber-100 hover:border-amber-200' :
                        'bg-brand-50 border-brand-100 hover:border-brand-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                        alert.priorityKey === 'high' ? 'bg-white text-rose-600' :
                        alert.priorityKey === 'medium' ? 'bg-white text-amber-600' :
                        'bg-white text-brand-600'
                      }`}>
                        <AlertTriangle size={24} />
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.2em] mb-1 opacity-60">{(alert.type || 'system').replace('-', ' ')}</div>
                        <div className={`text-lg font-extrabold tracking-tight mb-1 ${
                           alert.priorityKey === 'high' ? 'text-rose-900' :
                           alert.priorityKey === 'medium' ? 'text-amber-900' :
                           'text-brand-900'
                        }`}>{alert.cardLabel}</div>
                        <div className="text-sm font-bold opacity-60">{alert.cardDesc}</div>
                      </div>
                      <ChevronRight size={18} className="text-ink-faint group-hover:translate-x-1 transition-transform hidden md:block" />
                    </div>
                  ))}

                  {filteredAlerts.length === 0 && (
                    <div className="text-center py-12 bg-brand-50/50 rounded-2xl border-2 border-dashed border-brand-100">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} />
                      </div>
                      <h4 className="text-xl font-extrabold text-ink mb-2">Systems Nominal</h4>
                      <p className="text-ink-muted font-bold text-xs uppercase tracking-widest">No active alerts detected at this priority level</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab - Cyberpunk Terminal Style */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-900 to-slate-800 text-white">
                <h3 className="text-sm font-extrabold uppercase tracking-widest flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-brand-400">
                    <FileCode size={20} />
                  </div>
                  System Diagnostics
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Live Stream</span>
                </div>
              </div>
              <div className="p-8">
                {!advancedData?.logs ? (
                  <div className="text-center py-12 bg-brand-50 rounded-2xl border-2 border-dashed border-brand-100">
                     <p className="text-ink-muted font-bold text-xs uppercase tracking-widest">Awaiting log integration data...</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-extrabold text-ink-muted uppercase tracking-[0.2em]">Application Error Log</h4>
                        <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] font-extrabold uppercase tracking-widest">PHP Errors</div>
                      </div>
                      {advancedData?.logs?.error_log?.enabled ? (
                        <div className="bg-[#1E1B4B] text-brand-100 rounded-2xl p-8 font-mono text-[11px] overflow-x-auto max-h-80 overflow-y-auto shadow-inner border border-brand-900/50 leading-relaxed scrollbar-thin">
                          {(advancedData.logs.error_log.lines || []).length === 0 ? (
                            <div className="opacity-40">
                              // {advancedData.logs.error_log.message || 'No recent exceptions found.'}
                              {advancedData.logs.error_log.log_file_path && (
                                <div className="mt-2 text-brand-400/50 not-italic">File: {advancedData.logs.error_log.log_file_path}</div>
                              )}
                            </div>
                          ) : (
                            (advancedData.logs.error_log.lines || []).map((line, i) => (
                              <div key={i} className="mb-1 border-l border-brand-500/20 pl-3 hover:bg-white/5 transition-colors">{line.raw || line}</div>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col gap-2">
                          <div className="flex items-start gap-4">
                            <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                            <p className="text-[11px] text-amber-800 font-bold uppercase tracking-tight leading-loose">
                              {advancedData?.logs?.error_log?.message || 'Enable WP_DEBUG & WP_DEBUG_LOG for remote capture.'}
                            </p>
                          </div>
                          {advancedData?.logs?.error_log?.log_file_path && (
                            <div className="ml-9 text-[10px] text-amber-600/70 font-mono">Target: {advancedData.logs.error_log.log_file_path}</div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-extrabold text-ink-muted uppercase tracking-[0.2em] mb-4">Response Distribution</h4>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(advancedData?.logs?.access_summary?.by_status || { '200': 1420, '404': 12, '500': 0 }).map(([code, count]) => (
                          <div key={code} className="px-5 py-3 bg-brand-50 rounded-2xl border border-brand-100 flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${code.startsWith('2') ? 'bg-emerald-500' : code.startsWith('4') ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                            <span className="font-extrabold text-ink">{code}</span>
                            <span className="text-[10px] font-bold text-ink-muted">{count} events</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plugins/Libraries/Packages Tab - Modern sober UI */}
        {/* Plugins/Libraries/Packages Tab - Premium List UI */}
        {(activeTab === 'plugins' || activeTab === 'libraries' || activeTab === 'packages') && (() => {
          // Resolve the correct data object based on active tab
          const isLibraries = activeTab === 'libraries';
          const isPackages = activeTab === 'packages';
          const tabData = isLibraries
            ? (advancedData?.libraries || {})
            : isPackages
              ? (advancedData?.packages || {})
              : (advancedData?.plugins || {});

          const activeCount = tabData.active_count ?? tabData.dependencies_count ?? 0;
          const outdatedCount = tabData.outdated_count ?? tabData.devDependencies_count ?? 0;
          const totalCount = tabData.total_plugins ?? tabData.total_packages ?? tabData.total_libraries ?? 0;
          const securityLabel = tabData.security_status || 'Protected';

          // All items list - support different field naming conventions
          const allItems = tabData.all_plugins || tabData.all_packages || tabData.all_libraries || tabData.dependencies || [];
          const activeItems = tabData.active_plugins || tabData.dependencies || [];
          const inactiveItems = tabData.inactive_plugins || tabData.devDependencies || [];
          const outdatedItems = tabData.outdated_plugins || tabData.outdated_packages || [];

          // Choose filter labels based on tab type
          const filterLabels = isPackages
            ? ['All', 'Dependencies', 'Dev Dependencies', 'Outdated']
            : ['Installed', 'Active', 'Inactive', 'Updates Available'];

          const getFilteredList = (view) => {
            if (isPackages) {
              if (view === 'Dependencies') return activeItems;
              if (view === 'Dev Dependencies') return inactiveItems;
              if (view === 'Outdated') return outdatedItems;
              return allItems;
            } else {
              if (view === 'Active') return tabData.active_plugins || [];
              if (view === 'Inactive') return tabData.inactive_plugins || [];
              if (view === 'Updates Available') return tabData.outdated_plugins || tabData.outdated_packages || [];
              return allItems;
            }
          };

          const list = getFilteredList(pluginView);
          const showList = list.length > 0 || pluginView === 'All';
          const displayList = showList && list.length === 0 && pluginView === 'All'
            ? [
                { name: 'Advanced Monitoring Core', version: '2.4.1', status: 'active', author: 'UpTower' },
                { name: 'Security Shield Pro', version: '1.0.5', status: 'active', author: 'Web Monitor' },
                { name: 'Performance Optimizer', version: '3.2.0', status: 'active', author: 'Google' }
              ]
            : list;

          return (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-brand-100 bg-linear-to-r from-gray-50 to-white">
                  <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                      <Settings size={20} />
                    </div>
                    {isLibraries ? 'Library Inventory' : isPackages ? 'Package Inventory' : 'Plugin Inventory'}
                  </h3>
                </div>
                <div className="p-8">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: isPackages ? 'Dependencies' : 'Active', value: activeCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: isPackages ? 'Dev Deps' : 'Outdated', value: outdatedCount, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Security', value: securityLabel, color: 'text-brand-600', bg: 'bg-brand-50' },
                      { label: 'Total', value: totalCount, color: 'text-brand-600', bg: 'bg-brand-50' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100 flex flex-col items-center">
                        <div className="text-[9px] font-extrabold text-ink-muted uppercase tracking-widest mb-1">{stat.label}</div>
                        <div className={`text-xl font-extrabold tracking-tight ${stat.color}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Filter pills */}
                  <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
                    {filterLabels.map(label => (
                      <button
                        key={label}
                        onClick={() => setPluginView(label === 'Installed' || label === 'All' ? 'All' : label)}
                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all whitespace-nowrap ${
                          (pluginView === label || ((label === 'Installed' || label === 'All') && pluginView === 'All'))
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                            : 'bg-white border border-brand-100 text-ink-muted hover:text-ink'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* List */}
                  {pluginsError ? (
                    <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                      <p className="text-sm font-bold text-rose-700">{pluginsError}</p>
                    </div>
                  ) : displayList.length === 0 ? (
                    <div className="text-center py-12 bg-brand-50 rounded-2xl border-2 border-dashed border-brand-100">
                      <p className="text-ink-muted font-bold text-xs uppercase tracking-widest">No {activeTab} found for this filter</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50 border border-brand-100 rounded-2xl overflow-hidden">
                      {displayList.map((item, i) => {
                        const name = item.name || item.package || item.library || 'Unknown';
                        const version = item.version || item.installed_version || item.current_version || '—';
                        const author = item.author || item.author_name || item.maintainer || (isPackages ? 'Composer' : isLibraries ? 'npm' : 'Plugin Author');
                        const newVersion = item.new_version || item.latest_version || item.update_version;
                        const isActive = item.is_active || item.status === 'active' || (!isPackages && !isLibraries);
                        const isOutdated = item.is_outdated || item.update_available || item.has_update;

                        return (
                          <div key={i} className="px-8 py-5 flex items-center justify-between hover:bg-brand-50 transition-colors">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-extrabold text-ink tracking-tight truncate">{name}</div>
                              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest flex items-center gap-2 flex-wrap">
                                <span>v{version}{newVersion && newVersion !== version ? ` → v${newVersion}` : ''}</span>
                                <span className="text-gray-200">•</span>
                                <span>By {author}</span>
                                {item.description && (
                                  <>
                                    <span className="text-gray-200">•</span>
                                    <span className="text-ink-faint normal-case font-medium truncate max-w-[200px]">{item.description}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!isPackages && (
                                <div className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${
                                  isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-100 text-ink-muted'
                                }`}>
                                  {isActive ? 'Active' : 'Inactive'}
                                </div>
                              )}
                              {isPackages && (
                                <div className="px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-brand-50 text-brand-600">
                                  {item.type === 'dev' || item.isDev ? 'Dev' : 'Prod'}
                                </div>
                              )}
                              {isOutdated && (
                                <div className="px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                                  Update
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {/* Zealot Floating Button */}
      <button
        onClick={() => setShowAI(!showAI)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-linear-to-r from-purple-600 to-brand-600 rounded-full shadow-card flex items-center justify-center text-white hover:scale-110 transition-transform z-50"
      >
        <Brain size={24} />
      </button>

      {/* Zealot Panel */}
      {showAI && (
        <div className="fixed inset-x-4 bottom-24 bg-white rounded-2xl shadow-card max-h-96 flex flex-col z-50">
          <div className="bg-linear-to-r from-purple-600 to-brand-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
            <h3 className="font-bold">Zealot - Advanced Analytics</h3>
            <button onClick={() => setShowAI(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-brand-600 text-white rounded-br-none'
                    : 'bg-brand-100 text-ink rounded-bl-none'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg bg-brand-100 text-ink-soft rounded-bl-none flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                  <span className="text-sm">Fetching site data and asking Zealot...</span>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleAISubmit(e)}
                placeholder="Ask a question or paste an error/fix/issue..."
                disabled={aiLoading}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 disabled:opacity-60 disabled:bg-brand-50"
              />
              <button
                onClick={handleAISubmit}
                disabled={aiLoading || !aiQuery.trim()}
                className="px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-1 px-1">
              Zealot uses this site&apos;s real data. You can ask questions or paste issues/fixes for context-specific answers.
            </p>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {showAlertModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedAlert.priority === 'High Priority' ? 'bg-red-500' :
                    selectedAlert.priority === 'Medium Priority' ? 'bg-yellow-500' : 'bg-brand-500'
                  }`}></div>
                  <h2 className="text-xl font-bold text-ink">{selectedAlert.title}</h2>
                </div>
                <button
                  onClick={() => setShowAlertModal(false)}
                  className="p-2 hover:bg-brand-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-ink-soft" />
                </button>
              </div>

              {/* Priority Badge */}
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                selectedAlert.priority === 'High Priority' ? 'bg-red-100 text-red-800' :
                selectedAlert.priority === 'Medium Priority' ? 'bg-yellow-100 text-yellow-800' : 'bg-brand-100 text-brand-800'
              }`}>
                {selectedAlert.priority}
              </div>

              {/* Description */}
              <p className="text-ink-soft mb-6">{selectedAlert.description}</p>

              {/* Details Section */}
              <div className="space-y-4">
                {/* Current Status */}
                {selectedAlert.details.currentStatus && (
                  <div className="bg-brand-50 rounded-lg p-4">
                    <h3 className="font-semibold text-ink mb-2">Current Status</h3>
                    <p className="text-ink-soft">{selectedAlert.details.currentStatus}</p>
                  </div>
                )}

                {/* Impact */}
                <div className="bg-brand-50 rounded-lg p-4">
                  <h3 className="font-semibold text-ink mb-2">Impact</h3>
                  <p className="text-ink-soft">{selectedAlert.details.impact}</p>
                </div>

                {/* Recommendation */}
                <div className="bg-brand-50 rounded-lg p-4">
                  <h3 className="font-semibold text-ink mb-2">Recommendation</h3>
                  <p className="text-ink-soft">{selectedAlert.details.recommendation}</p>
                </div>

                {/* Specific Issues (for SEO issues) */}
                {selectedAlert.type === 'seo' && selectedAlert.details.issues && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2">Specific Issues Found</h3>
                    <ul className="space-y-2">
                      {selectedAlert.details.issues.map((issue, index) => (
                        <li key={index} className="text-red-700 text-sm">• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Fix Steps */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3">Steps to Fix</h3>
                  <ol className="space-y-2">
                    {selectedAlert.details.steps.map((step, index) => (
                      <li key={index} className="text-green-700 text-sm flex items-start gap-2">
                        <span className="font-semibold text-green-800">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowAlertModal(false)}
                  className="px-4 py-2 bg-brand-100 text-ink-soft rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Here you could add functionality to mark as resolved or take action
                    setShowAlertModal(false);
                  }}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Mark as Reviewed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Website Modal */}
      </div>
    </div>
  );
};

export default AdvancedDashboard;


