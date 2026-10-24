import React, { useState, useEffect, useCallback } from 'react';
import AppShell from './components/shell/AppShell';
import ApiService from './services/api';
import { useToast } from './hooks/useToast.jsx';
import CommandPalette from './components/CommandPalette';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const LIVE_REFRESH_MS = 30000; // backend checks each site every 60s

const WebMonitorDashboard = () => {
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Tab shown in the site detail ('Overview', ..., 'Advanced')
  const [detailTab, setDetailTab] = useState('Overview');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { ToastContainer, success, error: showError } = useToast();

  // 'advanced' opens the site's Advanced tab (Pro content, or the Pro preview for free plans)
  const handleSelectWebsite = useCallback((website, mode = 'basic') => {
    setSelectedWebsite(website);
    setDetailTab(mode === 'advanced' ? 'Advanced' : 'Overview');
  }, []);

  // The service worker shows push alerts while the dashboard is closed (see AlertSettingsModal)
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }, []);

  useEffect(() => {
    // Handle switch to advanced view from basic view
    const handleSwitchToAdvanced = (event) => {
      const { websiteId } = event.detail;
      if (websiteId) {
        const website = websites.find(w => w._id === websiteId);
        if (website) {
          handleSelectWebsite(website, 'advanced');
        }
      }
    };
    
    window.addEventListener('switch-to-advanced', handleSwitchToAdvanced);
    
    // Command Palette (⌘K / Ctrl+K)
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('switch-to-advanced', handleSwitchToAdvanced);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [websites, handleSelectWebsite]);

  // Load websites from MongoDB API
  useEffect(() => {
    loadWebsites({ initial: true });
    
    // Check backend health periodically
    const healthCheckInterval = setInterval(async () => {
      try {
        await ApiService.healthCheck();
        // Backend is online, clear error if it was about backend
        setError(prevError => {
          if (prevError && prevError.includes('Backend server is offline')) {
            return null;
          }
          return prevError;
        });
      } catch {
        // Backend is offline
        const cachedWebsites = ApiService.getCachedWebsites();
        if (cachedWebsites && cachedWebsites.length > 0) {
          setError('Backend server is offline. Showing cached websites.');
        } else {
          setError('Backend server is offline. Please check if the backend is running on port 5000.');
        }
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(healthCheckInterval);
  }, []);

  // Pull the latest monitoring results in the background so the open view stays live
  useEffect(() => {
    const liveRefreshInterval = setInterval(async () => {
      try {
        const websitesData = (await ApiService.getWebsites()) || [];
        setWebsites(websitesData);
        setSelectedWebsite(prev => (prev ? websitesData.find(w => w._id === prev._id) || prev : prev));
      } catch {
        // Backend outages are reported by the health-check interval above
      }
    }, LIVE_REFRESH_MS);

    return () => clearInterval(liveRefreshInterval);
  }, []);

  // The first load shows the loading screen; later refreshes update in place
  async function loadWebsites({ initial = false } = {}) {
    try {
      if (initial) setLoading(true);
      setError(null);
      
      // First check backend health
      try {
        await ApiService.healthCheck();
      } catch {
        // Backend is offline, use cache
        const cachedWebsites = ApiService.getCachedWebsites();
        if (cachedWebsites && cachedWebsites.length > 0) {
          const offlineWebsites = ApiService.markWebsitesAsOffline(cachedWebsites);
          setWebsites(offlineWebsites);
          setError('Backend server is offline. Showing cached websites.');
        } else {
          setError('Backend server is offline. Please check if the backend is running on port 5000.');
          setWebsites([]);
        }
        setLoading(false);
        return;
      }
      
      const websitesData = await ApiService.getWebsites();
      
      // Backend is online, clear any backend-related errors
      // Individual website status is shown on cards, no need for banner
      setError(null);
      
      setWebsites(websitesData || []);
      setSelectedWebsite(prev => (prev ? (websitesData || []).find(w => w._id === prev._id) || null : prev));
    } catch (err) {
      // Try to get cached websites
      const cachedWebsites = ApiService.getCachedWebsites();
      if (cachedWebsites && cachedWebsites.length > 0) {
        const offlineWebsites = ApiService.markWebsitesAsOffline(cachedWebsites);
        setWebsites(offlineWebsites);
        setError('Backend server is offline. Showing cached websites.');
      } else {
        setError(`Backend connection failed: ${err.message}. Please check if the backend is running on port 5000.`);
        setWebsites([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleBackToHome = () => {
    setSelectedWebsite(null);
    setDetailTab('Overview');
  };

  const handleDeleteWebsite = async (website) => {
    try {
      await ApiService.deleteWebsite(website._id);
      setSelectedWebsite(null);
      success(`${website.name} removed`);
      await loadWebsites();
    } catch (err) {
      console.error('Error deleting website:', err);
      showError(`Failed to remove ${website.name}. Please try again.`);
    }
  };

  const handleCommandPaletteNavigate = (command) => {
    switch (command) {
      case 'home':
        handleBackToHome();
        break;
      case 'add-website':
        // Trigger add website modal
        window.dispatchEvent(new CustomEvent('open-add-website-modal'));
        break;
      case 'analytics':
        if (selectedWebsite) {
          setDetailTab('Advanced');
        }
        break;
      case 'performance':
        if (selectedWebsite) {
          setDetailTab('Advanced');
        }
        break;
      case 'security':
        if (selectedWebsite) {
          setDetailTab('Advanced');
        }
        break;
      case 'settings':
        // Open settings
        break;
      case 'notifications':
        window.dispatchEvent(new CustomEvent('open-notifications'));
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-card px-12 py-10 text-center animate-fade-in">
          <div className="w-12 h-12 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-ink font-bold">Loading your sites…</p>
          <p className="text-ink-muted text-sm mt-1">Fetching the latest checks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ToastContainer />
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={handleCommandPaletteNavigate}
      />
      {error && error.includes('Backend server') && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl bg-white rounded-2xl shadow-frame border border-bad-soft flex items-center gap-4 p-3 pl-4 animate-slide-up">
          <div className="w-10 h-10 rounded-xl bg-bad-soft text-bad flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink">
              {error.includes('Too many requests') || error.includes('Rate limit') ? 'Rate limit exceeded' : 'Monitoring interrupted'}
            </div>
            <div className="text-xs text-ink-muted">
              {error.includes('Too many requests') || error.includes('Rate limit')
                ? 'Too many requests. Backend access is temporarily restricted.'
                : 'Backend unreachable. Showing the last known state.'}
            </div>
          </div>
          <button type="button" onClick={() => loadWebsites()} className="btn-primary h-9! px-4! shrink-0">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}
        <AppShell
          websites={websites}
          selectedWebsite={selectedWebsite}
          loading={loading}
          onSelectWebsite={handleSelectWebsite}
          onClearSelection={handleBackToHome}
          onRefresh={loadWebsites}
          onDeleteWebsite={handleDeleteWebsite}
          onOpenAdvanced={(website) => handleSelectWebsite(website, 'advanced')}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          detailTab={detailTab}
          onDetailTabChange={setDetailTab}
        />
    </div>
  );
};

export default WebMonitorDashboard;