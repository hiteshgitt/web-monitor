# Web Monitor Dashboard

A modern React mobile dashboard for Web Monitor with AI-powered insights and multi-platform website monitoring.

## Features

- 📊 **Real-time Analytics**: Monitor multiple websites and platforms
- 🔧 **Multi-platform Support**: WordPress, Next.js, Laravel, CodeIgniter
- 🤖 **AI Assistant**: Get intelligent suggestions for optimization
- 📱 **Mobile-First Design**: Optimized for mobile devices
- 🎨 **Modern UI**: Beautiful gradient designs and responsive layout
- 📈 **Performance Monitoring**: Track response times and traffic
- 🔒 **Security Alerts**: Monitor security status across platforms
- 🔍 **SEO Analytics**: Track SEO scores and improvements

## Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Responsive charts and data visualization
- **Lucide React** - Beautiful icons

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## Configuration

### API Configuration

Update the API configurations in `src/App.jsx`:

```javascript
const apiConfigs = {
  wordpress: { url: 'https://your-wp-site.com/wp-json/sap/v1/', authType: 'Bearer' },
  nextjs: { url: 'https://your-nextjs-site.com/api/sap/', authType: 'x-api-key' },
  laravel: { url: 'https://your-laravel-site.com/api/sap/', authType: 'Bearer' },
  codeigniter: { url: 'https://your-ci-site.com/api/sap/', authType: 'X-API-Key' }
};
```

### Website Configuration

Add your websites to monitor in the websites array:

```javascript
const [websites, setWebsites] = useState([
  { 
    id: 1, 
    name: 'Your Website', 
    url: 'your-domain.com', 
    platform: 'wordpress', 
    status: 'healthy', 
    uptime: 99.9, 
    apiKey: 'YOUR_API_KEY' 
  }
]);
```

## Features Overview

### Dashboard Tabs

1. **Overview**: Quick stats, connected websites, AI suggestions
2. **Performance**: Response time charts, traffic overview
3. **SEO**: SEO score distribution, metrics by site
4. **Security**: Security alerts, security scores
5. **Analytics**: Visitor stats, top pages, session data

### AI Assistant

The AI assistant provides intelligent suggestions for:
- Performance optimization
- Security improvements
- SEO enhancements
- General system recommendations

## Customization

### Styling

The app uses Tailwind CSS for styling. You can customize colors and themes in `tailwind.config.js`.

### Adding New Platforms

To add support for new platforms:

1. Add the platform configuration to `apiConfigs`
2. Update the website platform types
3. Implement the API integration logic

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
