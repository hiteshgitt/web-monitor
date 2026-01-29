import React from 'react';
import { Radio } from 'lucide-react';

const RealTimeIndicator = ({ isLive = true, pulse = true }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Radio 
          size={12} 
          className={`text-emerald-500 ${pulse ? 'animate-pulse' : ''}`} 
        />
        {pulse && (
          <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
        )}
      </div>
      <span className="text-xs font-medium text-emerald-600">
        {isLive ? 'Live' : 'Offline'}
      </span>
    </div>
  );
};

export default RealTimeIndicator;
