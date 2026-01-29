# DaiHoiDang Scraper

A full-stack web application for scraping profile links from daihoidang.vn using Puppeteer.

## Project Structure

```
.
├── server/          # Node.js + Express backend
│   ├── index.js     # Express server setup
│   ├── scraper.js   # Puppeteer scraping logic
│   └── package.json
└── client/          # React + Vite frontend
    ├── src/
    │   ├── App.jsx       # Main React component
    │   ├── main.jsx      # React entry point
    │   ├── services/
    │   │   └── api.js    # API service functions
    │   └── index.css     # Tailwind CSS imports
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

## Features

- **Web Scraping**: Uses Puppeteer to scrape profile links from daihoidang.vn
- **Filtering**: Only extracts links matching `/nhan-su/.*\.html` pattern
- **Deduplication**: Ensures no duplicate URLs are returned
- **Content Extraction**: Extract structured data (tables, lists, paragraphs) from profile pages
- **Modern UI**: Clean React interface with Tailwind CSS
- **Export**: Download results as JSON file
- **Error Handling**: Comprehensive error handling for network and scraping failures

## Installation

### Backend Setup

```bash
cd server
npm install
```

### Frontend Setup

```bash
cd client
npm install
```

## Running the Application

### Start Backend Server

```bash
cd server
npm start
# or for development with auto-reload:
npm run dev
```

The backend will run on `http://localhost:3001`

### Start Frontend Development Server

```bash
cd client
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### POST `/api/scan-links`

Scrapes profile links from the target URL.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Person Name",
      "url": "https://daihoidang.vn/nhan-su/person-name-1234.html"
    }
  ],
  "count": 1
}
```

### POST `/api/extract-content`

Extracts structured content from profile pages.

**Request:**
```json
{
  "urls": [
    "https://daihoidang.vn/nhan-su/person-name-1234.html"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "success": true,
      "url": "https://daihoidang.vn/nhan-su/person-name-1234.html",
      "data": {
        "url": "...",
        "title": "...",
        "tables": [...],
        "lists": [...],
        "paragraphs": [...],
        "metadata": {...}
      }
    }
  ],
  "stats": {
    "total": 1,
    "successful": 1,
    "failed": 0
  }
}
```

## Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React
- **Backend**: Node.js, Express, Puppeteer
- **HTTP Client**: Axios
- **CORS**: Enabled for cross-origin requests

## Notes

- The scraper targets: `https://daihoidang.vn/uy-vien-trung-uong.html`
- Only links matching `/nhan-su/.*\.html` pattern are extracted
- The application includes deduplication to prevent duplicate URLs
- Browser runs in headless mode for better performance
