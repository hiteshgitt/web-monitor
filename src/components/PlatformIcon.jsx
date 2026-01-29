import React from 'react';
import { Globe } from 'lucide-react';

/**
 * PlatformIcon Component
 * 
 * Displays platform-specific icons using custom PNG images.
 * Icons are located in: /public/icons/platforms/
 */

const PlatformIcon = ({ platform, className = "w-8 h-8" }) => {
  const iconClass = className;
  const iconProps = { size: 32, className: iconClass };
  
  // Custom PNG icons from /public/icons/platforms/
  const customIcons = {
    wordpress: '/icons/platforms/wordpress.png',
    nextjs: '/icons/platforms/nextjs.png',
    laravel: '/icons/platforms/laravel.png',
    codeigniter: '/icons/platforms/codeigniter.png',
    php: '/icons/platforms/php.png',
  };
  
  // Use custom icons if available
  if (customIcons[platform]) {
    return (
      <img 
        src={customIcons[platform]} 
        alt={`${platform} icon`}
        className={iconClass}
        style={{ objectFit: 'contain' }}
      />
    );
  }
  
  // Fallback to Globe icon for unknown platforms
  return <Globe {...iconProps} className={`${iconClass} text-gray-600`} />;
};

export default PlatformIcon;
