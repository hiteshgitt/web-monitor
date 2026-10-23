import React from 'react';

// The Web Monitor "wm" mark. variant "white" for gradient/dark backgrounds, "brand" for light ones.
const Logo = ({ variant = 'brand', className = 'h-6' }) => (
  <img
    src={variant === 'white' ? '/icons/logo-mark-white.png' : '/icons/logo-mark-brand.png'}
    alt="Web Monitor"
    className={`w-auto object-contain select-none ${className}`}
    draggable={false}
  />
);

export default Logo;
