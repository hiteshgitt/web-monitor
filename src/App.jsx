import React, { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import WebsiteDashboard from './components/WebsiteDashboard';
import AdvancedDashboard from './components/AdvancedDashboard';
import ApiService from './services/api';
import notificationService from './services/notificationService';
import { useToast } from './hooks/useToast.jsx';
import CommandPalette from './components/CommandPalette';

const WebMonitorDashboard = () => {
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardMode, setDashboardMode] = useState('basic'); // 'basic' or 'advanced'
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { ToastContainer, success, error: showError } = useToast();

  // Register service worker and initialize notifications
  useEffect(() => {
    // Register service worker
    if (notificationService.isServiceWorkerSupported()) {
      notificationService.registerServiceWorker().then(registration => {
        if (registration) {
          console.log('Service Worker registered successfully');
        }
      });
    }

    // Initialize notification service
    notificationService.initialize().then(granted => {
      if (granted) {
        console.log('Notifications enabled');
      } else {
        console.log('Notifications not granted');
      }
    });

    // Handle notification clicks - navigate to specific website
    const handleNotificationClick = (event) => {
      const { navigateTo } = event.detail;
      if (navigateTo && navigateTo.websiteId) {
        // Find the website from the list
        const website = websites.find(w => w._id === navigateTo.websiteId);
        if (website) {
          // Navigate to the website in advanced mode (to show alerts tab)
          handleSelectWebsite(website, 'advanced');
          // The dashboard will handle switching to alerts tab
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('switch-to-alerts', {
              detail: { alertType: navigateTo.alertType }
            }));
          }, 100);
        }
      }
    };

    window.addEventListener('notification-clicked', handleNotificationClick);
    
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
      window.removeEventListener('notification-clicked', handleNotificationClick);
      window.removeEventListener('switch-to-advanced', handleSwitchToAdvanced);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [websites]);

  // Load websites from MongoDB API
  useEffect(() => {
    loadWebsites();
    
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
      } catch (err) {
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

  const loadWebsites = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First check backend health
      try {
        await ApiService.healthCheck();
      } catch (healthErr) {
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
      if (websitesData && websitesData.length > 0) {
        success(`Loaded ${websitesData.length} website${websitesData.length !== 1 ? 's' : ''}`);
      }
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
  };

  const handleSelectWebsite = (website, mode = 'basic') => {
    setSelectedWebsite(website);
    setDashboardMode(mode);
  };

  const handleBackToHome = () => {
    setSelectedWebsite(null);
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
          setDashboardMode('advanced');
          // Could dispatch event to switch to analytics tab
        }
        break;
      case 'performance':
        if (selectedWebsite) {
          setDashboardMode('advanced');
        }
        break;
      case 'security':
        if (selectedWebsite) {
          setDashboardMode('advanced');
        }
        break;
      case 'settings':
        // Open settings
        break;
      case 'notifications':
        // Open notifications
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-gray-200 border-t-gray-900 mx-auto mb-4"></div>
          </div>
          <p className="text-gray-700 font-semibold text-base">Loading websites...</p>
          <p className="text-gray-500 text-sm mt-1">Please wait</p>
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
        <div className="mx-6 mt-6 overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-rose-100 flex flex-col md:flex-row items-stretch animate-slide-up">
          <div className="bg-rose-500 w-full md:w-24 flex items-center justify-center p-6 text-white shrink-0">
             <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
               <AlertTriangle size={24} />
             </div>
          </div>
          <div className="p-6 flex-1 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em] mb-1 italic">
                {error.includes('Too many requests') || error.includes('Rate limit') ? 'Rate Limit Exceeded' : 'Monitoring Interrupted'}
              </h3>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest opacity-70">
                {error.includes('Too many requests') || error.includes('Rate limit') 
                  ? 'Request frequency too high. Backend access is temporarily restricted.'
                  : 'Backend server is unreachable. Displaying last known cached state.'}
              </p>
            </div>
            <button 
              onClick={loadWebsites}
              className="px-8 py-3 rounded-2xl bg-[#2D1BFF] text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              Retry Connection <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}
          {selectedWebsite ? (
            dashboardMode === 'advanced' ? (
              <AdvancedDashboard
                selectedWebsite={selectedWebsite}
                onBackToHome={handleBackToHome}
              />
            ) : (
              <WebsiteDashboard
                selectedWebsite={selectedWebsite}
                onBackToHome={handleBackToHome}
              />
            )
          ) : (
            <HomePage
              websites={websites}
              onSelectWebsite={handleSelectWebsite}
              onRefresh={loadWebsites}
              loading={loading}
            />
          )}
    </div>
  );
};

export default WebMonitorDashboard;