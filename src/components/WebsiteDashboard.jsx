import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CustomTooltip } from './CustomTooltip';
import { 
  Zap, Shield, Search, AlertTriangle, CheckCircle, 
  ArrowLeft, ChevronDown, ChevronUp, TrendingUp, 
  TrendingDown, Image, FileCode, Lock, RefreshCw,
  Activity, Globe, Clock, Gauge, Server, Info, Settings
} from 'lucide-react';
import useNotifications from '../hooks/useNotifications';
import EditWebsiteModal from './EditWebsiteModal';

const WebsiteDashboard = ({ selectedWebsite, onBackToHome }) => {
  const [activeCategory, setActiveCategory] = useState('performance');
  const [expandedIssues, setExpandedIssues] = useState({});
  const [realTimeData, setRealTimeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { getNotificationCountForWebsite } = useNotifications();
  const notificationCount = selectedWebsite?._id ? getNotificationCountForWebsite(selectedWebsite._id) : 0;

  // Fetch data from backend API
  const fetchPlatformData = async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.DEV ? '/api' : 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/advanced/comprehensive/${selectedWebsite._id}`);
      const data = await response.json();
      setRealTimeData({ ...data, siteName: selectedWebsite.name, platform: selectedWebsite.platform });
    } catch (error) {
      console.error(`Error fetching data:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, [selectedWebsite]);

  // Calculate overall score
  const calculateOverallScore = () => {
    const perfScore = selectedWebsite.performance?.performanceScore || selectedWebsite.uptime || 85;
    const seoScore = selectedWebsite.seo?.score || 85;
    const secScore = selectedWebsite.security?.securityScore || 92;
    return Math.round((perfScore + seoScore + secScore) / 3);
  };

  const overallScore = calculateOverallScore();
  const status = overallScore >= 80 ? 'good' : overallScore >= 60 ? 'needs-fix' : 'critical';

  // Get status color
  const getStatusColor = () => {
    switch(status) {
      case 'good': return 'bg-green-500';
      case 'needs-fix': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch(status) {
      case 'good': return 'Good';
      case 'needs-fix': return 'Needs Fix';
      case 'critical': return 'Critical';
      default: return 'Unknown';
    }
  };

  // KPI Cards Data
  const kpiCards = [
    {
      id: 'speed',
      label: 'Speed',
      score: selectedWebsite.performance?.performanceScore || selectedWebsite.uptime || 85,
      icon: Zap,
      color: 'blue',
      trend: 'up'
    },
    {
      id: 'seo',
      label: 'SEO',
      score: selectedWebsite.seo?.score || 85,
      icon: Search,
      color: 'purple',
      trend: 'up'
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      score: 78, // Placeholder
      icon: CheckCircle,
      color: 'green',
      trend: 'neutral'
    },
    {
      id: 'security',
      label: 'Security',
      score: selectedWebsite.security?.securityScore || 92,
      icon: Shield,
      color: 'red',
      trend: 'up'
    }
  ];

  // Performance Metrics
  const performanceMetrics = [
    {
      label: 'Load Time',
      value: `${(selectedWebsite.performance?.loadTime || 2400) / 1000}s`,
      status: (selectedWebsite.performance?.loadTime || 2400) < 3000 ? 'good' : 'warning',
      icon: Clock
    },
    {
      label: 'LCP',
      value: `${(selectedWebsite.performance?.serverResponseTime || 1900) / 1000}s`,
      status: (selectedWebsite.performance?.serverResponseTime || 1900) < 2500 ? 'good' : 'warning',
      icon: Gauge
    },
    {
      label: 'CLS',
      value: '0.04',
      status: 'good',
      icon: Activity
    }
  ];

  // Issues Data
  const issues = [
    {
      id: 'large-images',
      icon: Image,
      title: 'Large images found',
      count: 12,
      severity: 'warning',
      description: '12 images exceed recommended size limits. Consider compressing or using WebP format.'
    },
    {
      id: 'render-blocking',
      icon: FileCode,
      title: 'Render-blocking JS',
      count: 3,
      severity: 'critical',
      description: '3 JavaScript files are blocking page rendering. Consider deferring or async loading.'
    },
    {
      id: 'ssl',
      icon: Lock,
      title: 'SSL Certificate',
      count: selectedWebsite.security?.sslStatus === 'disabled' ? 1 : 0,
      severity: selectedWebsite.security?.sslStatus === 'disabled' ? 'critical' : 'good',
      description: selectedWebsite.security?.sslStatus === 'disabled' 
        ? 'SSL certificate is disabled. Enable HTTPS for better security and SEO.'
        : 'SSL certificate is properly configured.'
    },
    {
      id: 'outdated-plugins',
      icon: AlertTriangle,
      title: 'Outdated plugins',
      count: selectedWebsite.security?.outdatedPlugins || 0,
      severity: (selectedWebsite.security?.outdatedPlugins || 0) > 0 ? 'warning' : 'good',
      description: `${selectedWebsite.security?.outdatedPlugins || 0} plugins need updates for security.`
    }
  ].filter(issue => issue.count > 0 || issue.severity === 'good');


  // Toggle issue expansion
  const toggleIssue = (id) => {
    setExpandedIssues(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'info': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'good': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Generate sparkline data (7 days)
  const getSparklineData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        day: date.getDate(),
        value: overallScore + Math.floor(Math.random() * 10) - 5
      });
    }
    return data;
  };

  const sparklineData = getSparklineData();

  return (
    <div className="min-h-screen bg-gray-50 pb-5">
      {/* Header */}
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
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded">BASIC</span>
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
              onClick={fetchPlatformData}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-target"
              title="Refresh"
            >
              <RefreshCw size={18} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-blue-700">Limited view - Essential metrics only</span>
            <button
              onClick={() => {
                // Dispatch event to switch to advanced view
                window.dispatchEvent(new CustomEvent('switch-to-advanced', {
                  detail: { websiteId: selectedWebsite._id }
                }));
              }}
              className="text-xs font-semibold text-blue-800 underline hover:no-underline touch-target"
            >
              Switch to Advanced
            </button>
          </div>
        </div>
      </div>

      {/* 🟢 Top Summary Section (Hero Area) */}
      <div className={`px-4 pt-6 pb-8 ${status === 'good' ? 'bg-green-50' : status === 'needs-fix' ? 'bg-yellow-50' : 'bg-red-50'}`}>
        <div className="text-center">
          {/* Site URL */}
          <div className="text-sm text-gray-600 mb-3">{selectedWebsite.url}</div>
          
          {/* Overall Score Circle */}
          <div className="flex items-center justify-center mb-3">
            <div className={`relative w-32 h-32 rounded-full ${getStatusColor()} flex items-center justify-center shadow-lg`}>
              <div className="text-white text-4xl font-bold">{overallScore}</div>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-sm border border-gray-200">
            <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor()}`}></div>
            <span className="text-sm font-semibold text-gray-900">{getStatusText()}</span>
          </div>
        </div>
      </div>

      {/* 📊 KPI Card Row (Scrollable) */}
      <div className="px-4 -mt-4 mb-6">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            const colorClasses = {
              blue: 'bg-blue-50 border-blue-200 text-blue-700',
              purple: 'bg-purple-50 border-purple-200 text-purple-700',
              green: 'bg-green-50 border-green-200 text-green-700',
              red: 'bg-red-50 border-red-200 text-red-700'
            };
            
            return (
              <div 
                key={card.id}
                className={`flex-shrink-0 w-28 rounded-xl border-2 p-4 ${colorClasses[card.color]}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon size={18} />
                  {card.trend === 'up' && <TrendingUp size={14} />}
                  {card.trend === 'down' && <TrendingDown size={14} />}
                </div>
                <div className="text-2xl font-bold mb-1">{card.score}</div>
                <div className="text-xs font-medium opacity-75">{card.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Server Info (downtime, uptime – disk/bandwidth when backend has integration) */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Server size={18} className="text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Server Info</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-0.5">Downtime 24h</div>
                <div className="text-lg font-bold text-gray-900">
                  {realTimeData?.serverInfo?.downtimeHours?.last24h != null ? `${realTimeData.serverInfo.downtimeHours.last24h}h` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-0.5">Downtime 7d</div>
                <div className="text-lg font-bold text-gray-900">
                  {realTimeData?.serverInfo?.downtimeHours?.last7d != null ? `${realTimeData.serverInfo.downtimeHours.last7d}h` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-0.5">Downtime 30d</div>
                <div className="text-lg font-bold text-gray-900">
                  {realTimeData?.serverInfo?.downtimeHours?.last30d != null ? `${realTimeData.serverInfo.downtimeHours.last30d}h` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-0.5">Uptime</div>
                <div className="text-lg font-bold text-green-700">
                  {realTimeData?.serverInfo?.uptimePercent != null ? `${realTimeData.serverInfo.uptimePercent}%` : selectedWebsite?.uptime != null ? `${selectedWebsite.uptime}%` : '—'}
                </div>
              </div>
            </div>
            {realTimeData?.serverInfo?.serverResourcesMessage && (
              <p className="text-xs text-gray-500 mt-3 flex items-start gap-2">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                {realTimeData.serverInfo.serverResourcesMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 📉 Performance Breakdown Section */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Performance Breakdown</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {performanceMetrics.map((metric, idx) => {
              const Icon = metric.icon;
              const statusColor = metric.status === 'good' ? 'bg-green-500' : 'bg-yellow-500';
              
              return (
                <div key={idx} className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                    <Icon size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-700 font-medium">{metric.label}</span>
                  </div>
                  <span className="text-base font-bold text-gray-900">{metric.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Basic View - Limited Content */}
      <div className="px-4 pt-6">
        {/* 🛠 Critical Issues Only (Basic View) */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Critical Issues</h2>
          <div className="space-y-3">
            {issues.filter(issue => issue.severity === 'critical').map((issue) => {
              const Icon = issue.icon;
              
              return (
                <div 
                  key={issue.id}
                  className={`bg-white rounded-xl border-2 ${getSeverityColor(issue.severity)}`}
                >
                  <div className="px-4 py-4 flex items-center gap-3">
                    <Icon size={20} />
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">{issue.title}</div>
                      <div className="text-xs opacity-75">
                        {issue.count} {issue.count === 1 ? 'issue' : 'issues'}
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-md text-xs font-bold uppercase bg-red-200 text-red-800">
                      Critical
                    </span>
                  </div>
                </div>
              );
            })}
            {issues.filter(issue => issue.severity === 'critical').length === 0 && (
              <div className="bg-green-50 rounded-xl border-2 border-green-200 p-4 text-center">
                <CheckCircle size={24} className="mx-auto mb-2 text-green-600" />
                <p className="text-sm font-medium text-green-700">No critical issues found</p>
              </div>
            )}
          </div>
        </div>

        {/* Upgrade to Advanced Notice */}
        <div className="mb-6">
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Want More Details?</h3>
                <p className="text-xs text-blue-700 mb-3">
                  Switch to Advanced View for detailed analytics, reports, plugins, fix actions, and more premium features.
                </p>
                <button
                  onClick={() => {
                    // Dispatch event to switch to advanced view
                    window.dispatchEvent(new CustomEvent('switch-to-advanced', {
                      detail: { websiteId: selectedWebsite._id }
                    }));
                  }}
                  className="text-xs font-medium text-blue-800 underline hover:no-underline touch-target"
                >
                  Switch to Advanced View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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

export default WebsiteDashboard;