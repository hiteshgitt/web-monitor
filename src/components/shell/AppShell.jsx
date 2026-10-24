import React, { useEffect, useState } from 'react';
import { LayoutGrid, Plus, Bell, Search, BarChart3, RefreshCw, Globe, Sparkles, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import SiteList from './SiteList';
import SiteDetail from './SiteDetail';
import AddWebsiteModal from '../AddWebsiteModal';
import EditWebsiteModal from '../EditWebsiteModal';
import NotificationPanel from '../NotificationPanel';
import AlertSettingsModal from '../AlertSettingsModal';
import useNotifications from '../../hooks/useNotifications';
import { useAuth } from '../../contexts/AuthContext';
import UserMenu from './UserMenu';
import Logo from '../Logo';
import UpgradeModal from '../pro/UpgradeModal';

const RailButton = ({ icon: Icon, label, onClick, active, badge, pro }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200
      ${active ? 'bg-white text-brand-600 shadow-card' : 'text-white/75 hover:text-white hover:bg-white/15'}`}
  >
    <Icon size={19} />
    {pro && (
      <span className="absolute -top-1.5 -right-2 px-1 rounded-md bg-white text-brand-700 text-[8px] font-extrabold tracking-wider shadow-card">PRO</span>
    )}
    {badge > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bad text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-brand-500">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </button>
);

/**
 * Master-detail layout: icon rail, site list and the selected site's detail.
 * On small screens the list and detail are shown one at a time.
 */
const AppShell = ({
  websites, selectedWebsite, loading, onSelectWebsite, onClearSelection, onRefresh, onDeleteWebsite,
  onOpenAdvanced, onOpenCommandPalette, detailTab, onDetailTabChange,
}) => {
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const { notifications, unread: notificationCount, markAllRead } = useNotifications();
  const { isPro, user } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Desktop always shows a site, like a mail client; pick the first one when nothing is selected
  useEffect(() => {
    if (isDesktop && !selectedWebsite && websites.length > 0) onSelectWebsite(websites[0]);
  }, [isDesktop, selectedWebsite, websites, onSelectWebsite]);

  // Command palette / other components can still ask for the add dialog
  useEffect(() => {
    const open = () => setShowAdd(true);
    const openAlerts = () => setShowNotifications(true);
    window.addEventListener('open-add-website-modal', open);
    window.addEventListener('open-notifications', openAlerts);
    return () => {
      window.removeEventListener('open-add-website-modal', open);
      window.removeEventListener('open-notifications', openAlerts);
    };
  }, []);

  // A browser notification click opens its site: /app?site=<id> on a fresh tab, or a message to an open one
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get('site');
    if (!siteId || websites.length === 0) return;
    const site = websites.find((w) => w._id === siteId);
    if (site) onSelectWebsite(site);
    window.history.replaceState(null, '', window.location.pathname);
  }, [websites, onSelectWebsite]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      if (event.data?.type !== 'open-site') return;
      const site = websites.find((w) => w._id === event.data.siteId);
      if (site) onSelectWebsite(site);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [websites, onSelectWebsite]);

  const showDetail = Boolean(selectedWebsite);

  return (
    <div className="h-screen w-full bg-white">
      <div className="h-full w-full overflow-hidden flex">

        {/* Icon rail (desktop) */}
        <nav className="hidden lg:flex w-[76px] shrink-0 flex-col items-center py-6 gap-3 bg-linear-to-b from-brand-400 via-brand-500 to-brand-600">
          <div className="h-11 flex items-center mb-6" title="Web Monitor">
            <Logo variant="white" className="h-[17px] drop-shadow-[0_2px_6px_rgba(38,45,95,0.35)]" />
          </div>
          <RailButton icon={LayoutGrid} label="Sites" active onClick={() => onRefresh?.()} />
          <RailButton icon={Plus} label="Add site" onClick={() => setShowAdd(true)} />
          <RailButton icon={Bell} label="Alerts" badge={notificationCount} onClick={() => setShowNotifications(true)} />
          <RailButton icon={Search} label="Command palette (Ctrl+K)" onClick={onOpenCommandPalette} />
          <RailButton icon={Globe} label="Website" onClick={() => navigate('/')} />
          {selectedWebsite && <RailButton icon={BarChart3} label="Advanced analytics (Pro)" pro={!isPro} onClick={() => onOpenAdvanced(selectedWebsite)} />}
          <div className="flex-1" />
          <RailButton icon={RefreshCw} label="Reload data" onClick={() => onRefresh?.()} />
          <div className="mt-2"><UserMenu onUpgrade={() => setShowUpgrade(true)} onAlertSettings={() => setShowAlertSettings(true)} /></div>
        </nav>

        {/* Site list */}
        <section className={`${showDetail ? 'hidden' : 'flex'} lg:flex w-full lg:w-[340px] shrink-0 flex-col bg-canvas lg:border-r border-brand-100`}>
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center justify-between px-5 pt-5 bg-linear-to-r from-brand-400 to-brand-600 text-white pb-5 rounded-b-3xl shadow-card">
            <div className="flex items-center gap-2.5">
              <Logo variant="white" className="h-6" />
              <div>
                <div className="font-extrabold leading-tight">Web Monitor</div>
                <div className="text-[11px] text-white/80 font-semibold">{websites.length} sites monitored live</div>
              </div>
            </div>
            <div className="flex gap-1">
              <RailButton icon={Bell} label="Alerts" badge={notificationCount} onClick={() => setShowNotifications(true)} />
              <RailButton icon={Plus} label="Add site" onClick={() => setShowAdd(true)} />
              <UserMenu placement="below" onUpgrade={() => setShowUpgrade(true)} onAlertSettings={() => setShowAlertSettings(true)} />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <SiteList
              websites={websites}
              selectedId={selectedWebsite?._id}
              onSelect={onSelectWebsite}
              onAdd={() => setShowAdd(true)}
              loading={loading}
            />
          </div>
          {/* Free plan: keep the Pro upgrade visible but out of the way */}
          {!isPro && (
            <div className="p-4 border-t border-brand-100">
              <button
                type="button"
                onClick={() => (selectedWebsite ? onDetailTabChange('Advanced') : setShowUpgrade(true))}
                className="group w-full text-left relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white p-4 shadow-btn hover:-translate-y-0.5 transition-transform"
              >
                <span className="absolute -top-8 -right-6 w-24 h-24 rounded-full bg-white/10 group-hover:scale-125 transition-transform duration-500" />
                <span className="relative flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/80">
                  {user?.upgradeRequestedAt ? <><Clock size={12} /> Pro request pending</> : <><Sparkles size={12} /> Basic plan</>}
                </span>
                <span className="relative mt-1 flex items-center justify-between font-bold">
                  {user?.upgradeRequestedAt ? 'We’ll activate Pro soon' : 'Unlock the Advanced view'}
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>
          )}
        </section>

        {/* Detail */}
        <main className={`${showDetail ? 'flex' : 'hidden'} lg:flex flex-1 min-w-0 flex-col bg-white`}>
          {selectedWebsite ? (
            <SiteDetail
              key={selectedWebsite._id}
              site={selectedWebsite}
              tab={detailTab}
              onTabChange={onDetailTabChange}
              onBack={onClearSelection}
              onEdit={setEditing}
              onDelete={onDeleteWebsite}
              onChanged={onRefresh}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="w-20 h-20 rounded-3xl bg-brand-50 flex items-center justify-center mb-5 animate-float">
                <Globe size={36} className="text-brand-500" />
              </div>
              <h2 className="text-xl font-semibold text-ink">{loading ? 'Loading sites…' : 'Add a site to start monitoring'}</h2>
              <p className="text-ink-muted text-sm mt-1 max-w-xs">Install the monitor integration on your site, then connect it here with its URL and API key.</p>
              {!loading && <button type="button" onClick={() => setShowAdd(true)} className="btn-primary mt-6"><Plus size={14} /> Add site</button>}
            </div>
          )}
        </main>
      </div>

      <AddWebsiteModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(site) => {
          setShowAdd(false);
          onRefresh?.();
          if (site?._id) onSelectWebsite(site);
        }}
      />
      <EditWebsiteModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        website={editing}
        onUpdate={() => {
          setEditing(null);
          onRefresh?.();
        }}
      />
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onOpenItem={(n) => {
          const site = websites.find((w) => w._id === n.websiteId);
          if (site) {
            setShowNotifications(false);
            onSelectWebsite(site);
          }
        }}
        onOpenSettings={() => { setShowNotifications(false); setShowAlertSettings(true); }}
        onMarkRead={markAllRead}
      />
      {showAlertSettings && <AlertSettingsModal onClose={() => setShowAlertSettings(false)} />}
    </div>
  );
};

export default AppShell;
