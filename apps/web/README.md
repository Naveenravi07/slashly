# Slashly Web Dashboard

Minimalistic dark-themed dashboard for the Slashly URL shortener.

## Features

- Create shortened URLs
- View all URLs with pagination
- Detailed analytics per URL:
  - Total clicks and unique visitors
  - Click timeline with customizable date ranges
  - Top countries, devices, browsers, and referers
- Copy short URLs to clipboard
- Fully responsive design
- Dark theme optimized for readability

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update the API base URL in `.env` if needed:
```
API_BASE_URL=http://localhost:8080
```

4. Run the development server:
```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

- Nuxt 3
- Vue 3
- Tailwind CSS
- Dark theme with gradient accents
