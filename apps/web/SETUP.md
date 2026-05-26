# Quick Setup Guide

## Local Development

1. **Install dependencies:**
```bash
cd apps/web
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
```

3. **Start the dev server:**
```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## Docker Deployment

The web dashboard is included in the docker-compose setup:

```bash
# From the project root
docker-compose up -d web
```

Access the dashboard at `http://localhost:3000`

**Note:** Grafana runs on port 3001, Prometheus on 9090

## Features

### Dashboard Home (`/`)
- **Create Short URLs**: Enter any URL and get a shortened version instantly
- **View All URLs**: See all your shortened URLs with pagination
- **Quick Copy**: One-click copy to clipboard for any short URL
- **Stats Overview**: Total URLs, total clicks, and average clicks per URL

### Analytics Page (`/analytics/:slug`)
- **Overview Stats**: Total clicks and unique visitors
- **Click Timeline**: Visual timeline with customizable date ranges (7, 30, or 90 days)
- **Geographic Data**: Top countries accessing your links
- **Device Analytics**: Breakdown by device type (desktop, mobile, tablet)
- **Browser Stats**: Most popular browsers used
- **Referrer Tracking**: See where your traffic is coming from

## API Integration

The dashboard connects to your Slashly API backend. Make sure:
- API is running on `http://localhost:8080` (or update `API_BASE_URL` in `.env`)
- CORS is enabled on the API if running on different domains
- All API endpoints are accessible

## Customization

### Theme Colors
Edit `tailwind.config.js` to customize the dark theme colors:
```js
colors: {
  dark: {
    bg: '#0a0a0a',      // Main background
    card: '#141414',     // Card background
    border: '#262626',   // Border color
    hover: '#1a1a1a'     // Hover state
  }
}
```

### API Base URL
Update `.env` file:
```
API_BASE_URL=https://your-api-domain.com
```

## Production Build

```bash
npm run build
npm run preview
```

Or use Docker for production deployment.
