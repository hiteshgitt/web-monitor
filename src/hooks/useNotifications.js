import { useState, useEffect } from 'react';
import notificationService from '../services/notificationService';

/**
 * Custom hook for managing notifications
 * Returns notification count and alerts
 */
export const useNotifications = () => {
  const [notificationCount, setNotificationCount] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize notification service
    const init = async () => {
      const granted = await notificationService.initialize();
      setIsInitialized(granted);

      // Set initial values
      setNotificationCount(notificationService.getNotificationCount());
      setAlerts(notificationService.getAlerts());

      // Subscribe to updates
      const unsubscribe = notificationService.subscribe((data) => {
        setNotificationCount(data.count);
        setAlerts(data.alerts);
      });

      return unsubscribe;
    };

    let unsubscribe;
    init().then(unsub => {
      unsubscribe = unsub;
    });

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      notificationService.stopPeriodicCheck();
    };
  }, []);

  // Handle notification click event
  useEffect(() => {
    const handleNotificationClick = (event) => {
      const alert = event.detail;
      // You can navigate to the alert or show a modal here
      console.log('Notification clicked:', alert);
    };

    window.addEventListener('notification-clicked', handleNotificationClick);
    return () => {
      window.removeEventListener('notification-clicked', handleNotificationClick);
    };
  }, []);

  return {
    notificationCount,
    alerts,
    isInitialized,
    refreshAlerts: () => notificationService.fetchAllAlerts(),
    clearNotifications: () => notificationService.clearNotifications(),
    markAsRead: (alertId) => notificationService.markAsRead(alertId),
    markAllAsSeen: () => notificationService.markAllAsSeen(),
    getNotificationCountForWebsite: (websiteId) => notificationService.getNotificationCountForWebsite(websiteId),
    getAlertsForWebsite: (websiteId) => notificationService.getAlertsForWebsite(websiteId),
    getAlertsByWebsite: () => notificationService.getAlertsByWebsite()
  };
};

export default useNotifications;

