// Cấu hình các bộ basemap vector WebGL cho MapLibre GL JS (Hỗ trợ Protomaps / Jawg / MapTiler / CARTO)

export const SATELLITE_GL_STYLE = {
  version: 8,
  name: 'ESRI World Imagery Satellite',
  sources: {
    'esri-satellite-source': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics'
    }
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite-source',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

export const MAPLIBRE_BASEMAPS = {
  // 1. Dark Matter (Chế độ tối WebGL - Khuyên dùng cho bão)
  dark_matter: {
    id: 'dark_matter',
    name: '🌙 Protomaps / Dark Matter (Tối)',
    provider: 'CARTO / OSM Vector',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    description: 'Nền tối WebGL 60fps, tương phản cao, làm rực rỡ đường bão và vùng gió'
  },

  // 2. Positron (Tối giản / Báo chí)
  positron: {
    id: 'positron',
    name: '☀️ Protomaps / Positron (Sáng Tinh Tế)',
    provider: 'CARTO / OSM Vector',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    description: 'Phong cách infographic báo chí hiện đại chuẩn VnExpress Spotlight'
  },

  // 3. Voyager (Chi tiết địa danh)
  voyager: {
    id: 'voyager',
    name: '🧭 Voyager (Chi tiết địa hình & nhãn)',
    provider: 'CARTO / OSM Vector',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    description: 'Hiển thị đầy đủ địa giới, tên đảo, giao thông và thành phố'
  },

  // 4. Vệ tinh thực tế WebGL
  satellite: {
    id: 'satellite',
    name: '🛰️ Vệ Tinh Thực Tế (ESRI Satellite)',
    provider: 'ESRI WebGL',
    style: SATELLITE_GL_STYLE,
    description: 'Ảnh chụp vệ tinh độ phân giải cao toàn khu vực Biển Đông & Thái Bình Dương'
  },

  // 5. MapLibre Demo Tiles
  maplibre_demo: {
    id: 'maplibre_demo',
    name: '🌐 MapLibre Open Vector',
    provider: 'MapLibre Org',
    style: 'https://demotiles.maplibre.org/style.json',
    description: 'Bản đồ vector nguồn mở tiêu chuẩn từ cộng đồng MapLibre'
  },

  // 6. MapTiler Dataviz Dark (Nếu có Key)
  maptiler_dark: {
    id: 'maptiler_dark',
    name: '🗺️ MapTiler Dataviz (Cần Key)',
    provider: 'MapTiler',
    requiresKey: true,
    keyParam: 'maptilerKey',
    getStyle: (key) => `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key || 'get_free_key'}`,
    description: 'Bản đồ chuyên dụng hiển thị dữ liệu khoa học khí tượng từ MapTiler'
  },

  // 7. Jawg Maps Dark (Nếu có Token)
  jawg_dark: {
    id: 'jawg_dark',
    name: '🐆 Jawg Maps Dark (Cần Token)',
    provider: 'Jawg Maps',
    requiresKey: true,
    keyParam: 'jawgToken',
    getStyle: (token) => `https://api.jawg.io/styles/jawg-dark.json?access-token=${token || 'get_free_token'}`,
    description: 'Bản đồ vector phong cách cao cấp từ Jawg Maps'
  }
};
