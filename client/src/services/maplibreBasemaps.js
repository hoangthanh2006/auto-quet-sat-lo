// Cấu hình các bộ basemap WebGL cho MapLibre GL JS (Hỗ trợ Protomaps / Jawg / MapTiler / CARTO / ESRI)

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

export const MAPLIBRE_BASEMAPS = {
  // 1. Dark Matter (Chế độ tối WebGL - Khuyên dùng cho bão)
  dark_matter: {
    id: 'dark_matter',
    name: '🌙 Protomaps / Dark Matter (Tối)',
    provider: 'CARTO / OSM WebGL',
    style: createRasterStyle([
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
    ], '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'),
    description: 'Nền tối WebGL 60fps, tương phản cao, làm rực rỡ đường bão và vùng gió'
  },

  // 2. Positron (Tối giản / Báo chí sáng)
  positron: {
    id: 'positron',
    name: '☀️ Protomaps / Positron (Sáng Tinh Tế)',
    provider: 'CARTO / OSM WebGL',
    style: createRasterStyle([
      'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
    ], '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'),
    description: 'Phong cách infographic báo chí hiện đại chuẩn VnExpress Spotlight'
  },

  // 3. Voyager (Chi tiết địa danh & đường sá)
  voyager: {
    id: 'voyager',
    name: '🧭 Protomaps / Voyager (Địa Hình & Nhãn)',
    provider: 'CARTO / OSM WebGL',
    style: createRasterStyle([
      'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
    ], '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'),
    description: 'Hiển thị đầy đủ địa giới, tên đảo Hoàng Sa/Trường Sa, giao thông và thành phố'
  },

  // 4. Vệ tinh thực tế WebGL
  satellite: {
    id: 'satellite',
    name: '🛰️ Vệ Tinh Thực Tế (ESRI Satellite)',
    provider: 'ESRI WebGL',
    style: createRasterStyle([
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ], '&copy; Esri, Maxar, Earthstar Geographics'),
    description: 'Ảnh chụp vệ tinh độ phân giải cao toàn khu vực Biển Đông & Tây Thái Bình Dương'
  },

  // 5. OpenStreetMap Chuẩn
  osm: {
    id: 'osm',
    name: '🗺️ OpenStreetMap Standard',
    provider: 'OSM Org',
    style: createRasterStyle([
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    ], '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'),
    description: 'Bản đồ đường bộ quốc tế nguồn mở toàn cầu'
  },

  // 6. MapTiler Dataviz Dark (Nếu có Key)
  maptiler_dark: {
    id: 'maptiler_dark',
    name: '🗺️ MapTiler Dataviz Dark (Vector GL)',
    provider: 'MapTiler',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (key) => `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key || 'get_free_key'}`,
    description: 'Bản đồ vector chuyên dụng hiển thị dữ liệu khoa học khí tượng từ MapTiler'
  },

  // 7. MapTiler Streets (Nếu có Key)
  maptiler_streets: {
    id: 'maptiler_streets',
    name: '🏙️ MapTiler Streets (Vector GL)',
    provider: 'MapTiler',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (key) => `https://api.maptiler.com/maps/streets-v2/style.json?key=${key || 'get_free_key'}`,
    description: 'Bản đồ vector đường phố đa tầng hiện đại từ MapTiler'
  },

  // 8. Jawg Maps Dark (Nếu có Token)
  jawg_dark: {
    id: 'jawg_dark',
    name: '🐆 Jawg Maps Dark (Vector GL)',
    provider: 'Jawg Maps',
    requiresKey: true,
    keyParam: 'jawgToken',
    getStyle: (token) => `https://api.jawg.io/styles/jawg-dark.json?access-token=${token || 'get_free_token'}`,
    description: 'Bản đồ vector phong cách cao cấp siêu nét từ Jawg Maps'
  },

  // 9. Jawg Maps Sunny (Nếu có Token)
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
