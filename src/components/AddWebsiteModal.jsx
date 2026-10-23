import React, { useState } from 'react';
import { X, Globe, Info, Copy, CheckCircle2, Sparkles, Key, Eye } from 'lucide-react';
import ApiService from '../services/api';

const AddWebsiteModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    platform: 'wordpress',
    apiKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate form
      if (!formData.name || !formData.url || !formData.apiKey) {
        setError('Please fill in name, URL and API key');
        setLoading(false);
        return;
      }

      const url = formData.url.trim().replace(/\/$/, '');

      // The backend runs the same check the monitor uses, so this works for remote sites too
      const check = await ApiService.verifyWebsite({ url, platform: formData.platform, apiKey: formData.apiKey });
      if (!check.ok) {
        setError(check.message || 'Unable to connect. Check the URL, platform and API key.');
        setLoading(false);
        return;
      }

      // Add the website (use current formData; URL may have been updated from API)
      const newWebsite = await ApiService.createWebsite({ ...formData, url });
      
      // Call the callback to refresh the list
      if (onAdd) {
        onAdd(newWebsite);
      }
      
      // Close modal
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        url: '',
        platform: 'wordpress',
        apiKey: ''
      });
    } catch (err) {
      console.error('Error adding website:', err);
      let errorMessage = 'Failed to add website. Please try again.';
      
      if (err.message && err.message.includes('Failed to create website')) {
        errorMessage = 'Failed to connect to the backend. Please ensure the backend server is running on port 5000.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    // This would typically show instructions for WordPress
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 mobile-safe-bottom">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[80vh] overflow-y-auto mobile-scroll animate-slide-up sm:animate-slide-up">
        {/* Elegant Header */}
        <div className="sticky top-0 bg-linear-to-r from-gray-50 to-white z-10 flex items-center justify-between px-5 sm:px-7 py-5 border-b border-brand-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-ink">Add Website</h2>
              <p className="text-xs text-ink-muted mt-0.5">Connect a site with the monitor integration installed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 text-ink-muted hover:text-ink-soft hover:bg-brand-100 transition-all rounded-lg no-select"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-7">

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-4 bg-red-50/80 border-l-4 border-red-400 rounded-r-lg">
              <p className="text-red-700 text-sm whitespace-pre-wrap leading-relaxed">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Website Name */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">
                Website Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="My Company Website"
                className="w-full px-4 py-3.5 bg-brand-50 border border-brand-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base transition-all placeholder:text-ink-muted"
                required
              />
            </div>

            {/* Website URL */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Globe size={14} />
                Website URL
              </label>
              <input
                type="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="https://www.example.com"
                className="w-full px-4 py-3.5 bg-brand-50 border border-brand-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base transition-all placeholder:text-ink-muted"
                required
              />
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">
                Platform
              </label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                className="w-full px-4 py-3.5 bg-brand-50 border border-brand-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base transition-all"
              >
                <option value="wordpress">WordPress</option>
                <option value="nextjs">Next.js</option>
                <option value="laravel">Laravel</option>
                <option value="codeigniter">CodeIgniter</option>
                <option value="php">Core PHP</option>
              </select>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Key size={14} />
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleChange}
                  placeholder="Enter your API key"
                  className="w-full px-4 py-3.5 pr-12 bg-brand-50 border border-brand-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-mono transition-all placeholder:text-ink-muted placeholder:font-sans"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-soft transition-colors p-1.5 rounded-sm hover:bg-brand-100"
                  aria-label="Toggle visibility"
                >
                  <Eye size={18} className={showApiKey ? 'text-brand-600' : ''} />
                </button>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed mt-2">
                Find your API key in WordPress Settings → Web Monitor API, or in .env files for Laravel/Next.js. The connection is tested before the site is added.
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-3.5 border border-brand-100 rounded-xl text-ink-soft font-medium hover:bg-brand-50 active:bg-brand-100 transition-colors no-select"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-2 px-5 py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed no-select"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </span>
                ) : (
                  'Add Website'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddWebsiteModal;

