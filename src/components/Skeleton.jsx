import React from 'react';

// Skeleton Loading Components for Modern UX
export const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 p-5 animate-pulse ${className}`}>
    <div className="flex items-start gap-4 mb-4">
      <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
      <div className="flex-1">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
);

export const SkeletonButton = ({ className = '' }) => (
  <div className={`h-10 bg-gray-200 rounded-lg animate-pulse ${className}`}></div>
);

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`h-4 bg-gray-200 rounded animate-pulse ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
      ></div>
    ))}
  </div>
);

export const SkeletonStats = ({ count = 3 }) => (
  <div className="grid grid-cols-3 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    ))}
  </div>
);

export const SkeletonWebsiteCard = () => (
  <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-gray-200/50 overflow-hidden animate-pulse">
    <div className="h-1 bg-gray-200"></div>
    <div className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
        <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-200 rounded w-20"></div>
        <div className="h-6 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full mb-4"></div>
      <div className="flex gap-2 mb-2">
        <div className="h-9 bg-gray-200 rounded-xl flex-1"></div>
        <div className="h-9 bg-gray-200 rounded-xl flex-1"></div>
      </div>
    </div>
  </div>
);

export default SkeletonCard;
