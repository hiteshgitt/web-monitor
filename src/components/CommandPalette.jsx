import React, { useState, useEffect, useRef } from 'react';
import { Search, Home, BarChart3, Zap, Shield, Settings, Plus, Bell, X, ArrowRight } from 'lucide-react';

const CommandPalette = ({ isOpen, onClose, onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const commands = [
    { id: 'home', label: 'Go to Home', icon: Home, action: () => onNavigate('home') },
    { id: 'add-website', label: 'Add New Website', icon: Plus, action: () => onNavigate('add-website') },
    { id: 'analytics', label: 'View Analytics', icon: BarChart3, action: () => onNavigate('analytics') },
    { id: 'performance', label: 'Performance Dashboard', icon: Zap, action: () => onNavigate('performance') },
    { id: 'security', label: 'Security Overview', icon: Shield, action: () => onNavigate('security') },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => onNavigate('settings') },
    { id: 'notifications', label: 'Notifications', icon: Bell, action: () => onNavigate('notifications') },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current && filteredCommands[selectedIndex]) {
      const selectedElement = listRef.current.children[selectedIndex];
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, filteredCommands]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-brand-100">
          <Search className="text-ink-muted" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 outline-hidden text-ink placeholder-gray-400"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-brand-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-ink-muted" />
          </button>
        </div>

        {/* Commands List */}
        <div ref={listRef} className="max-h-96 overflow-y-auto">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, index) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-brand-50 text-brand-700'
                      : 'hover:bg-brand-50 text-ink-soft'
                  }`}
                >
                  <Icon size={18} className={index === selectedIndex ? 'text-brand-600' : 'text-ink-muted'} />
                  <span className="flex-1 font-medium">{cmd.label}</span>
                  <ArrowRight size={16} className={index === selectedIndex ? 'text-brand-600' : 'text-ink-faint'} />
                </button>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-ink-muted">
              <p>No commands found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-brand-100 bg-brand-50 flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded-sm text-xs">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded-sm text-xs">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded-sm text-xs">Enter</kbd>
              <span>Select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded-sm text-xs">Esc</kbd>
            <span>Close</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
