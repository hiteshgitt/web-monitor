import React from 'react';
import { Radio } from 'lucide-react';

const RealTimeIndicator = ({ isLive = true, pulse = true }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Radio 
          size={12} 
          className={`${isLive ? 'text-emerald-500' : 'text-rose-500'} ${pulse ? 'animate-pulse' : ''}`} 
        />
        {pulse && (
          <div className={`absolute inset-0 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-rose-500'} animate-ping opacity-75`}></div>
        )}
      </div>
      <span className={`text-xs font-black italic uppercase tracking-widest ${isLive ? 'text-emerald-400' : 'text-rose-500'}`}>
        {isLive ? 'Live' : 'Offline'}
      </span>
    </div>
  );
};

export default RealTimeIndicator;
