// Bộ sưu tập theme Snazzy Maps chuyên nghiệp cho Google Maps (VnExpress Spotlight)

export const SNAZZY_THEMES = {
  // 1. Subtle Grayscale (Snazzy Maps ID: 15) - Nổi tiếng nhất, tinh tế, làm nổi bật đường bão & vùng gió
  subtle_grayscale: {
    id: 'subtle_grayscale',
    name: 'Snazzy Tinh Tế (Grayscale)',
    styles: [
      { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
      { featureType: 'landscape', elementType: 'all', stylers: [{ color: '#f5f5f7' }] },
      { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
      { featureType: 'road', elementType: 'all', stylers: [{ saturation: -100 }, { lightness: 45 }, { visibility: 'simplified' }] },
      { featureType: 'road.highway', elementType: 'all', stylers: [{ visibility: 'simplified' }] },
      { featureType: 'road.arterial', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
      { featureType: 'water', elementType: 'all', stylers: [{ color: '#dbeafe' }, { visibility: 'on' }] }
    ]
  },

  // 2. Midnight Dark (Snazzy Maps ID: 25) - Tối ưu cho chế độ ban đêm (Dark Mode)
  midnight_dark: {
    id: 'midnight_dark',
    name: 'Snazzy Đêm (Midnight)',
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
      { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
      { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
      { featureType: 'landscape', stylers: [{ color: '#1e293b' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'road', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#030712' }] }
    ]
  },

  // 3. Editorial Light (Snazzy Maps ID: 75) - Phong cách đồ họa báo chí giấy (Newspaper Infographic)
  editorial_light: {
    id: 'editorial_light',
    name: 'Snazzy Báo Chí (Editorial)',
    styles: [
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0f2fe' }] },
      { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#fafafa' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'road', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#64748b' }, { weight: 1.2 }] },
      { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }, { weight: 0.8 }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] }
    ]
  },

  // 4. Satellite Hybrid (Ảnh vệ tinh thật kết hợp địa danh)
  satellite_hybrid: {
    id: 'satellite_hybrid',
    name: 'Google Vệ Tinh (Satellite)',
    isSatellite: true,
    styles: []
  },

  // 5. OpenStreetMap Tự Do (Không cần API key, 100% không watermark)
  osm_clean: {
    id: 'osm_clean',
    name: '🌐 Bản đồ Tự do (OpenStreetMap)',
    isLeaflet: true,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },

  // 6. ESRI Dark Gray Canvas (Bản đồ Đêm tự do, 100% không cần key, không watermark)
  esri_dark: {
    id: 'esri_dark',
    name: '🌙 Bản đồ Tự do Đêm (ESRI Dark)',
    isLeaflet: true,
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS'
  },

  // 7. ESRI World Imagery (Vệ tinh tự do không watermark)
  esri_satellite: {
    id: 'esri_satellite',
    name: '🛰️ Bản đồ Vệ Tinh Tự do (ESRI)',
    isLeaflet: true,
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  }
};
