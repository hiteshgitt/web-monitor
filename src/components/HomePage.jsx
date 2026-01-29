import React, { useState, useEffect } from 'react';
import { Globe, Activity, Shield, TrendingUp, Zap, CheckCircle, AlertTriangle, ChevronRight, Plus, Search, Filter, Trash2, Edit, Bell, Home, Sparkles, Rocket, Star } from 'lucide-react';
import AddWebsiteModal from './AddWebsiteModal';
import ApiService from '../services/api';
import PlatformIcon from './PlatformIcon';
import useNotifications from '../hooks/useNotifications';
import { SkeletonWebsiteCard } from './Skeleton';
import { useToast } from '../hooks/useToast.jsx';

const HomePage = ({ websites, onSelectWebsite, onRefresh, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [mounted, setMounted] = useState(false);
  const { getAlertsByWebsite, notificationCount, getNotificationCountForWebsite } = useNotifications();
  const { success, error: showError } = useToast();
  const alertsByWebsite = getAlertsByWebsite();
  const totalNotificationCount = notificationCount;

  useEffect(() => {
    setMounted(true);
    
    // Listen for command palette events
    const handleOpenAddModal = () => {
      setShowAddModal(true);
    };
    
    window.addEventListener('open-add-website-modal', handleOpenAddModal);
    
    return () => {
      window.removeEventListener('open-add-website-modal', handleOpenAddModal);
    };
  }, []);

  const handleDelete = async (websiteId, e) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    const website = websites.find(w => w._id === websiteId);
    const websiteName = website?.name || 'Website';
    
    setDeletingId(websiteId);
    try {
      await ApiService.deleteWebsite(websiteId);
      success(`${websiteName} removed successfully`);
      // Refresh the websites list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting website:', error);
      showError(`Failed to remove ${websiteName}. Please try again.`);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'healthy': return 'Healthy';
      case 'warning': return 'Warning';
      case 'error': return 'Error';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const getPlatformIcon = (platform) => {
    return <PlatformIcon platform={platform} className="w-8 h-8" />;
  };

  const filteredWebsites = websites.filter(site => {
    const matchesSearch = site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || site.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalWebsites = websites.length;
  const healthyWebsites = websites.filter(site => site.status === 'healthy').length;
  const avgUptime = websites.reduce((acc, site) => acc + site.uptime, 0) / totalWebsites;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 pb-5 overflow-x-hidden">
      {/* Fresh Hero Header with Gradient */}
      <div className="sticky top-0 z-40 shadow-lg overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="relative flex items-center justify-between p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Rocket size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Web Monitor
                <Sparkles size={18} className="text-yellow-300 animate-pulse" />
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100 mt-0.5">Monitor all your websites</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              className="relative touch-target p-2.5 active:scale-95 hover:bg-white/20 rounded-xl transition-all text-white no-select backdrop-blur-sm"
              title={`${totalNotificationCount} notification${totalNotificationCount !== 1 ? 's' : ''}`}
              onClick={() => {
                if (alertsByWebsite.length > 0) {
                  const message = alertsByWebsite.map(group => 
                    `${group.websiteName}: ${group.alerts.length} alert${group.alerts.length !== 1 ? 's' : ''}`
                  ).join('\n');
                  alert(`Alerts by Website:\n\n${message}\n\nClick on a website to view details.`);
                } else {
                  alert('No active alerts');
                }
              }}
            >
              <Bell size={20} />
              {totalNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg animate-pulse">
                  {totalNotificationCount > 99 ? '99+' : totalNotificationCount}
                </span>
              )}
            </button>
            <div className="text-right px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 shadow-lg">
              <div className="text-xl font-bold text-white">{totalWebsites}</div>
              <div className="text-[10px] text-indigo-100 font-semibold uppercase tracking-wide">Sites</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fresh Stats Row with Glassmorphism */}
      <div className="px-4 pt-6">
        <div className="grid grid-cols-3 gap-3">
          <div className={`bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover-scale ${mounted ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-md animate-pulse"></div>
              <span className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Healthy</span>
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">{healthyWebsites}</div>
          </div>
          <div className={`bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover-scale ${mounted ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 shadow-md animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <span className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Uptime</span>
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{avgUptime.toFixed(1)}%</div>
          </div>
          <div className={`bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover-scale ${mounted ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 shadow-md animate-pulse" style={{ animationDelay: '1s' }}></div>
              <span className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Response</span>
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">267ms</div>
          </div>
        </div>
      </div>

      {/* Fresh Search and Filter */}
      <div className="px-4 pt-5 mb-5">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-xl"></div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400" size={20} />
              <input
                type="text"
                placeholder="Search websites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white/90 backdrop-blur-sm border-2 border-indigo-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all text-sm shadow-lg"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`touch-target px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all hover-scale active:scale-95 no-select shadow-md ${
                filterStatus === 'all' 
                  ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg' 
                  : 'bg-white/90 backdrop-blur-sm border-2 border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('healthy')}
              className={`touch-target px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all hover-scale active:scale-95 no-select shadow-md ${
                filterStatus === 'healthy' 
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg' 
                  : 'bg-white/90 backdrop-blur-sm border-2 border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Healthy
            </button>
            <button
              onClick={() => setFilterStatus('warning')}
              className={`touch-target px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all hover-scale active:scale-95 no-select shadow-md ${
                filterStatus === 'warning' 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg' 
                  : 'bg-white/90 backdrop-blur-sm border-2 border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Warning
            </button>
          </div>
        </div>
      </div>

      {/* Website Cards - Fresh Modern Design */}
      <div className="px-4 space-y-4 mb-10 max-w-full">
        {loading ? (
          // Skeleton loading states
          Array.from({ length: 3 }).map((_, index) => (
            <SkeletonWebsiteCard key={`skeleton-${index}`} />
          ))
        ) : filteredWebsites.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No websites found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Add your first website to get started'}
            </p>
          </div>
        ) : (
          filteredWebsites.map((site, index) => (
          <div
            key={site._id || site.id}
            onClick={() => onSelectWebsite(site)}
            className={`group bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-gray-200/50 overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-300 swipeable no-select shadow-lg hover:shadow-2xl hover:border-indigo-300 hover:-translate-y-1 hover-lift ${mounted ? 'animate-slide-up' : ''} w-full`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Card Header with Gradient Accent */}
            <div className={`h-1 ${
              site.status === 'healthy' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
              site.status === 'warning' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
              site.status === 'offline' ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
              'bg-gradient-to-r from-red-500 to-rose-500'
            }`}></div>

            <div className="p-5 w-full min-w-0 relative">
              {/* Website Header */}
              <div className="flex items-start justify-between mb-4 w-full min-w-0">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Platform Icon with Gradient Background */}
                  <div className={`p-3 rounded-xl flex-shrink-0 shadow-sm ${
                    site.status === 'healthy' ? 'bg-gradient-to-br from-emerald-50 to-green-50' :
                    site.status === 'warning' ? 'bg-gradient-to-br from-amber-50 to-yellow-50' :
                    site.status === 'offline' ? 'bg-gradient-to-br from-gray-50 to-gray-100' :
                    'bg-gradient-to-br from-red-50 to-rose-50'
                  }`}>
                    <div className="text-2xl">{getPlatformIcon(site.platform)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg truncate flex-1 min-w-0">{site.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500 truncate font-mono w-full">{site.url}</p>
                  </div>
                </div>
                {/* Status Indicator and Notification Badge */}
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {site._id && getNotificationCountForWebsite(site._id) > 0 && (
                    <div className="relative">
                      <Bell size={16} className="text-red-500" />
                      <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 shadow-lg ring-2 ring-white z-10">
                        {getNotificationCountForWebsite(site._id)}
                      </span>
                    </div>
                  )}
                  <div className={`w-3 h-3 rounded-full shadow-sm ${getStatusColor(site.status)} ring-2 ring-white`}></div>
                </div>
              </div>

              {/* Status Badge and Uptime */}
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide ${
                  site.status === 'healthy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  site.status === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  site.status === 'offline' ? 'bg-gray-50 text-gray-700 border border-gray-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {getStatusText(site.status)}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{site.uptime}</span>
                  <span className="text-sm text-gray-500 font-medium">%</span>
                </div>
              </div>

              {/* Enhanced Progress Bar */}
              <div className="mb-4">
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      site.status === 'healthy' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                      site.status === 'warning' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                      site.status === 'offline' ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                      'bg-gradient-to-r from-red-500 to-rose-500'
                    } shadow-sm`}
                    style={{ width: `${site.status === 'offline' ? 0 : site.uptime}%` }}
                  ></div>
                </div>
              </div>

              {/* Enhanced View Buttons - No Wrap */}
              <div className="flex gap-2 mb-2 min-w-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectWebsite(site, 'basic');
                  }}
                  className="flex-1 touch-target px-3 py-2.5 bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold active:bg-gray-100 hover:bg-gray-100 transition-all border border-gray-200 active:scale-95 no-select shadow-sm hover:shadow group min-w-0"
                >
                  <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                    <span>Basic</span>
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectWebsite(site, 'advanced');
                  }}
                  className="flex-1 touch-target px-3 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-semibold active:shadow-lg hover:shadow-lg transition-all active:scale-95 no-select shadow-md group min-w-0"
                >
                  <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                    <span>Advanced</span>
                    <ChevronRight size={14} className="text-white/80 group-hover:text-white group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                  </span>
                </button>
              </div>

              {/* Modern Elegant Footer */}
              <div className="flex items-center justify-between pt-2.5 mt-2">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <ChevronRight size={12} className="text-gray-300" />
                  <span className="text-[10px] font-medium">Choose view</span>
                </div>
                <button
                  onClick={(e) => handleDelete(site._id, e)}
                  className="group px-2 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all touch-target flex items-center gap-1.5"
                  title="Remove website"
                >
                  {deletingId === site._id ? (
                    <>
                      <div className="animate-spin w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full"></div>
                      <span className="text-[10px] font-medium text-red-500">Removing</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 text-red-500 whitespace-nowrap">Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))
        )}
      </div>

      {/* Fresh Add Website Button */}
      <div className="flex justify-center mb-20 sm:mb-0">
        <button 
          onClick={() => setShowAddModal(true)}
          className="touch-target bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white px-8 sm:px-10 py-4 sm:py-4.5 rounded-2xl shadow-xl hover:shadow-2xl active:shadow-xl transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 hover:scale-105 font-bold text-sm sm:text-base group no-select relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          <Plus size={22} className="sm:w-6 sm:h-6 group-active:rotate-90 transition-transform duration-300 relative z-10" />
          <span className="relative z-10">Add Website</span>
          <Star size={16} className="text-yellow-300 animate-pulse relative z-10" />
        </button>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="bottom-nav sm:hidden">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex flex-col items-center gap-1 p-2 touch-target text-gray-600 active:text-blue-600 transition-colors"
          >
            <Home size={20} />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex flex-col items-center gap-1 p-2 touch-target text-gray-600 active:text-blue-600 transition-colors"
          >
            <Plus size={20} />
            <span className="text-xs font-medium">Add</span>
          </button>
          <button
            onClick={() => {
              if (alertsByWebsite.length > 0) {
                const message = alertsByWebsite.map(group => 
                  `${group.websiteName}: ${group.alerts.length} alert${group.alerts.length !== 1 ? 's' : ''}`
                ).join('\n');
                alert(`Alerts by Website:\n\n${message}\n\nClick on a website to view details.`);
              } else {
                alert('No active alerts');
              }
            }}
            className="relative flex flex-col items-center gap-1 p-2 touch-target text-gray-600 active:text-blue-600 transition-colors"
          >
            <Bell size={20} />
            {totalNotificationCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                {totalNotificationCount > 9 ? '9+' : totalNotificationCount}
              </span>
            )}
            <span className="text-xs font-medium">Alerts</span>
          </button>
        </div>
      </div>

      {/* Add Website Modal */}
      <AddWebsiteModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={() => {
          setShowAddModal(false);
          // Call the refresh callback
          if (onRefresh) {
            onRefresh();
          } else {
            window.location.reload();
          }
        }}
      />

    </div>
  );
};

export default HomePage;
