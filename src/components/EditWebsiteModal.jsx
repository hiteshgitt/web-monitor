import React, { useState, useEffect } from 'react';
import { X, Settings, Info } from 'lucide-react';
import ApiService from '../services/api';

const EditWebsiteModal = ({ isOpen, onClose, website, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    platform: 'wordpress',
    apiKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (website && isOpen) {
      setFormData({
        name: website.name || '',
        url: website.url || '',
        platform: website.platform || 'wordpress',
        apiKey: '' // the real key never reaches the browser; blank keeps the stored one
      });
      setError('');
      setSuccess('');
    }
  }, [website, isOpen]);

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
    setSuccess('');
    setLoading(true);

    try {
      if (!formData.name || !formData.url) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      // Test the connection server-side with the new values (stored key if left blank)
      const check = await ApiService.verifyWebsite({
        url: formData.url,
        platform: formData.platform,
        apiKey: formData.apiKey,
        websiteId: website._id
      });
      if (!check.ok) {
        setError(check.message || 'Connection failed. Check URL and API key.');
        setLoading(false);
        return;
      }

      // Update website
      const updated = await ApiService.updateWebsite(website._id, formData);
      
      setSuccess('Website updated successfully!');
      setTimeout(() => {
        if (onUpdate) onUpdate(updated);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error updating website:', err);
      setError(err.message || 'Failed to update website. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !website) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 mobile-safe-bottom">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mobile-scroll animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 sm:p-6 border-b border-brand-100">
          <div className="flex items-center gap-3">
            <Settings size={24} className="text-brand-600" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">Edit Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 text-ink-muted active:text-ink-soft hover:text-ink-soft transition-colors rounded-lg active:bg-brand-100 no-select"
          >
            <X size={22} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Website Name */}
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-2">
                Website Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="My Website"
                className="w-full px-4 py-3.5 touch-target border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-base"
                required
              />
            </div>

            {/* Website URL */}
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-2">
                Website URL *
              </label>
              <input
                type="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="https://mysite.com"
                className="w-full px-4 py-3.5 touch-target border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-base"
                required
              />
            </div>

            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-2">
                Platform *
              </label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                className="w-full px-4 py-3.5 touch-target border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-base bg-white"
                required
              >
                <option value="wordpress">WordPress</option>
                <option value="nextjs">Next.js</option>
                <option value="laravel">Laravel</option>
                <option value="codeigniter">CodeIgniter</option>
                <option value="php">PHP (generic)</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-2">
                API Key
              </label>
              <input
                type="password"
                name="apiKey"
                value={formData.apiKey}
                onChange={handleChange}
                placeholder={website.apiKeyLast4 ? `Current key ends in ${website.apiKeyLast4}` : 'Enter your API key'}
                autoComplete="off"
                className="w-full px-4 py-3.5 touch-target border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm font-mono"
              />
              <p className="text-xs text-ink-muted mt-1">
                Leave blank to keep the current key. The connection will be tested before saving.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3.5 bg-brand-100 text-ink-soft rounded-xl font-semibold hover:bg-gray-200 transition-colors touch-target"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-2 px-4 py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed no-select"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditWebsiteModal;
