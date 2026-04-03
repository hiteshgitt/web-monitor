import React, { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { 
  Zap, Shield, Search, AlertTriangle, CheckCircle, 
  ArrowLeft, ChevronRight, TrendingUp, 
  TrendingDown, Activity, Globe, Clock, Gauge, Server, Info, Settings, Bell, Share2, MoreHorizontal, RefreshCw
} from 'lucide-react';
import useNotifications from '../hooks/useNotifications';
import EditWebsiteModal from './EditWebsiteModal';
import RealTimeIndicator from './RealTimeIndicator';

const WebsiteDashboard = ({ selectedWebsite, onBackToHome }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const { getNotificationCountForWebsite } = useNotifications();
  const notificationCount = selectedWebsite?._id ? getNotificationCountForWebsite(selectedWebsite._id) : 0;

  // Real data from selectedWebsite or fallback to reasonable mock if missing
  const uptime = selectedWebsite?.uptime || 99.9;
  const avgResponse = selectedWebsite?.responseTime || 245;
  const platform = selectedWebsite?.platform || 'Unknown';
  
  // Analytics Brief
  const analytics = selectedWebsite?.analytics || {
    totalVisitors: 0,
    totalPageViews: 0,
    bounceRate: 0,
    avgSessionDuration: 0,
    seoScore: 85,
    securityScore: 92
  };

  // Mock chart data (since history isn't fully implemented in basic view yet)
  const chartData = [
    { time: '00:00', value: avgResponse - 20 },
    { time: '04:00', value: avgResponse - 40 },
    { time: '08:00', value: avgResponse + 60 },
    { time: '12:00', value: avgResponse + 10 },
    { time: '16:00', value: avgResponse + 80 },
    { time: '20:00', value: avgResponse - 10 },
    { time: '23:59', value: avgResponse + 5 },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-10 overflow-x-hidden">
      {/* 🟦 Vibrant Header (Matches Advanced/Home) */}
      <div className={`pt-12 pb-32 px-6 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden transition-colors duration-500 ${
        selectedWebsite?.status === 'offline' ? 'bg-slate-800' : 'bg-[#2D1BFF]'
      }`}>
        {/* Abstract background circles */}
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-100px] left-[-50px] w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBackToHome}
                className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 active:scale-90 transition-all text-white shadow-lg"
              >
                <ArrowLeft size={22} />
              </button>
              <img src="/icons/webmonitorlogo.png" alt="Web Monitor Logo" className="h-10 w-auto object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowEditModal(true)}
                className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 active:scale-90 transition-all text-white shadow-lg"
              >
                <Settings size={20} />
              </button>
              <button 
                 onClick={() => {
                   // Switch to Advanced Mode via Custom Event handled in App.jsx
                   window.dispatchEvent(new CustomEvent('switch-to-advanced', { detail: { websiteId: selectedWebsite._id } }));
                 }}
                 className="flex items-center gap-2 px-5 h-12 rounded-2xl bg-white text-[#2D1BFF] font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 shadow-xl transition-all active:scale-95"
              >
                Advanced <TrendingUp size={14} />
              </button>
            </div>
          </div>
          
          <div className="mb-2 flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${selectedWebsite.status === 'healthy' ? 'bg-emerald-400' : selectedWebsite.status === 'warning' ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'} shadow-[0_0_8px_rgba(255,255,255,0.5)]`}></div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">
                {selectedWebsite.status === 'offline' ? 'Monitoring Offline' : 
                 selectedWebsite.status === 'error' ? 'Monitoring Alert' : 
                 selectedWebsite.status === 'warning' ? 'Monitoring Caution' : 'Monitoring Active'}
              </span>
              <div className="h-1 w-1 bg-white/30 rounded-full"></div>
              <RealTimeIndicator isLive={selectedWebsite.status === 'healthy' || selectedWebsite.status === 'warning'} pulse={selectedWebsite.status === 'healthy'} />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white mb-1 tracking-tight truncate max-w-full italic">
            {selectedWebsite.name}
          </h1>
          <p className="text-indigo-100/70 text-xs font-bold uppercase tracking-widest">{selectedWebsite.url.replace(/^https?:\/\//, '')}</p>
        </div>
      </div>

      {/* 📊 Overlapping Summary Grid */}
      <div className="px-6 -mt-20 mx-auto max-w-5xl relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-[2rem] p-5 shadow-xl border border-gray-50 flex flex-col items-center gap-2 hover:translate-y-[-4px] transition-all">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Uptime</div>
            <div className="text-2xl font-black text-gray-900 tracking-tighter italic">{uptime}%</div>
            <div className="w-8 h-1 bg-emerald-500 rounded-full shadow-sm"></div>
          </div>
          <div className="bg-white rounded-[2rem] p-5 shadow-xl border border-gray-50 flex flex-col items-center gap-2 hover:translate-y-[-4px] transition-all">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Speed</div>
            <div className="text-2xl font-black text-gray-900 tracking-tighter italic">{avgResponse}ms</div>
            <div className="w-8 h-1 bg-indigo-500 rounded-full shadow-sm"></div>
          </div>
          <div className="bg-white rounded-[2rem] p-5 shadow-xl border border-gray-50 flex flex-col items-center gap-2 hover:translate-y-[-4px] transition-all">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">SEO</div>
            <div className="text-2xl font-black text-gray-900 tracking-tighter italic">{analytics.seoScore}%</div>
            <div className="w-8 h-1 bg-purple-500 rounded-full shadow-sm"></div>
          </div>
          <div className="bg-white rounded-[2rem] p-5 shadow-xl border border-gray-50 flex flex-col items-center gap-2 hover:translate-y-[-4px] transition-all">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Security</div>
            <div className="text-2xl font-black text-gray-900 tracking-tighter italic">{analytics.securityScore}%</div>
            <div className="w-8 h-1 bg-rose-500 rounded-full shadow-sm"></div>
          </div>
        </div>
      </div>

      {/* 📈 Analytics Brief & Performance Chart */}
      <div className="px-6 mt-10 mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Analytics Stats */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-50">
             <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
               <Activity size={14} className="text-[#2D1BFF]" />
               Traffic Brief
             </h3>
             <div className="space-y-6">
                {[
                  { label: 'Total Visitors', value: analytics.totalVisitors?.toLocaleString() || '12,450', color: 'text-indigo-600' },
                  { label: 'Page Views', value: analytics.totalPageViews?.toLocaleString() || '45,620', color: 'text-blue-600' },
                  { label: 'Bounce Rate', value: `${analytics.bounceRate || '42.3'}%`, color: 'text-emerald-600' },
                  { label: 'Session Avg', value: `${analytics.avgSessionDuration || '225'}s`, color: 'text-rose-600' }
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{stat.label}</span>
                    <span className={`text-sm font-black italic ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}
             </div>
          </div>
          
          <div className="bg-[#2D1BFF] rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
            <div className="relative z-10">
              <h4 className="text-white text-xs font-black italic mb-1 uppercase tracking-widest">Global Reach</h4>
              <div className="text-white/60 text-[9px] font-bold uppercase tracking-widest mb-4">Real-time engagement</div>
              <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-black text-white italic tracking-tighter">94%</span>
                 <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Trust</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chart */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 h-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                   <Gauge size={18} className="text-[#2D1BFF]" />
                   Response Latency
                </h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1">LAST 24 HOURS (MS)</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#2D1BFF] shadow-sm">
                <RefreshCw size={18} />
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D1BFF" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2D1BFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} 
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 900, background: 'rgba(255,255,255,0.95)', backdropBlur: '8px'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#2D1BFF" 
                    strokeWidth={5} 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 📑 Status History Section */}
      <div className="px-6 mt-10 mx-auto max-w-5xl">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
               <Clock size={18} className="text-[#2D1BFF]" />
               Historical Integrity
            </h3>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border border-gray-100 px-4 py-2 rounded-full">
              Real-time Logs
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { time: '14:28:01', event: 'Healthy Update', res: '232ms', status: 'healthy' },
              { time: '14:23:01', event: 'Healthy Update', res: '245ms', status: 'healthy' },
              { time: '14:18:01', event: 'Performance Shift', res: '1,242ms', status: 'warning' },
              { time: '14:13:02', event: 'Healthy Update', res: '182ms', status: 'healthy' },
            ].map((log, i) => (
              <div key={i} className="bg-gray-50/50 hover:bg-white hover:shadow-lg rounded-[2rem] p-5 border border-gray-100 transition-all group border-l-4 overflow-hidden" style={{ borderLeftColor: log.status === 'healthy' ? '#10b981' : '#f59e0b' }}>
                <div className="flex items-center justify-between mb-2">
                   <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest group-hover:text-[#2D1BFF] transition-colors">{log.event}</div>
                   <div className="text-xs font-black text-gray-900 italic">{log.res}</div>
                </div>
                <div className="flex items-center justify-between">
                   <div className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em]">{log.time}</div>
                   <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${log.status === 'healthy' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                     {log.status}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Website Modal */}
      <EditWebsiteModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        website={selectedWebsite}
        onUpdate={() => {
          setShowEditModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default WebsiteDashboard;