import React, { useState, useEffect } from 'react';
import { Globe, Activity, Shield, TrendingUp, Zap, CheckCircle, AlertTriangle, ChevronRight, Plus, Search, Filter, Trash2, Edit, Bell, Home, Sparkles, Rocket, Star, Settings, ChevronDown } from 'lucide-react';
import AddWebsiteModal from './AddWebsiteModal';
import EditWebsiteModal from './EditWebsiteModal';
import NotificationPanel from './NotificationPanel';
import ApiService from '../services/api';
import PlatformIcon from './PlatformIcon';
import useNotifications from '../hooks/useNotifications';
import { SkeletonWebsiteCard } from './Skeleton';
import { useToast } from '../hooks/useToast.jsx';

const HomePage = ({ websites, onSelectWebsite, onRefresh, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState(null);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [mounted, setMounted] = useState(false);
  const { getAlertsByWebsite, notificationCount, getNotificationCountForWebsite, markAllAsSeen } = useNotifications();
  const { success, error: showError } = useToast();
  const alertsByWebsite = getAlertsByWebsite();
  const totalNotificationCount = notificationCount;

  const handleNotificationSelectWebsite = (websiteId) => {
    const website = websites.find(w => w._id === websiteId);
    if (website) onSelectWebsite(website, 'advanced');
  };

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

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24 overflow-x-hidden relative">
      {/* 🟦 Vibrant Redesigned Header (UpTower Style) */}
      <div className="bg-[#2D1BFF] pt-12 pb-24 px-6 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden">
        {/* Abstract background circles */}
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-100px] left-[-50px] w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-auto">
                <img src="/icons/webmonitorlogo.png" alt="Web Monitor" className="h-full w-auto object-contain" />
              </div>
              <div className="h-6 w-[0.5px] bg-white/30 mx-1"></div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/80 active:scale-90">
                  <Settings size={20} />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/80 active:scale-90">
                  <TrendingUp size={20} />
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowNotificationPanel(true)}
              className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 active:scale-90 transition-all text-white relative shadow-lg"
            >
              <Bell size={22} />
              {totalNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ring-4 ring-[#2D1BFF] shadow-sm">
                  {totalNotificationCount > 9 ? '9+' : totalNotificationCount}
                </span>
              )}
            </button>
          </div>
          
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Welcome to Web Monitor</h1>
          <p className="text-indigo-100/80 text-sm font-medium">Professional website monitoring in your smartphone</p>
        </div>
      </div>

      {/* 📊 Summary Stats (3 Overlapping Cards) */}
      <div className="px-6 -mt-12 relative z-20">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
          {/* Healthy Card */}
          <div className="flex-1 min-w-[120px] bg-white rounded-3xl p-5 shadow-xl border border-gray-50 flex flex-col items-start gap-4 hover:translate-y-[-4px] transition-transform duration-300">
            <div className="flex items-center justify-between w-full">
              <span className="text-3xl font-black text-gray-900 leading-none">{healthyWebsites}</span>
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse"></div>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Working<br/>fine</div>
          </div>
          
          {/* Error/Offline Card */}
          <div className="flex-1 min-w-[120px] bg-white rounded-3xl p-5 shadow-xl border border-gray-50 flex flex-col items-start gap-4 hover:translate-y-[-4px] transition-transform duration-300">
            <div className="flex items-center justify-between w-full">
              <span className="text-3xl font-black text-gray-900 leading-none">{websites.filter(s => s.status === 'error' || s.status === 'offline').length}</span>
              <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"></div>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Not<br/>working</div>
          </div>
          
          {/* Warning Card */}
          <div className="flex-1 min-w-[120px] bg-white rounded-3xl p-5 shadow-xl border border-gray-50 flex flex-col items-start gap-4 hover:translate-y-[-4px] transition-transform duration-300">
            <div className="flex items-center justify-between w-full">
              <span className="text-3xl font-black text-gray-900 leading-none">{websites.filter(s => s.status === 'warning').length}</span>
              <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]"></div>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Working<br/>slower</div>
          </div>
        </div>
      </div>

      {/* 🔍 Search & List Section */}
      <div className="px-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center">
              <Star size={12} className="text-indigo-600 fill-indigo-600" />
            </div>
            <span className="text-sm font-bold text-gray-800 tracking-tight">{totalWebsites} sites</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
            <span>Sort by:</span>
            <div className="flex items-center gap-1 text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors">
              <span>All sites</span>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Search Bar - Minimalist */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-indigo-100/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#2D1BFF] transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search websites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-none rounded-2xl py-4.5 pl-14 pr-6 shadow-medium focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Website Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <SkeletonWebsiteCard key={`skeleton-${index}`} />
            ))
          ) : filteredWebsites.length === 0 ? (
            <div className="text-center py-16 col-span-full">
              <Globe className="mx-auto text-gray-200 mb-4 animate-float" size={80} />
              <h3 className="text-xl font-bold text-gray-400 mb-2">No websites found</h3>
              <p className="text-gray-400 text-sm">Add your first website to get started</p>
            </div>
          ) : (
            filteredWebsites.map((site, index) => (
              <div
                key={site._id || site.id}
                className={`group bg-white rounded-[2rem] p-6 shadow-soft border border-gray-50 overflow-hidden relative transition-all duration-300 hover:shadow-large hover:border-indigo-100 ${mounted ? 'animate-slide-up' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Status indicator bar on left */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  site.status === 'healthy' ? 'bg-emerald-500' :
                  site.status === 'warning' ? 'bg-amber-400' :
                  'bg-rose-500'
                }`}></div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${
                        site.status === 'healthy' ? 'bg-emerald-500' :
                        site.status === 'warning' ? 'bg-amber-400' :
                        'bg-rose-500'
                      }`}></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded ${
                            site.status === 'healthy' ? 'bg-emerald-50 text-emerald-600' :
                            site.status === 'warning' ? 'bg-amber-50 text-amber-600' :
                            'bg-rose-50 text-rose-600'
                          }`}>
                            {getStatusText(site.status)}
                          </div>
                        </div>
                        <h3 className="font-extrabold text-gray-900 text-base truncate tracking-tight">{site.name}</h3>
                        <p className="text-[10px] font-medium text-gray-400 truncate">{site.url.replace(/^https?:\/\//, '')}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-0.5">MS</div>
                      <div className="text-lg font-black text-gray-900 tracking-tighter">{site.responseTime || '--'}</div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-50">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onSelectWebsite(site, 'basic')}
                        className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-[9px] font-black tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-95"
                      >
                        BASIC
                      </button>
                      <button 
                        onClick={() => onSelectWebsite(site, 'advanced')}
                        className="px-3 py-1.5 bg-[#2D1BFF] text-white rounded-lg text-[9px] font-black tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all"
                      >
                        ADVANCED
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setEditingWebsite(site)}
                        className="p-2 text-gray-400 hover:text-[#2D1BFF] hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                        title="Edit Settings"
                      >
                        <Settings size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(site._id, e)}
                        className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                        title="Delete Site"
                      >
                        {deletingId === site._id ? (
                          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ➕ Redesigned FAB */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-10 right-8 w-16 h-16 bg-[#2D1BFF] text-white rounded-full shadow-[0_15px_35px_rgba(45,27,255,0.4)] flex items-center justify-center hover:scale-110 hover:-rotate-12 active:scale-95 transition-all duration-300 z-50 group border-4 border-white/20"
      >
        <Plus size={32} strokeWidth={3} className="group-hover:rotate-180 transition-transform duration-700" />
      </button>

      {/* Add Website Modal */}
      <AddWebsiteModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={() => {
          setShowAddModal(false);
          if (onRefresh) onRefresh();
          else window.location.reload();
        }}
      />

      {/* Edit Website Modal */}
      <EditWebsiteModal
        isOpen={!!editingWebsite}
        onClose={() => setEditingWebsite(null)}
        website={editingWebsite}
        onUpdate={() => {
          setEditingWebsite(null);
          if (onRefresh) onRefresh();
          else window.location.reload();
        }}
      />

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotificationPanel}
        onClose={() => setShowNotificationPanel(false)}
        alertsByWebsite={alertsByWebsite}
        onSelectWebsiteId={handleNotificationSelectWebsite}
        onMarkSeen={markAllAsSeen}
      />
    </div>
  );
};

export default HomePage;
