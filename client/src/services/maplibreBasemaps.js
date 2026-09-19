// Cấu hình các bộ basemap WebGL cho MapLibre GL JS (Hỗ trợ Protomaps / Jawg / MapTiler / ESRI / Carto / Custom Style JSON)

export const createRasterStyle = (tiles, attribution = '', maxzoom = 19) => ({
  version: 8,
  sources: {
    'base-raster-tiles': {
      type: 'raster',
      tiles: Array.isArray(tiles) ? tiles : [tiles],
      tileSize: 256,
      attribution
    }
  },
  layers: [
    {
      id: 'base-raster-layer',
      type: 'raster',
      source: 'base-raster-tiles',
      minzoom: 0,
      maxzoom
    }
  ]
});

export const createCompositeStyle = (baseTiles, refTiles, attribution = '', maxzoom = 19) => ({
  version: 8,
  sources: {
    'base-source': {
      type: 'raster',
      tiles: Array.isArray(baseTiles) ? baseTiles : [baseTiles],
      tileSize: 256,
      attribution
    },
    ...(refTiles ? {
      'ref-source': {
        type: 'raster',
        tiles: Array.isArray(refTiles) ? refTiles : [refTiles],
        tileSize: 256
      }
    } : {})
  },
  layers: [
    {
      id: 'base-layer',
      type: 'raster',
      source: 'base-source',
      minzoom: 0,
      maxzoom
    },
    ...(refTiles ? [
      {
        id: 'ref-layer',
        type: 'raster',
        source: 'ref-source',
        minzoom: 0,
        maxzoom
      }
    ] : [])
  ]
});

