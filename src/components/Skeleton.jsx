import React from 'react';

// Skeleton Loading Components for Web Monitor Aesthetic
export const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-white rounded-[2rem] border border-gray-100 p-6 animate-pulse shadow-soft ${className}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-12 h-12 bg-gray-100 rounded-2xl"></div>
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-1/3"></div>
          <div className="h-5 bg-gray-100 rounded w-3/4"></div>
        </div>
      </div>
      <div className="text-right space-y-2">
        <div className="h-3 bg-gray-100 rounded w-8 ml-auto"></div>
        <div className="h-6 bg-gray-100 rounded w-12 ml-auto"></div>
      </div>
    </div>
  </div>
);

export const SkeletonButton = ({ className = '' }) => (
  <div className={`h-12 bg-gray-100 rounded-2xl animate-pulse ${className}`}></div>
);

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`h-4 bg-gray-100 rounded-lg animate-pulse ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
      ></div>
    ))}
  </div>
);

export const SkeletonStats = () => (
  <div className="flex gap-4 overflow-x-auto pb-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex-1 min-w-[120px] bg-white rounded-3xl p-5 shadow-lg border border-gray-50 flex flex-col items-start gap-4 animate-pulse">
        <div className="flex items-center justify-between w-full">
          <div className="h-8 bg-gray-100 rounded w-1/2"></div>
          <div className="w-3 h-3 rounded-full bg-gray-100"></div>
        </div>
        <div className="h-3 bg-gray-100 rounded w-2/3"></div>
      </div>
    ))}
  </div>
);

export const SkeletonWebsiteCard = () => (
  <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-gray-50 flex items-center justify-between animate-pulse">
    <div className="flex items-center gap-4 flex-1">
      <div className="w-3 h-3 bg-gray-100 rounded-full flex-shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="h-2.5 bg-gray-100 rounded w-24"></div>
        <div className="h-5 bg-gray-100 rounded w-3/4"></div>
      </div>
    </div>
    <div className="text-right space-y-2">
      <div className="h-2.5 bg-gray-100 rounded w-8 ml-auto"></div>
      <div className="h-6 bg-gray-100 rounded w-12 ml-auto"></div>
    </div>
  </div>
);

export default SkeletonCard;
