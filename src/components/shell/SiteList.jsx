import React, { useState } from 'react';
import { Search, SlidersHorizontal, Plus, Globe } from 'lucide-react';
import PlatformIcon from '../PlatformIcon';
import {
  healthScore, scoreTone, statusTone, TONE, STATUS_LABEL, formatMs, timeAgo, displayUrl, platformLabel,
} from '../../utils/siteMetrics';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'warning', label: 'Warning' },
  { id: 'down', label: 'Down' },
];

const matchesFilter = (site, filter) => {
  if (filter === 'all') return true;
  if (filter === 'down') return site.status === 'error' || site.status === 'offline';
  return site.status === filter;
};

const SiteCard = ({ site, selected, onSelect, index }) => {
  const isDown = site.status === 'error' || site.status === 'offline';
  const score = healthScore(site);
  const tone = TONE[isDown ? 'bad' : scoreTone(score)];

  return (
    <button
      type="button"
      onClick={() => onSelect(site)}
      style={{ animationDelay: `${index * 60}ms` }}
      className={`group relative w-full text-left rounded-2xl px-4 pt-3.5 pb-3 transition-all duration-300 animate-slide-up
        ${selected
          ? 'bg-white shadow-card-hover scale-[1.02]'
          : 'bg-white/60 hover:bg-white shadow-xs hover:shadow-card hover:-translate-y-0.5'}`}
    >
      {selected && <span className="absolute -left-1 top-4 bottom-4 w-1.5 rounded-full bg-linear-to-b from-brand-400 to-brand-600" />}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 max-w-full mb-1.5 px-1.5 py-0.5 rounded-md bg-brand-50">
            <PlatformIcon platform={site.platform} className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-soft truncate">{platformLabel(site.platform)}</span>
          </div>
          <div className="text-[11px] font-semibold text-ink-muted truncate">{displayUrl(site.url)}</div>
          <div className="text-[15px] font-bold text-ink truncate">{site.name}</div>
        </div>
        <span className={`text-xl font-extrabold tabular-nums ${tone.text}`}>
          {isDown ? '!' : score ?? '--'}
        </span>
      </div>

      <div className="mt-3 pt-2.5 border-t border-brand-100 flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-1.5 text-ink-muted font-semibold">
          <span className={`w-1.5 h-1.5 rounded-full ${TONE[statusTone(site.status)].dot} ${site.status === 'healthy' ? 'animate-pulse' : ''}`} />
          {STATUS_LABEL[site.status] || 'Unknown'}
          <span className="text-ink-faint">•</span>
          {timeAgo(site.lastChecked)}
        </span>
        <span className="font-bold text-ink tabular-nums">{isDown ? '--' : formatMs(site.responseTime)}</span>
      </div>
    </button>
  );
};

const SiteList = ({ websites, selectedId, onSelect, onAdd, loading }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const term = search.trim().toLowerCase();
  const visible = websites.filter((site) =>
    matchesFilter(site, filter) &&
    (!term || site.name.toLowerCase().includes(term) || site.url.toLowerCase().includes(term))
  );

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-5 pt-6">
        <div className="flex items-center gap-2 bg-brand-100/80 rounded-2xl pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-brand-300 transition-all">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sites…"
            className="flex-1 min-w-0 bg-transparent text-sm font-bold text-ink placeholder:text-ink-muted placeholder:font-semibold focus:outline-hidden"
          />
          <Search size={16} className="text-brand-600 shrink-0" />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0
              ${showFilters || filter !== 'all' ? 'bg-brand-600 text-white shadow-btn' : 'bg-white text-brand-600 shadow-card hover:shadow-card-hover'}`}
            aria-label="Filter sites"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-1.5 mt-3 animate-fade-in">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all
                  ${filter === f.id ? 'bg-brand-600 text-white shadow-btn' : 'bg-white/70 text-ink-soft hover:bg-white'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 mb-3">
          <span className="label-caps">{visible.length} of {websites.length} sites</span>
          <button type="button" onClick={onAdd} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-600 hover:text-brand-800 transition-colors">
            <Plus size={14} /> Add site
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto soft-scroll px-5 pb-6 space-y-3">
        {loading && websites.length === 0 && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[92px] rounded-2xl bg-white/50 animate-pulse" />
        ))}
        {!loading && visible.length === 0 && (
          <div className="text-center py-14 text-ink-muted">
            <Globe size={40} className="mx-auto mb-3 text-brand-300" />
            <div className="font-bold text-ink-soft">{websites.length === 0 ? 'No sites yet' : 'No matching sites'}</div>
            {websites.length === 0 && (
              <button type="button" onClick={onAdd} className="btn-primary mt-4">Add your first site</button>
            )}
          </div>
        )}
        {visible.map((site, index) => (
          <SiteCard key={site._id} site={site} index={index} selected={site._id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};

export default SiteList;
