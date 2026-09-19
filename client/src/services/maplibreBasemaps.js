// Cấu hình các bộ basemap WebGL cho MapLibre GL JS (Hỗ trợ Protomaps / Jawg / MapTiler / ESRI)

export const createRasterStyle = (tiles, attribution = '', maxzoom = 19) => ({
  version: 8,
  sources: {
    'raster-tiles': {
      type: 'raster',
      tiles: Array.isArray(tiles) ? tiles : [tiles],
      tileSize: 256,
      attribution
    }
  },
  layers: [
    {
      id: 'raster-layer',
      type: 'raster',
      source: 'raster-tiles',
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

  // 4. OpenStreetMap Chuẩn
  osm: {
    id: 'osm',
    name: '🗺️ OpenStreetMap Standard (Toàn Cầu)',
    provider: 'OSM Org (Nguồn Mở)',
    style: createRasterStyle(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    ),
    description: 'Bản đồ đường bộ quốc tế nguồn mở toàn cầu'
  },

  // 5. MapTiler Dataviz Dark (Vector GL - Dùng Key miễn phí từ maptiler.com)
  maptiler_dark: {
    id: 'maptiler_dark',
    name: '🗺️ MapTiler Dataviz Dark (Vector GL)',
    provider: 'MapTiler',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (key) => `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key || 'get_free_key'}`,
    description: 'Bản đồ vector chuyên dụng hiển thị dữ liệu khoa học khí tượng từ MapTiler'
  },

  // 6. MapTiler Streets (Vector GL)
  maptiler_streets: {
    id: 'maptiler_streets',
    name: '🏙️ MapTiler Streets (Vector GL)',
    provider: 'MapTiler',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (key) => `https://api.maptiler.com/maps/streets-v2/style.json?key=${key || 'get_free_key'}`,
    description: 'Bản đồ vector đường phố đa tầng hiện đại từ MapTiler'
  },

  // 7. Jawg Maps Dark (Vector GL - Dùng Token miễn phí từ jawg.io)
  jawg_dark: {
    id: 'jawg_dark',
    name: '🐆 Jawg Maps Dark (Vector GL)',
    provider: 'Jawg Maps',
    requiresKey: true,
    keyParam: 'jawgToken',
    getStyle: (token) => `https://api.jawg.io/styles/jawg-dark.json?access-token=${token || 'get_free_token'}`,
    description: 'Bản đồ vector phong cách cao cấp siêu nét từ Jawg Maps'
  },

  // 8. Jawg Maps Sunny (Vector GL)
  jawg_sunny: {
    id: 'jawg_sunny',
    name: '☀️ Jawg Maps Sunny (Vector GL)',
    provider: 'Jawg Maps',
    requiresKey: true,
    keyParam: 'jawgToken',
    getStyle: (token) => `https://api.jawg.io/styles/jawg-sunny.json?access-token=${token || 'get_free_token'}`,
    description: 'Bản đồ vector tươi sáng cao cấp từ Jawg Maps'
  }
};