// Helper trích xuất raw key nếu người dùng dán URL hoặc query string
export const extractApiKey = (input, paramName = 'key') => {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      return url.searchParams.get(paramName) || trimmed;
    } catch {
      return trimmed;
    }
  }
  if (trimmed.includes('=')) {
    const match = trimmed.match(/(?:key|access-token|token)=([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) return match[1];
  }
  return trimmed;
};

// Helper tạo style URL thông minh:
// 1. Nếu dán URL style.json đầy đủ (từ MapTiler Studio / Cloud), dùng trực tiếp URL đó
// 2. Nếu nhập API key thông thường, gắn vào template style chuẩn
export const resolveMapTilerStyle = (keyOrUrl, defaultMapSlug = 'dataviz-dark') => {
  if (!keyOrUrl) return `https://api.maptiler.com/maps/${defaultMapSlug}/style.json?key=get_free_key`;
  const trimmed = keyOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanKey = extractApiKey(trimmed, 'key');
  return `https://api.maptiler.com/maps/${defaultMapSlug}/style.json?key=${cleanKey}`;
};

export const resolveJawgStyle = (tokenOrUrl, defaultStyleSlug = 'jawg-dark') => {
  if (!tokenOrUrl) return `https://api.jawg.io/styles/${defaultStyleSlug}.json?access-token=get_free_token`;
  const trimmed = tokenOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanToken = extractApiKey(trimmed, 'access-token');
  return `https://api.jawg.io/styles/${defaultStyleSlug}.json?access-token=${cleanToken}`;
};

export const MAPLIBRE_BASEMAPS = {
  // 1. Chế độ tối chuyên dụng khí tượng (ESRI Dark Canvas - Không watermark, cực kỳ sắc nét)
  dark_matter: {
    id: 'dark_matter',
    name: '🌙 ESRI Dark Canvas (Tối Khí Tượng - Mặc định)',
    provider: 'ESRI WebGL (Không Watermark)',
    style: createCompositeStyle(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      '&copy; Esri, DeLorme, NAVTEQ'
    ),
    description: 'Nền tối WebGL 60fps tương phản cao, làm rực rỡ đường bão và vùng gió, không watermark'
  },

  // 2. Chế độ sáng tinh tế (ESRI Light Canvas - Chuẩn báo chí infographic)
  positron: {
    id: 'positron',
    name: '☀️ ESRI Light Canvas (Sáng Tinh Tế)',
    provider: 'ESRI WebGL (Không Watermark)',
    style: createCompositeStyle(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      '&copy; Esri, HERE, Garmin'
    ),
    description: 'Phong cách infographic báo chí hiện đại chuẩn VnExpress Spotlight, nền xám thanh lịch'
  },

  // 3. Vệ tinh thực tế WebGL
  satellite: {
    id: 'satellite',
    name: '🛰️ Vệ Tinh Thực Tế (ESRI Satellite + Địa Danh)',
    provider: 'ESRI WebGL (Không Watermark)',
    style: createCompositeStyle(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      '&copy; Esri, Maxar, Earthstar Geographics'
    ),
    description: 'Ảnh chụp vệ tinh độ phân giải cao kèm địa giới & tên đảo toàn Biển Đông & Thái Bình Dương'
  },

  // 4. Carto Voyager (Địa giới chi tiết)
  voyager: {
    id: 'voyager',
    name: '🧭 Carto Voyager (Chi tiết địa giới)',
    provider: 'CartoDB (Nguồn Mở)',
    style: createRasterStyle(
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      '&copy; CARTO'
    ),
    description: 'Bản đồ màu sắc thanh lịch với đầy đủ tên đảo và địa giới'
  },

  // 5. OpenStreetMap Chuẩn
  osm: {
    id: 'osm',
    name: '🗺️ OpenStreetMap Standard (Toàn Cầu)',
    provider: 'OSM Org (Nguồn Mở)',
    style: createRasterStyle(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      '&copy; OpenStreetMap'
    ),
    description: 'Bản đồ đường bộ quốc tế nguồn mở toàn cầu'
  },

  // 6. MapLibre Open Demo Vector
  maplibre_demo: {
    id: 'maplibre_demo',
    name: '🌐 MapLibre Open Vector',
    provider: 'MapLibre Org',
    style: 'https://demotiles.maplibre.org/style.json',
    description: 'Vector demo chuẩn từ MapLibre Org'
  },

  // 7. MapTiler Dataviz Dark / Custom Style (Vector GL)
  maptiler_dark: {
    id: 'maptiler_dark',
    name: '🗺️ MapTiler Dataviz Dark (Vector GL)',
    provider: 'MapTiler',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (keyOrUrl) => resolveMapTilerStyle(keyOrUrl, 'dataviz-dark'),
    description: 'Bản đồ vector chuyên dụng khí tượng hoặc style.json tùy biến từ MapTiler'
  },

  // 8. MapTiler Streets (Vector GL)
  maptiler_streets: {
    id: 'maptiler_streets',
    name: '🏙️ MapTiler Streets (Vector GL)',
    provider: 'MapTiler',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (keyOrUrl) => {
      if (!keyOrUrl) return 'https://api.maptiler.com/maps/streets-v2/style.json?key=get_free_key';
      const trimmed = keyOrUrl.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const extractedKey = extractApiKey(trimmed, 'key');
        if (trimmed.includes('/streets')) return trimmed;
        if (extractedKey && extractedKey !== trimmed) {
          return `https://api.maptiler.com/maps/streets-v2/style.json?key=${extractedKey}`;
        }
        return trimmed;
      }
      const cleanKey = extractApiKey(trimmed, 'key');
      return `https://api.maptiler.com/maps/streets-v2/style.json?key=${cleanKey}`;
    },
    description: 'Bản đồ vector đường phố đa tầng hiện đại từ MapTiler'
  },

  // 9. Custom Vector Style JSON URL (MapTiler Studio / Mapbox / Nguồn riêng)
  custom_style: {
    id: 'custom_style',
    name: '🎨 Custom Style JSON (MapTiler Studio / Mapbox)',
    provider: 'Vector Style URL Tùy Biến',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (keyOrUrl) => {
      if (!keyOrUrl) return 'https://demotiles.maplibre.org/style.json';
      const trimmed = keyOrUrl.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${trimmed}`;
    },
    description: 'Dán trực tiếp URL style.json từ MapTiler Studio hoặc Vector Server riêng'
  },

  // 10. Jawg Maps Dark (Vector GL)
  jawg_dark: {
    id: 'jawg_dark',
    name: '🐆 Jawg Maps Dark (Vector GL)',
    provider: 'Jawg Maps',
    requiresKey: true,
    keyParam: 'jawgToken',
    getStyle: (tokenOrUrl) => resolveJawgStyle(tokenOrUrl, 'jawg-dark'),
    description: 'Bản đồ vector phong cách cao cấp siêu nét từ Jawg Maps'
  },

  // 11. Jawg Maps Sunny (Vector GL)
  jawg_sunny: {
    id: 'jawg_sunny',
    name: '☀️ Jawg Maps Sunny (Vector GL)',
    provider: 'Jawg Maps',
    requiresKey: true,
    keyParam: 'jawgToken',
    getStyle: (tokenOrUrl) => resolveJawgStyle(tokenOrUrl, 'jawg-sunny'),
    description: 'Bản đồ vector tươi sáng cao cấp từ Jawg Maps'
  }
};
