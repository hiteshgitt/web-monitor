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
        <div className="mx-4 mt-4 rounded-2xl p-4 md:p-6 shadow-medium border-l-4 animate-slide-up bg-gradient-to-r from-orange-50 to-amber-50 border-orange-500 text-orange-800">
          <p className="text-sm md:text-base font-semibold">{error}</p>
          <p className="text-xs md:text-sm mt-2 opacity-75 font-medium">Real-time data unavailable. Showing last known state.</p>
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