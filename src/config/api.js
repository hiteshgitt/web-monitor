/**
 * Centralized API Configuration
 * Use this instead of hardcoded URLs throughout the application
 */

// Use relative URL in development (via Vite proxy) or absolute URL in production
export const API_BASE_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

/**
 * Get the full API URL for an endpoint
 * @param {string} endpoint - API endpoint (e.g., '/websites', '/health')
 * @returns {string} Full API URL
 */
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

/**
 * Default fetch options for API calls
 */
export const defaultFetchOptions = {
  headers: {
    'Content-Type': 'application/json',
  },
  // Only use CORS in production (not needed with Vite proxy in dev)
  ...(import.meta.env.DEV ? {} : { mode: 'cors', credentials: 'include' })
};
