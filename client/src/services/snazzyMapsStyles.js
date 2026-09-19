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
  }
};
