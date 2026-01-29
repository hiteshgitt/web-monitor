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
  ChevronDown, ChevronUp, FileCode, Image, Server, HardDrive, Wifi, GripVertical
} from 'lucide-react';
import useNotifications from '../hooks/useNotifications';
import { getApiUrl } from '../config/api';
import EditWebsiteModal from './EditWebsiteModal';

const AdvancedDashboard = ({ selectedWebsite, onBackToHome }) => {
  // Drag and drop state for overview cards
  const getCardConfig = () => [
    { id: 'uptime', label: 'Uptime', icon: CheckCircle, colorClass: 'text-green-600', unit: '%', subtitle: 'Last 30 days' },
    { id: 'response', label: 'Response', icon: Activity, colorClass: 'text-blue-600', unit: 'ms', subtitle: 'Average' },
    { id: 'visitors', label: 'Visitors', icon: Users, colorClass: 'text-purple-600', unit: '', subtitle: 'This month' },
    { id: 'security', label: 'Security', icon: Shield, colorClass: 'text-red-600', unit: '', subtitle: 'Out of 100' },
  ];
  
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem(`dashboard-order-${selectedWebsite?._id}`);
    return saved ? JSON.parse(saved) : ['uptime', 'response', 'visitors', 'security'];
  });

  const getCardValue = (cardId) => {
    switch(cardId) {
      case 'uptime': return selectedWebsite?.uptime || 'N/A';
      case 'response': return selectedWebsite?.responseTime || 'N/A';
      case 'visitors': return selectedWebsite?.analytics?.totalVisitors ? (selectedWebsite.analytics.totalVisitors / 1000).toFixed(1) + 'K' : 'N/A';
      case 'security': return selectedWebsite?.security?.securityScore || 'N/A';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [advancedData, setAdvancedData] = useState(null);
  const [dateRange, setDateRange] = useState('7daysAgo');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pluginView, setPluginView] = useState('All'); // For plugin tab switching
  const [pluginsError, setPluginsError] = useState(null);
  const [expandedActions, setExpandedActions] = useState({});
  const [alertsPriorityFilter, setAlertsPriorityFilter] = useState('all'); // 'all' | 'high' | 'medium' | 'low'
  const { getNotificationCountForWebsite } = useNotifications();
  const notificationCount = selectedWebsite?._id ? getNotificationCountForWebsite(selectedWebsite._id) : 0;

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
        bgClass: 'bg-blue-50 hover:bg-blue-100',
        titleClass: 'text-blue-800',
        descClass: 'text-blue-700',
        hintClass: 'text-blue-600'
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
    'reports', 'alerts', getPluginsTabName()
  ];

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
  }, [selectedWebsite, dateRange]);

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
            alertElement.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => {
              alertElement.classList.remove('ring-2', 'ring-blue-500');
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
        const apiUrl = import.meta.env.DEV ? '/api' : 'http://localhost:5000/api';
        const res = await fetch(`${apiUrl}/advanced/plugins/${selectedWebsite._id}`);
        
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
      const apiUrl = import.meta.env.DEV ? '/api' : 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/advanced/comprehensive/${selectedWebsite._id}`);
      const data = await response.json();
      setAdvancedData(data);
    } catch (error) {
      console.error('Error loading advanced data:', error);
      // Use mock data for demonstration
      setAdvancedData(getMockAdvancedData());
    } finally {
      setLoading(false);
    }
  };

  const getMockAdvancedData = () => ({
    basic: {
      status: 'healthy',
      responseTime: 245,
      uptime: 99.9
    },
    analytics: {
      googleAnalytics: {
        sessions: 15420,
        users: 12350,
        pageviews: 45680,
        bounceRate: 42.3,
        averageSessionDuration: 180,
        deviceBreakdown: {
          desktop: 6200,
          mobile: 8200,
          tablet: 1020
        },
        channelBreakdown: {
          organic: 8200,
          direct: 4500,
          social: 2100,
          referral: 1200,
          paid: 420
        }
      }
    },
    performance: {
      coreWebVitals: {
        lcp: { value: 2100, score: 85, status: 'good' },
        fid: { value: 85, score: 92, status: 'good' },
        cls: { value: 0.08, score: 88, status: 'good' },
        overallScore: 88
      },
      pageSpeedInsights: {
        performanceScore: 88,
        accessibilityScore: 92,
        bestPracticesScore: 85,
        seoScore: 90,
        pwaScore: 75
      }
    },
    security: {
      overallSecurityScore: 92,
      malwareScan: { status: 'clean', threats: 0 },
      vulnerabilityScan: { status: 'secure', vulnerabilityCount: 0 },
      sslStatus: { grade: 'A+' },
      firewallStatus: { enabled: true, provider: 'Cloudflare' }
    },
    aiInsights: {
      analyticsInsights: {
        insights: ['Traffic shows consistent growth pattern', 'Mobile users have higher engagement rates'],
        recommendations: ['Focus on mobile optimization', 'Improve content for organic search']
      },
      performanceInsights: {
        insights: ['Performance score is above average', 'Core Web Vitals are within Google standards'],
        recommendations: ['Implement lazy loading for images', 'Optimize third-party scripts']
      }
    }
  });

  // Shared: send a query to Zealot and update chat (used by form submit and "Ask Zealot" from Fix Actions)
  const submitQueryToZealot = async (q) => {
    const trimmed = (q && String(q).trim()) || '';
    if (!trimmed) return;

    setAiMessages(prev => [...prev, { type: 'user', text: trimmed }]);
    setAiLoading(true);

    try {
      const apiUrl = getApiUrl(`advanced/ai-insights/${selectedWebsite._id}/query`);
      const res = await fetch(apiUrl, {
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

  const getStatusColor = (status) => {
    switch(status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Premium Fix Actions - Only in Advanced View
  const actionItems = [
    {
      id: 'fix-images',
      icon: Image,
      label: 'Fix Images',
      category: 'performance',
      description: 'Optimize large images to improve page load speed',
      files: [
        { path: '/wp-content/uploads/2024/hero-image.jpg', size: '2.4 MB', recommended: '200 KB' },
        { path: '/wp-content/uploads/2024/gallery-1.png', size: '1.8 MB', recommended: '150 KB' },
        { path: '/wp-content/uploads/2024/banner-large.jpg', size: '3.1 MB', recommended: '250 KB' },
        { path: '/wp-content/uploads/2024/product-image.jpg', size: '1.5 MB', recommended: '180 KB' },
        { path: '/wp-content/themes/theme/assets/images/logo.png', size: '850 KB', recommended: '50 KB' }
      ],
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
      files: [
        { path: '/wp-content/themes/theme/js/main.js', size: '450 KB', recommended: '120 KB (minified)' },
        { path: '/wp-content/plugins/plugin-name/assets/script.js', size: '280 KB', recommended: '85 KB (minified)' },
        { path: '/wp-content/themes/theme/js/custom.js', size: '320 KB', recommended: '95 KB (minified)' },
        { path: '/wp-includes/js/jquery/jquery.js', size: '280 KB', recommended: 'Use CDN version' }
      ],
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-gray-200 border-t-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-700 font-semibold text-base">Loading advanced analytics...</p>
          <p className="text-gray-500 text-sm mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  // Calculate overall score for hero section
  const calculateOverallScore = () => {
    const perfScore = selectedWebsite.performance?.performanceScore || selectedWebsite.uptime || 85;
    const seoScore = selectedWebsite.seo?.score || 85;
    const secScore = selectedWebsite.security?.securityScore || 92;
    return Math.round((perfScore + seoScore + secScore) / 3);
  };

  const overallScore = calculateOverallScore();
  const status = overallScore >= 80 ? 'good' : overallScore >= 60 ? 'needs-fix' : 'critical';

  const getHeroStatusColor = () => {
    switch(status) {
      case 'good': return 'bg-green-500';
      case 'needs-fix': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getHeroStatusText = () => {
    switch(status) {
      case 'good': return 'Good';
      case 'needs-fix': return 'Needs Fix';
      case 'critical': return 'Critical';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-5 ">
      {/* Modern Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={onBackToHome}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-target"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900 truncate">{selectedWebsite.name}</h1>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded">ADVANCED</span>
              <RealTimeIndicator isLive={!loading} />
            </div>
            <p className="text-xs text-gray-500 truncate">{selectedWebsite.url}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowEditModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-target"
              title="Settings"
            >
              <Settings size={18} className="text-gray-600" />
            </button>
            <button 
              onClick={loadAdvancedData}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-target"
              title="Refresh"
            >
              <RefreshCw size={18} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setActiveTab('alerts')}
              className="p-2 hover:bg-gray-100 rounded-lg relative transition-colors touch-target"
              title={`${notificationCount} notification${notificationCount !== 1 ? 's' : ''}`}
            >
              <Bell size={18} className="text-gray-600" />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Side Menu */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setMenuOpen(false)}>
          <div className="bg-white w-80 h-full shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-gray-800">Advanced Features</h2>
            <div className="space-y-2">
              {advancedTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setMenuOpen(false); }}
                  className={`w-full text-left p-3 rounded-lg capitalize flex items-center gap-3 ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab === 'overview' && <Home size={20} />}
                  {tab === 'analytics' && <BarChart3 size={20} />}
                  {tab === 'performance' && <Zap size={20} />}
                  {tab === 'seo' && <Search size={20} />}
                  {tab === 'security' && <Shield size={20} />}
                  {tab === 'reports' && <Download size={20} />}
                  {tab === 'alerts' && <Bell size={20} />}
                  {(tab === 'plugins' || tab === 'libraries') && <Settings size={20} />}
                  {tab.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🟢 Hero Section with Overall Score */}
      <div className={`px-4 pt-6 pb-8 ${status === 'good' ? 'bg-green-50' : status === 'needs-fix' ? 'bg-yellow-50' : 'bg-red-50'}`}>
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-3">{selectedWebsite.url}</div>
          <div className="flex items-center justify-center mb-3">
            <div className={`relative w-32 h-32 rounded-full ${getHeroStatusColor()} flex items-center justify-center shadow-lg`}>
              <div className="text-white text-4xl font-bold">{overallScore}</div>
            </div>
          </div>
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-sm border border-gray-200">
            <div className={`w-2 h-2 rounded-full mr-2 ${getHeroStatusColor()}`}></div>
            <span className="text-sm font-semibold text-gray-900">{getHeroStatusText()}</span>
          </div>
        </div>
      </div>

      {/* 📊 KPI Cards Row */}
      <div className="px-4 -mt-4 mb-6">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          <div className="flex-shrink-0 w-28 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap size={18} className="text-blue-700" />
              <TrendingUp size={14} className="text-blue-700" />
            </div>
            <div className="text-2xl font-bold text-blue-700 mb-1">{selectedWebsite.performance?.performanceScore || selectedWebsite.uptime || 85}</div>
            <div className="text-xs font-medium text-blue-600 opacity-75">Speed</div>
          </div>
          <div className="flex-shrink-0 w-28 rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <Search size={18} className="text-purple-700" />
              <TrendingUp size={14} className="text-purple-700" />
            </div>
            <div className="text-2xl font-bold text-purple-700 mb-1">{selectedWebsite.seo?.score || 85}</div>
            <div className="text-xs font-medium text-purple-600 opacity-75">SEO</div>
          </div>
          <div className="flex-shrink-0 w-28 rounded-xl border-2 border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle size={18} className="text-green-700" />
              <TrendingUp size={14} className="text-green-700" />
            </div>
            <div className="text-2xl font-bold text-green-700 mb-1">78</div>
            <div className="text-xs font-medium text-green-600 opacity-75">Accessibility</div>
          </div>
          <div className="flex-shrink-0 w-28 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <Shield size={18} className="text-red-700" />
              <TrendingUp size={14} className="text-red-700" />
            </div>
            <div className="text-2xl font-bold text-red-700 mb-1">{selectedWebsite.security?.securityScore || 92}</div>
            <div className="text-xs font-medium text-red-600 opacity-75">Security</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-5">
        {/* Modern Sticky Tab Navigation - Contained in section */}
        <div className="sticky top-[65px] z-30 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-sm mb-5 overflow-hidden">
          <div className="tab-scroll-container py-3 px-4 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-2.5 flex-nowrap min-w-max">
              {advancedTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`tab-button px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 touch-target flex items-center gap-2 flex-shrink-0 ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 active:scale-95'
                  }`}
                >
                  {tab === 'overview' && <Home size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  {tab === 'analytics' && <BarChart3 size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  {tab === 'performance' && <Zap size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  {tab === 'seo' && <Search size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  {tab === 'security' && <Shield size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  {tab === 'reports' && <Download size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  {tab === 'alerts' && <Bell size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  {(tab === 'plugins' || tab === 'libraries' || tab === 'packages') && <Settings size={16} className={activeTab === tab ? 'text-white' : 'text-gray-500'} />}
                  <span>{tab === 'libraries' ? 'Libraries' : tab === 'packages' ? 'Packages' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Key Metrics Grid - Draggable Cards */}
            <div className="grid grid-cols-2 gap-3">
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
                    className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-all cursor-move relative group ${
                      isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}`}
                  >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical size={14} className="text-gray-400" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={18} className={card.colorClass} />
                      <span className="text-xs text-gray-500 font-medium">{card.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {card.value}{card.unit}
                    </div>
                    <div className="text-[10px] text-gray-400">{card.subtitle}</div>
                  </div>
                );
              })}
            </div>

            {/* Server / Hosting Info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Server size={18} className="text-indigo-600" />
                  Server Info
                </h3>
                {advancedData?.serverInfo?.lastChecked && (
                  <span className="text-[10px] text-gray-400">
                    Last checked: {new Date(advancedData.serverInfo.lastChecked).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Downtime (24h)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {advancedData?.serverInfo?.downtimeHours?.last24h != null
                        ? `${advancedData.serverInfo.downtimeHours.last24h}h`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Downtime (7d)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {advancedData?.serverInfo?.downtimeHours?.last7d != null
                        ? `${advancedData.serverInfo.downtimeHours.last7d}h`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Downtime (30d)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {advancedData?.serverInfo?.downtimeHours?.last30d != null
                        ? `${advancedData.serverInfo.downtimeHours.last30d}h`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Uptime</div>
                    <div className="text-lg font-bold text-green-700">
                      {advancedData?.serverInfo?.uptimePercent != null
                        ? `${advancedData.serverInfo.uptimePercent}%`
                        : selectedWebsite?.uptime != null ? `${selectedWebsite.uptime}%` : '—'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                    <HardDrive size={18} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Disk space</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {advancedData?.serverInfo?.diskSpace
                          ? `${advancedData.serverInfo.diskSpace.used ?? '—'} / ${advancedData.serverInfo.diskSpace.total ?? '—'} ${advancedData.serverInfo.diskSpace.unit || 'GB'}`
                          : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                    <Wifi size={18} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Bandwidth</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {advancedData?.serverInfo?.bandwidth
                          ? `${advancedData.serverInfo.bandwidth.used ?? '—'} / ${advancedData.serverInfo.bandwidth.limit ?? '—'} ${advancedData.serverInfo.bandwidth.unit || 'GB'}`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
                {advancedData?.serverInfo?.serverResourcesMessage && (
                  <p className="text-xs text-gray-500 flex items-start gap-2">
                    <Info size={14} className="flex-shrink-0 mt-0.5" />
                    {advancedData.serverInfo.serverResourcesMessage}
                  </p>
                )}
                {advancedData?.serverInfo?.checkIntervalMinutes != null && (
                  <p className="text-[10px] text-gray-400">Check interval: {advancedData.serverInfo.checkIntervalMinutes} min</p>
                )}
              </div>
            </div>

            {/* Performance Breakdown - Modern List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Gauge size={18} className="text-blue-600" />
                  Performance Breakdown
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <Clock size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-700 font-medium">Load Time</span>
                  </div>
                  <span className="text-base font-bold text-gray-900">{selectedWebsite?.performance?.loadTime ? (selectedWebsite.performance.loadTime / 1000).toFixed(2) + 's' : 'N/A'}</span>
                </div>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <Activity size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-700 font-medium">Server Response</span>
                  </div>
                  <span className="text-base font-bold text-gray-900">{selectedWebsite?.performance?.serverResponseTime ? (selectedWebsite.performance.serverResponseTime / 1000).toFixed(2) + 's' : 'N/A'}</span>
                </div>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <Gauge size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-700 font-medium">Database Query</span>
                  </div>
                  <span className="text-base font-bold text-gray-900">{selectedWebsite?.performance?.databaseQueryTime ? (selectedWebsite.performance.databaseQueryTime / 1000).toFixed(2) + 's' : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Traffic Overview - Modern Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-600" />
                Traffic Overview
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Total Sessions</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.analytics?.totalPageViews ? (selectedWebsite.analytics.totalPageViews / 1000).toFixed(1) + 'K' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Unique Users</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.analytics?.totalVisitors ? (selectedWebsite.analytics.totalVisitors / 1000).toFixed(1) + 'K' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Page Views</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.analytics?.totalPageViews ? (selectedWebsite.analytics.totalPageViews / 1000).toFixed(1) + 'K' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Bounce Rate</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.analytics?.bounceRate || 'N/A'}%</div>
                </div>
              </div>
            </div>

            {/* Site Health Summary - Modern Grid */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs text-blue-600 font-medium mb-1">Security Score</div>
                  <div className="text-sm font-bold text-blue-800">
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

            {/* 🎯 Premium Fix Actions - Advanced View Only */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Zap size={18} className="text-purple-600" />
                  Fix Actions
                </h3>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded">PREMIUM</span>
              </div>
              <div className="space-y-3">
                {actionItems.map((action) => {
                  const Icon = action.icon;
                  const isExpanded = expandedActions[action.id];
                  
                  return (
                    <div
                      key={action.id}
                      className="bg-gray-50 rounded-xl border-2 border-gray-200 overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => toggleAction(action.id)}
                        className="w-full p-4 flex items-center justify-between touch-target hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <Icon size={20} className="text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-gray-900 mb-0.5">{action.label}</div>
                            <div className="text-xs text-gray-500">{action.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {action.files && action.files.length > 0 && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded">
                              {action.files.length} files
                            </span>
                          )}
                          {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-200 space-y-4 bg-white">
                          {/* File List */}
                          {action.files && action.files.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <FileCode size={14} />
                                Files to Fix ({action.files.length})
                              </h4>
                              <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                                {action.files.map((file, idx) => (
                                  <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-mono text-gray-700 truncate" title={file.path}>
                                        {file.path}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-red-600 font-medium">Current: {file.size}</span>
                                        <span className="text-gray-400">→</span>
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
                            <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <CheckCircle size={14} />
                              Manual Fix Instructions
                            </h4>
                            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                              <div className="text-xs text-blue-800 font-medium mb-2">
                                ⚠️ These fixes need to be done manually on your server/files
                              </div>
                              <ol className="space-y-1.5">
                                {action.instructions.map((instruction, idx) => (
                                  <li key={idx} className="text-xs text-blue-700 flex items-start gap-2">
                                    <span className="font-semibold text-blue-800 flex-shrink-0">{idx + 1}.</span>
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
                              <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <FileCode size={14} />
                                Configuration Example
                              </h4>
                              <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                  {action.configExample}
                                </pre>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-1">
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={18} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Website Analytics</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Visitors</span>
                    <span className="text-sm font-bold text-gray-900">{selectedWebsite?.analytics?.totalVisitors || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Page Views</span>
                    <span className="text-sm font-bold text-gray-900">{selectedWebsite?.analytics?.totalPageViews || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Bounce Rate</span>
                    <span className="text-sm font-bold text-gray-900">{selectedWebsite?.analytics?.bounceRate || 'N/A'}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Avg Session</span>
                    <span className="text-sm font-bold text-gray-900">{selectedWebsite?.analytics?.avgSessionDuration || 'N/A'}s</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Search size={20} className="text-green-600" />
                  Search Console
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Clicks</span>
                    <span className="font-bold">{(advancedData?.analytics?.searchConsole?.totalClicks / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Impressions</span>
                    <span className="font-bold">{(advancedData?.analytics?.searchConsole?.totalImpressions / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">CTR</span>
                    <span className="font-bold">{advancedData?.analytics?.searchConsole?.averageCTR}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Position</span>
                    <span className="font-bold">{advancedData?.analytics?.searchConsole?.averagePosition}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Traffic Sources Chart - Enhanced */}
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-gray-800 mb-4">Traffic Sources</h3>
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
                    animationDuration={500}
                  >
{Object.entries(advancedData?.analytics?.googleAnalytics?.channelBreakdown || {}).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Device Breakdown - Enhanced */}
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-gray-800 mb-4">Device Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(advancedData?.analytics?.googleAnalytics?.deviceBreakdown || {}).map(([key, value]) => ({
                  name: key.charAt(0).toUpperCase() + key.slice(1),
                  sessions: value
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip formatter={(value) => `${value.toLocaleString()} sessions`} />} />
                  <Bar 
                    dataKey="sessions" 
                    fill="#6366f1" 
                    radius={[8, 8, 0, 0]}
                    animationDuration={500}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-4">
            {/* Performance Metrics - Modern Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-blue-600" />
                  <span className="text-xs text-gray-500 font-medium">Load Time</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {selectedWebsite?.performance?.loadTime ? (selectedWebsite.performance.loadTime / 1000).toFixed(2) + 's' : 'N/A'}
                </div>
                <div className="text-[10px] text-green-600">Real Data</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-green-600" />
                  <span className="text-xs text-gray-500 font-medium">Server Response</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {selectedWebsite?.performance?.serverResponseTime ? (selectedWebsite.performance.serverResponseTime / 1000).toFixed(2) + 's' : 'N/A'}
                </div>
                <div className="text-[10px] text-green-600">Real Data</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge size={16} className="text-yellow-600" />
                  <span className="text-xs text-gray-500 font-medium">Database Query</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {selectedWebsite?.performance?.databaseQueryTime ? (selectedWebsite.performance.databaseQueryTime / 1000).toFixed(2) + 's' : 'N/A'}
                </div>
                <div className="text-[10px] text-green-600">Real Data</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-purple-600" />
                  <span className="text-xs text-gray-500 font-medium">Memory Usage</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {selectedWebsite?.performance?.memoryUsage || 'N/A'}MB
                </div>
                <div className="text-[10px] text-green-600">Real Data</div>
              </div>
            </div>

            {/* Additional Performance Metrics */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Gauge size={18} className="text-blue-600" />
                Additional Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">CPU Usage</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.performance?.cpuUsage || 'N/A'}%</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Memory Peak</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.performance?.memoryPeak || 'N/A'}MB</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Performance Score</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.performance?.performanceScore || 'N/A'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Active Plugins</div>
                  <div className="text-lg font-bold text-gray-900">{selectedWebsite?.performance?.activePlugins || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Response Time Chart - Enhanced Interactive */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Response Time (24h)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={[
                  { time: '00:00', response: selectedWebsite?.performance?.loadTime || 0 },
                  { time: '04:00', response: (selectedWebsite?.performance?.loadTime || 0) + Math.random() * 0.2 },
                  { time: '08:00', response: (selectedWebsite?.performance?.loadTime || 0) + Math.random() * 0.3 },
                  { time: '12:00', response: (selectedWebsite?.performance?.loadTime || 0) + Math.random() * 0.4 },
                  { time: '16:00', response: (selectedWebsite?.performance?.loadTime || 0) + Math.random() * 0.3 },
                  { time: '20:00', response: (selectedWebsite?.performance?.loadTime || 0) + Math.random() * 0.2 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip formatter={(value) => `${value.toFixed(2)}ms`} />} />
                  <Line 
                    type="monotone" 
                    dataKey="response" 
                    stroke="#6366f6" 
                    strokeWidth={2.5}
                    dot={{ fill: '#6366f6', r: 4 }}
                    activeDot={{ r: 6, fill: '#4f46e5' }}
                    animationDuration={500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}


        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            {/* Security Overview */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Shield size={20} className="text-red-600" />
                Security Status
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Malware Scan</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-700">Status:</span>
                    <span className="font-bold text-green-800">{selectedWebsite?.security?.malwareScan || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-700">Vulnerability Scan:</span>
                    <span className="font-bold text-green-800">{selectedWebsite?.security?.vulnerabilityScan || 'N/A'}</span>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">SSL Certificate</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Status:</span>
                    <span className="font-bold text-blue-800">{selectedWebsite?.security?.sslStatus || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">WordPress Version:</span>
                    <span className="font-bold text-blue-800">{selectedWebsite?.security?.wordpressVersion || 'N/A'}</span>
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">Firewall</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Status:</span>
                    <span className="font-bold text-purple-800">{selectedWebsite?.security?.firewall || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Security Plugins:</span>
                    <span className="font-bold text-purple-800">{selectedWebsite?.security?.securityPlugins || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Score */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4">Security Score</h3>
              <div className="flex items-center justify-center">
                <div className="text-6xl font-bold text-green-600">{selectedWebsite?.security?.securityScore || 'N/A'}</div>
                <div className="ml-4">
                  <div className="text-lg font-semibold text-gray-800">Out of 100</div>
                  <div className="text-sm text-gray-600">Security Assessment</div>
                </div>
              </div>
            </div>

            {/* Security Recommendations */}
            {selectedWebsite?.security?.recommendations && selectedWebsite.security.recommendations.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-800 mb-4">Security Recommendations</h3>
                <div className="space-y-3">
                  {selectedWebsite.security.recommendations.map((recommendation, index) => (
                    <div key={index} className="p-3 bg-yellow-50 rounded-lg">
                      <div className="font-semibold text-yellow-800">{recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEO Tab */}
        {activeTab === 'seo' && (
          <div className="space-y-4">
            {/* SEO Overview */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Search size={20} className="text-green-600" />
                SEO Performance
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{selectedWebsite?.seo?.score || 'N/A'}</div>
                  <div className="text-sm text-gray-600">SEO Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{selectedWebsite?.seo?.altTags || 'N/A'}%</div>
                  <div className="text-sm text-gray-600">Alt Tags</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{selectedWebsite?.seo?.internalLinks || 'N/A'}</div>
                  <div className="text-sm text-gray-600">Internal Links</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{selectedWebsite?.seo?.totalContent || 'N/A'}</div>
                  <div className="text-sm text-gray-600">Total Content</div>
                </div>
              </div>
              
              {/* Additional SEO Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <div className="bg-white rounded-xl shadow-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">SSL Status</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${selectedWebsite?.seo?.sslEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-bold">{selectedWebsite?.seo?.sslEnabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Meta Tags</h4>
                  <span className="font-bold">{selectedWebsite?.seo?.metaTags || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* SEO Issues */}
            {selectedWebsite?.seo?.seoIssues && selectedWebsite.seo.seoIssues.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-800 mb-4">SEO Issues</h3>
                <div className="space-y-3">
                  {selectedWebsite.seo.seoIssues.map((issue, index) => (
                    <div key={index} className="p-3 bg-red-50 rounded-lg">
                      <div className="font-semibold text-red-800">{issue}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEO Recommendations */}
            {selectedWebsite?.seo?.recommendations && selectedWebsite.seo.recommendations.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-800 mb-4">SEO Recommendations</h3>
                <div className="space-y-3">
                  {selectedWebsite.seo.recommendations.map((recommendation, index) => (
                    <div key={index} className="p-3 bg-green-50 rounded-lg">
                      <div className="font-semibold text-green-800">{recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Download size={20} className="text-blue-600" />
                Generate Reports
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <button className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <div className="font-semibold text-blue-800">Performance Report</div>
                  <div className="text-sm text-blue-700">Download comprehensive performance analysis</div>
                </button>
                <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  <div className="font-semibold text-green-800">Security Report</div>
                  <div className="text-sm text-green-700">Download security assessment report</div>
                </button>
                <button className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <div className="font-semibold text-purple-800">SEO Report</div>
                  <div className="text-sm text-purple-700">Download SEO analysis and recommendations</div>
                </button>
                <button className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                  <div className="font-semibold text-orange-800">Analytics Report</div>
                  <div className="text-sm text-orange-700">Download traffic and user behavior analysis</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Bell size={20} className="text-red-600" />
                Active Alerts
              </h3>
              {/* Priority filter: All | High | Medium | Low */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { key: 'all', label: 'All', count: activeAlertsList.length },
                  { key: 'high', label: 'High', count: activeAlertsList.filter(a => a.priorityKey === 'high').length },
                  { key: 'medium', label: 'Medium', count: activeAlertsList.filter(a => a.priorityKey === 'medium').length },
                  { key: 'low', label: 'Low', count: activeAlertsList.filter(a => a.priorityKey === 'low').length }
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAlertsPriorityFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      alertsPriorityFilter === key
                        ? key === 'high' ? 'bg-red-100 text-red-800'
                        : key === 'medium' ? 'bg-yellow-100 text-yellow-800'
                        : key === 'low' ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-200 text-gray-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                    {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div
                    key={`${alert.type}-${alert.priorityKey}`}
                    data-alert-type={alert.type}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${alert.bgClass}`}
                    onClick={() => {
                      setSelectedAlert({
                        type: alert.type,
                        title: alert.title,
                        priority: alert.priority,
                        description: alert.description,
                        details: alert.details
                      });
                      setShowAlertModal(true);
                    }}
                  >
                    <div className={`font-semibold ${alert.titleClass}`}>{alert.cardLabel}</div>
                    <div className={`text-sm ${alert.descClass}`}>{alert.cardDesc}</div>
                    <div className={`text-xs mt-1 ${alert.hintClass}`}>{alert.cardHint}</div>
                  </div>
                ))}
                {/* No Alerts Message */}
                {filteredAlerts.length === 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="font-semibold text-green-800">
                      {alertsPriorityFilter === 'all' ? 'All Good!' : `No ${alertsPriorityFilter} priority alerts`}
                    </div>
                    <div className="text-sm text-green-700">
                      {alertsPriorityFilter === 'all'
                        ? 'No active alerts - Your site is running smoothly'
                        : `No ${alertsPriorityFilter} priority alerts at the moment. Try "All" to see other priorities.`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plugins/Libraries/Packages Tab - Modern sober UI */}
        {(activeTab === 'plugins' || activeTab === 'libraries' || activeTab === 'packages') && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                  <Settings size={18} className="text-indigo-600" />
                  {selectedWebsite.platform === 'nextjs' ? 'Next.js Libraries & Packages' : 
                   ['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform) ? 'PHP Composer Packages' :
                   'WordPress Plugins'}
                </h3>
              </div>
              <div className="p-5">
              {/* Summary cards - clean grid */}
              {selectedWebsite.platform === 'nextjs' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Dependencies</div>
                    <div className="text-xl font-bold text-gray-900">{advancedData?.libraries?.dependencies_count ?? advancedData?.nextjs?.libraries?.dependencies_count ?? '—'}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Dev Dependencies</div>
                    <div className="text-xl font-bold text-gray-900">{advancedData?.libraries?.devDependencies_count ?? advancedData?.nextjs?.libraries?.devDependencies_count ?? '—'}</div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Outdated</div>
                    <div className="text-xl font-bold text-amber-800">{advancedData?.libraries?.outdated_count ?? advancedData?.nextjs?.libraries?.outdated_count ?? 0}</div>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">Total</div>
                    <div className="text-xl font-bold text-indigo-800">{advancedData?.libraries?.total_libraries ?? advancedData?.nextjs?.libraries?.total_libraries ?? '—'}</div>
                  </div>
                </div>
              ) : ['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform) ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Dependencies</div>
                    <div className="text-xl font-bold text-gray-900">{advancedData?.packages?.dependencies_count ?? advancedData?.php?.packages?.dependencies_count ?? '—'}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Dev Dependencies</div>
                    <div className="text-xl font-bold text-gray-900">{advancedData?.packages?.devDependencies_count ?? advancedData?.php?.packages?.devDependencies_count ?? '—'}</div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Outdated</div>
                    <div className="text-xl font-bold text-amber-800">{advancedData?.packages?.outdated_count ?? advancedData?.php?.packages?.outdated_count ?? 0}</div>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">Total</div>
                    <div className="text-xl font-bold text-indigo-800">{advancedData?.packages?.total_packages ?? advancedData?.php?.packages?.total_packages ?? '—'}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-1">Active</div>
                    <div className="text-xl font-bold text-emerald-800">{advancedData?.plugins?.active_count ?? '—'}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Inactive</div>
                    <div className="text-xl font-bold text-gray-900">{advancedData?.plugins?.inactive_count ?? '—'}</div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Outdated</div>
                    <div className="text-xl font-bold text-amber-800">{advancedData?.plugins?.outdated_count ?? selectedWebsite?.security?.outdatedPlugins ?? '—'}</div>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">Total</div>
                    <div className="text-xl font-bold text-indigo-800">{advancedData?.plugins?.total_plugins ?? selectedWebsite?.security?.totalPlugins ?? '—'}</div>
                  </div>
                </div>
              )}

              {pluginsError && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-xl text-red-800 text-sm">
                  <div className="font-semibold mb-1">Error loading data</div>
                  <div className="mb-2 text-red-700">{pluginsError}</div>
                  <button
                    onClick={() => {
                      setPluginsError(null);
                      // Force reload by clearing the data
                      if (['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform)) {
                        setAdvancedData(prev => {
                          const newData = { ...prev };
                          delete newData.packages;
                          return newData;
                        });
                      }
                    }}
                    className="text-xs font-medium underline hover:no-underline text-red-800"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Filter row: horizontal slide (scrollable, not sticky) - no wrap */}
              {selectedWebsite.platform === 'nextjs' || ['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform) ? (
                <div className="tab-scroll-container -mx-4 px-4 mb-4">
                  <div className="flex gap-2 flex-nowrap" style={{ minWidth: 'max-content' }}>
                    {['Dependencies','Dev Dependencies','All'].map(label => (
                      <button
                        key={label}
                        onClick={() => setPluginView(label)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${pluginView===label ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="tab-scroll-container -mx-4 px-4 mb-4">
                  <div className="flex gap-2 flex-nowrap" style={{ minWidth: 'max-content' }}>
                    {['Active','Inactive','Outdated','Potentially Unused','All'].map(label => (
                      <button
                        key={label}
                        onClick={() => setPluginView(label)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${pluginView===label ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lists - clean bordered container */}
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[520px] overflow-y-auto bg-gray-50/30">
                {selectedWebsite.platform === 'nextjs' ? (
                  // Next.js Libraries display
                  (() => {
                    const libraries = advancedData?.libraries ?? advancedData?.nextjs?.libraries;
                    const allLibs = libraries?.all_libraries || [];
                    const deps = libraries?.dependencies || [];
                    const devDeps = libraries?.devDependencies || [];
                    
                    const displayList = pluginView === 'Dependencies' ? deps
                      : pluginView === 'Dev Dependencies' ? devDeps
                      : allLibs;
                    
                    return displayList.length > 0 ? displayList.map((lib, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between bg-white hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-b-0">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{lib.name} <span className="text-xs text-gray-500 font-normal">v{lib.version}</span></div>
                          <div className="text-xs text-gray-500 mt-0.5">{lib.category} • {lib.type}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-1 rounded-md font-medium ${lib.isDev ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {lib.isDev ? 'Dev' : 'Prod'}
                          </span>
                          {lib.outdated && <span className="text-xs px-2 py-1 rounded-md font-medium bg-amber-100 text-amber-700">Outdated</span>}
                        </div>
                      </div>
                    )) : (
                      <div className="p-4 text-sm text-gray-600">
                        {loading ? 'Loading libraries data...' : 'Library details will appear once fetched from Next.js.'}
                      </div>
                    );
                  })()
                ) : ['laravel', 'codeigniter', 'php'].includes(selectedWebsite.platform) ? (
                  // PHP Packages display (Laravel, CodeIgniter, Core PHP)
                  (() => {
                    // Safely get packages data
                    const packages = advancedData?.packages ?? advancedData?.php?.packages;
                    
                    // Check if packages data exists and is valid
                    if (!packages || (typeof packages === 'object' && packages.error)) {
                      return (
                        <div className="p-4 text-sm text-gray-600">
                          {loading ? 'Loading packages data...' : packages?.error ? `Error: ${packages.error}` : 'Package details will appear once fetched from PHP project.'}
                        </div>
                      );
                    }
                    
                    // Safely extract arrays
                    const allPkgs = Array.isArray(packages?.all_packages) ? packages.all_packages : [];
                    const deps = Array.isArray(packages?.dependencies) ? packages.dependencies : [];
                    const devDeps = Array.isArray(packages?.devDependencies) ? packages.devDependencies : [];
                    
                    // Determine which list to display
                    const displayList = pluginView === 'Dependencies' ? deps
                      : pluginView === 'Dev Dependencies' ? devDeps
                      : allPkgs;
                    
                    // Render list if we have data
                    if (displayList.length > 0) {
                      return displayList.map((pkg, idx) => {
                        // Validate package object
                        if (!pkg || typeof pkg !== 'object') return null;
                        
                        return (
                          <div key={pkg.name || idx} className="p-3 flex items-center justify-between border-b last:border-b-0">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">
                                {pkg.name || 'Unknown'} 
                                {pkg.version && <span className="text-xs text-gray-500"> v{pkg.version}</span>}
                              </div>
                              {(pkg.category || pkg.type) && (
                                <div className="text-xs text-gray-500">
                                  {pkg.category || ''} {pkg.category && pkg.type ? '•' : ''} {pkg.type || ''}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className={`text-xs inline-block px-2 py-1 rounded ${pkg.isDev ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {pkg.isDev ? 'Dev' : 'Production'}
                              </div>
                              {pkg.outdated && (
                                <div className="text-xs inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-700 ml-2 mt-1">
                                  Outdated
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }).filter(Boolean);
                    }
                    
                    // No data to display
                    return (
                      <div className="p-4 text-sm text-gray-600 text-center">
                        {loading ? 'Loading packages data...' : 'No packages found. Check composer.json exists and has dependencies.'}
                      </div>
                    );
                  })()
                ) : (
                  // WordPress Plugins display
                  (() => {
                    const plugins = advancedData?.plugins;
                    const allPlugins = plugins?.all_plugins || [];
                    const activePlugins = plugins?.active_plugins || [];
                    const inactivePlugins = plugins?.inactive_plugins || [];
                    const outdatedPlugins = plugins?.outdated_plugins || [];
                    const unusedPlugins = plugins?.potentially_unused_plugins || [];
                    
                    const displayList = pluginView === 'Active' ? activePlugins
                      : pluginView === 'Inactive' ? inactivePlugins
                      : pluginView === 'Outdated' ? outdatedPlugins
                      : pluginView === 'Potentially Unused' ? unusedPlugins
                      : allPlugins;
                    
                    return displayList.length > 0 ? displayList.map((p, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-800">{p.name} <span className="text-xs text-gray-500">v{p.version}</span></div>
                          <div className="text-xs text-gray-500">{p.file}</div>
                          {p.potentially_unused && (
                            <div className="text-xs text-yellow-700">Potentially unused: {p.unused_reasons.join(', ')}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`text-xs inline-block px-2 py-1 rounded ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{p.is_active ? 'Active' : 'Inactive'}</div>
                          {p.is_outdated && <div className="text-xs inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-700 ml-2">Outdated</div>}
                        </div>
                      </div>
                    )) : (
                      <div className="p-4 text-sm text-gray-600">
                        {loading ? 'Loading plugin data...' : 'Plugin details will appear once fetched from WordPress.'}
                      </div>
                    );
                  })()
                )}
              </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Zealot Floating Button */}
      <button
        onClick={() => setShowAI(!showAI)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform z-50"
      >
        <Brain size={24} />
      </button>

      {/* Zealot Panel */}
      {showAI && (
        <div className="fixed inset-x-4 bottom-24 bg-white rounded-2xl shadow-2xl max-h-96 flex flex-col z-50">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
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
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 text-gray-600 rounded-bl-none flex items-center gap-2">
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
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-gray-50"
              />
              <button
                onClick={handleAISubmit}
                disabled={aiLoading || !aiQuery.trim()}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1 px-1">
              Zealot uses this site&apos;s real data. You can ask questions or paste issues/fixes for context-specific answers.
            </p>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {showAlertModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedAlert.priority === 'High Priority' ? 'bg-red-500' :
                    selectedAlert.priority === 'Medium Priority' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}></div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedAlert.title}</h2>
                </div>
                <button
                  onClick={() => setShowAlertModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Priority Badge */}
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                selectedAlert.priority === 'High Priority' ? 'bg-red-100 text-red-800' :
                selectedAlert.priority === 'Medium Priority' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedAlert.priority}
              </div>

              {/* Description */}
              <p className="text-gray-700 mb-6">{selectedAlert.description}</p>

              {/* Details Section */}
              <div className="space-y-4">
                {/* Current Status */}
                {selectedAlert.details.currentStatus && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Current Status</h3>
                    <p className="text-gray-700">{selectedAlert.details.currentStatus}</p>
                  </div>
                )}

                {/* Impact */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Impact</h3>
                  <p className="text-gray-700">{selectedAlert.details.impact}</p>
                </div>

                {/* Recommendation */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Recommendation</h3>
                  <p className="text-gray-700">{selectedAlert.details.recommendation}</p>
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
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Here you could add functionality to mark as resolved or take action
                    setShowAlertModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Mark as Reviewed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Website Modal */}
      <EditWebsiteModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        website={selectedWebsite}
        onUpdate={(updated) => {
          // Reload page or update state
          window.location.reload();
        }}
      />
    </div>
  );
};

export default AdvancedDashboard;


