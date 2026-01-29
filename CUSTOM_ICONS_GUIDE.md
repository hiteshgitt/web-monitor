# Custom Platform Icons Guide

## Current Implementation

The platform icons are now using **Lucide React icons** as placeholders:
- **WordPress**: Code2 icon (blue)
- **Next.js**: FileCode icon (black)
- **Laravel**: Rocket icon (red)
- **CodeIgniter**: Gem icon (orange)
- **PHP**: Code2 icon (indigo)
- **Default**: Globe icon (gray)

## Adding Your Custom Icons

If you want to use platform-specific SVG icons (WordPress logo, Next.js logo, etc.), follow these steps:

### Step 1: Prepare Your Icons

1. **Get SVG icons** for each platform:
   - WordPress: Official WordPress logo SVG
   - Next.js: Official Next.js logo SVG
   - Laravel: Official Laravel logo SVG
   - CodeIgniter: Official CodeIgniter logo SVG
   - PHP: Official PHP logo SVG

2. **Optimize your SVGs**:
   - Make sure they're clean SVG code
   - Recommended size: 32x32px or 64x64px
   - Remove unnecessary attributes
   - Keep viewBox and path data

### Step 2: Place Icons in Public Folder

Create the folder structure:
```bash
mkdir -p public/icons/platforms
```

Place your SVG files:
```
public/icons/platforms/
  ├── wordpress.svg
  ├── nextjs.svg
  ├── laravel.svg
  ├── codeigniter.svg
  └── php.svg
```

### Step 3: Update PlatformIcon Component

Edit `src/components/PlatformIcon.jsx`:

1. **Uncomment the custom icons section** (lines 20-35)
2. **Comment out the Lucide icons section** (lines 37-58)

The code will automatically switch from Lucide icons to your custom SVG icons.

### Example SVG Icon Structure

Your SVG files should look like this:

**wordpress.svg:**
```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21.469 6.825c.84 1.537 1.321 3.362 1.321 5.375 0 3.006-1.107 5.749-2.931 7.853l-1.708-4.896c.467-.723.75-1.576.75-2.5 0-1.4-.514-2.683-1.361-3.666-.861-1.001-2.032-1.616-3.365-1.616-.267 0-.525.029-.775.071l-.084-.084L21.469 6.825zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#0073AA"/>
</svg>
```

## Icon Requirements

- **Format**: SVG (preferred) or PNG
- **Size**: 32x32px to 64x64px
- **Colors**: Use brand colors if possible
- **Style**: Simple, clean, recognizable

## Platform Brand Colors

If you're creating custom icons, use these brand colors:

- **WordPress**: `#0073AA` (blue)
- **Next.js**: `#000000` (black)
- **Laravel**: `#FF2D20` (red)
- **CodeIgniter**: `#EF4223` (orange)
- **PHP**: `#777BB4` (indigo/purple)

## Quick Test

After adding your custom icons:

1. Restart the dev server: `npm run dev`
2. Check the browser console for any 404 errors (missing icons)
3. Verify icons display correctly in the website cards

## Need Help?

If you have the icons ready, you can:
1. Share them with me (paste SVG code or provide file paths)
2. I can help integrate them into the component
3. Or follow the steps above to add them yourself

## Current Component Location

- **Component**: `src/components/PlatformIcon.jsx`
- **Usage**: `src/components/HomePage.jsx` (line 55-57)

The component is already set up to easily switch between Lucide icons and custom SVG icons!
