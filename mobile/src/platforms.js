const ICONS = {
  wordpress: require('../assets/platforms/wordpress.png'),
  nextjs: require('../assets/platforms/nextjs.png'),
  laravel: require('../assets/platforms/laravel.png'),
  codeigniter: require('../assets/platforms/codeigniter.png'),
  php: require('../assets/platforms/php.png'),
};

export const platformIcon = (platform) => ICONS[platform] || null;
