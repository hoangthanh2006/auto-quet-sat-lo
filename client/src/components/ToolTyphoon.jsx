import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { 
  Wind, Eye, Compass, CloudRain, AlertTriangle, Gauge, Clock, MapPin, 
  TrendingUp, BarChart3, UploadCloud, FileText, Download, Copy, Check, 
  RefreshCw, Sliders, ShieldAlert, Layers, ExternalLink, ChevronRight,
  Info, Sparkles, Navigation, Globe, Palette, Key, X, Activity, History
} from 'lucide-react';
import { 
  getActiveTyphoons, 
  getStormDetails, 
  uploadTyphoonKmz, 
  getHistoricalLandfalls, 
  getTyphoonProvinceMetrics,
  getTyphoonPresets,
  fetchLuquetSatloRadar,
  getRadarProxyUrl
} from '../services/api';
import { MAPLIBRE_BASEMAPS } from '../services/maplibreBasemaps';

// Cấu hình web worker cho MapLibre GL JS v6 trong môi trường Vite
if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  try {
    maplibregl.setWorkerUrl(workerUrl);
  } catch (e) {
    console.warn('Không thể gán maplibre workerUrl:', e);
  }
}

const DEFAULT_PRESETS = [
  { id: 'PRESET_YAGI_2024', name: 'YAGI (Bão số 3 - 2024)', year: 2024, maxWind: '203 km/h (Cấp 16)', province: 'Quảng Ninh - Hải Phòng', desc: 'Siêu bão lịch sử càn quét và tàn phá nặng nề các tỉnh Bắc Bộ tháng 9/2024' },
  { id: 'PRESET_MOLAVE_2020', name: 'MOLAVE (Bão số 9 - 2020)', year: 2020, maxWind: '135 km/h (Cấp 13)', province: 'Quảng Ngãi', desc: 'Một trong những cơn bão mạnh nhất đổ bộ miền Trung trong 20 năm qua' },
  { id: 'PRESET_DAMREY_2017', name: 'DAMREY (Bão số 12 - 2017)', year: 2017, maxWind: '130 km/h (Cấp 12)', province: 'Khánh Hòa - Phú Yên', desc: 'Bão mạnh đổ bộ trực tiếp Khánh Hòa - Nam Trung Bộ tháng 11/2017' },
  { id: 'PRESET_HAIYAN_2013', name: 'HAIYAN (Siêu bão Hải Yến - 2013)', year: 2013, maxWind: '315 km/h (Siêu bão thế kỷ)', province: 'Quảng Ninh', desc: 'Một trong những siêu bão mạnh nhất lịch sử nhân loại càn quét Biển Đông' }
];

export default function ToolTyphoon() {
  // State danh sách bão, presets & bão đang chọn
  const [activeStorms, setActiveStorms] = useState([]);
  const [presets, setPresets] = useState([]);
  const [selectedStormId, setSelectedStormId] = useState('');
  const [stormData, setStormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab & bộ lọc
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'historical' | 'provinces'
  const [bottomTableTab, setBottomTableTab] = useState('forecast'); // 'forecast' | 'observed'
  const [copiedSummary, setCopiedSummary] = useState(false);

  // MapLibre Basemap selection & Keys
  const [selectedBasemap, setSelectedBasemap] = useState('dark_matter');
  const [maptilerKey, setMaptilerKey] = useState(() => localStorage.getItem('maptiler_api_key') || '');
  const [jawgToken, setJawgToken] = useState(() => localStorage.getItem('jawg_access_token') || '');

  // Modal nhập Key cho MapTiler / Jawg
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalType, setKeyModalType] = useState('maptiler'); // 'maptiler' | 'jawg'
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Modal upload file KMZ
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStormName, setUploadStormName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Dữ liệu tham chiếu lịch sử & thống kê tỉnh
  const [provinceMetrics, setProvinceMetrics] = useState([]);
  const [historicalStorms, setHistoricalStorms] = useState([]);
  const [histSearch, setHistSearch] = useState('');
  const [histProvinceFilter, setHistProvinceFilter] = useState('');

  // Tùy chọn hiển thị bản đồ
  const [showWindRadii, setShowWindRadii] = useState(true);
  const [showBestTrack, setShowBestTrack] = useState(true);
  const [showForecastTrack, setShowForecastTrack] = useState(true);
  const [showRadarOverlay, setShowRadarOverlay] = useState(false);
  const [radarData, setRadarData] = useState(null);
  const [radarOpacity, setRadarOpacity] = useState(0.8);

  // Refs MapLibre GL
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentMarkersRef = useRef([]);
  const popupRef = useRef(null);

  // Helper tính style URL hoặc Object cho MapLibre
  const getActiveStyle = (basemapId) => {
    const config = MAPLIBRE_BASEMAPS[basemapId] || MAPLIBRE_BASEMAPS.dark_matter;
    if (config?.requiresKey) {
      const key = config.keyParam === 'maptilerKey' ? maptilerKey : jawgToken;
      return config.getStyle(key);
    }
    return config?.style || MAPLIBRE_BASEMAPS.dark_matter.style;
  };

  // 1. Tải danh sách bão đang hoạt động & presets
  const loadActiveStorms = async (autoSelectFirst = true) => {
    try {
      setLoading(true);
      setError(null);

      // Tải song song bão active và presets
      const [activeRes, presetsRes] = await Promise.allSettled([
        getActiveTyphoons(),
        getTyphoonPresets()
      ]);

      const loadedStorms = activeRes.status === 'fulfilled' && activeRes.value?.success ? (activeRes.value.storms || []) : [];
      const loadedPresets = presetsRes.status === 'fulfilled' && presetsRes.value?.success && presetsRes.value.presets?.length > 0 
        ? presetsRes.value.presets 
        : DEFAULT_PRESETS;

      setActiveStorms(loadedStorms);
      setPresets(loadedPresets);

      if (loadedStorms.length > 0) {
        const priorityStorm = loadedStorms.find(s => s.id !== 'FORMATION' && s.isNorthwestPacific) ||
                              loadedStorms.find(s => s.id !== 'FORMATION') ||
                              loadedStorms[0];

        if (autoSelectFirst && (!selectedStormId || !loadedStorms.some(s => s.id === selectedStormId))) {
          setSelectedStormId(priorityStorm.id);
          await loadStormAnalysis(priorityStorm.id, priorityStorm);
        }
      } else if (loadedPresets.length > 0) {
        // Fallback chọn preset đầu tiên (ví dụ: YAGI 2024) nếu không có bão active
        const firstPreset = loadedPresets[0];
        if (autoSelectFirst && !selectedStormId) {
          setSelectedStormId(firstPreset.id);
          await loadStormAnalysis(firstPreset.id, firstPreset);
        }
      } else {
        setError('Hiện không có cơn bão hoặc áp thấp nhiệt đới nào đang hoạt động trên khu vực.');
      }
    } catch (err) {
      console.error('Lỗi tải bão hoạt động:', err);
      setError(err.message || 'Không thể kết nối đến máy chủ lấy dữ liệu bão');
    } finally {
      setLoading(false);
    }
  };

  // 2. Tải chi tiết & phân tích một cơn bão
  const loadStormAnalysis = async (stormId, stormMeta = null) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (stormMeta?.kmzUrl) params.kmzUrl = stormMeta.kmzUrl;
      if (stormMeta?.textUrl) params.textUrl = stormMeta.textUrl;
      if (stormMeta?.name) params.name = stormMeta.name;

      const res = await getStormDetails(stormId, params);
      if (res.success) {
        setStormData(res);
      } else {
        setError(res.error || 'Không tải được phân tích cơn bão');
      }
    } catch (err) {
      console.error('Lỗi tải phân tích bão:', err);
      setError(err.message || 'Không thể tải phân tích cơn bão');
    } finally {
      setLoading(false);
    }
  };

  // 3. Tải số liệu thống kê tỉnh thành & lịch sử & radar
  useEffect(() => {
    loadActiveStorms();

    getTyphoonProvinceMetrics()
      .then(res => { if (res.success) setProvinceMetrics(res.data || []); })
      .catch(err => console.warn('Lỗi tải metrics tỉnh:', err));

    getHistoricalLandfalls({ minWind: 50 })
      .then(res => { if (res.success) setHistoricalStorms(res.data || []); })
      .catch(err => console.warn('Lỗi tải bão lịch sử:', err));

    fetchLuquetSatloRadar()
      .then(res => { if (res.success && res.data) setRadarData(res.data); })
      .catch(err => console.warn('Lỗi tải radar cho bản đồ bão:', err));
  }, []);

  // Giữ ref stormData và visibility để callback đổi basemap luôn nhận dữ liệu mới nhất
  const stormDataRef = useRef(stormData);
  useEffect(() => {
    stormDataRef.current = stormData;
  }, [stormData]);

  const showWindRadiiRef = useRef(showWindRadii);
  const showBestTrackRef = useRef(showBestTrack);
  const showForecastTrackRef = useRef(showForecastTrack);
  const showRadarOverlayRef = useRef(showRadarOverlay);
  const radarOpacityRef = useRef(radarOpacity);
  const radarDataRef = useRef(radarData);

  useEffect(() => { showWindRadiiRef.current = showWindRadii; }, [showWindRadii]);
  useEffect(() => { showBestTrackRef.current = showBestTrack; }, [showBestTrack]);
  useEffect(() => { showForecastTrackRef.current = showForecastTrack; }, [showForecastTrack]);
  useEffect(() => { showRadarOverlayRef.current = showRadarOverlay; }, [showRadarOverlay]);
  useEffect(() => { radarOpacityRef.current = radarOpacity; }, [radarOpacity]);
  useEffect(() => { radarDataRef.current = radarData; }, [radarData]);

  // Render Radar raster image on MapLibre
  const renderRadarLayer = (map) => {
    if (!map || !map.isStyleLoaded()) return;
    const isRadarActive = showRadarOverlayRef.current || selectedBasemap.startsWith('radar_');
    const frameUrl = radarDataRef.current?.timeline?.[0]?.image_url;

    if (!isRadarActive || !frameUrl) {
      if (map.getLayer('radar-cmax-overlay-layer')) {
        map.setLayoutProperty('radar-cmax-overlay-layer', 'visibility', 'none');
      }
      return;
    }

    const proxyUrl = getRadarProxyUrl(frameUrl);
    const boundsCoords = [
      [97.0, 25.2],  // NW
      [115.0, 25.2], // NE
      [115.0, 7.2],  // SE
      [97.0, 7.2]    // SW
    ];

    const source = map.getSource('radar-cmax-overlay-source');
    if (source && source.updateImage) {
      source.updateImage({
        url: proxyUrl,
        coordinates: boundsCoords
      });
    } else if (!source) {
      map.addSource('radar-cmax-overlay-source', {
        type: 'image',
        url: proxyUrl,
        coordinates: boundsCoords
      });

      const beforeLayer = map.getLayer('storm-wind-radii-fill') ? 'storm-wind-radii-fill' : undefined;
      map.addLayer({
        id: 'radar-cmax-overlay-layer',
        type: 'raster',
        source: 'radar-cmax-overlay-source',
        layout: {
          visibility: 'visible'
        },
        paint: {
          'raster-opacity': radarOpacityRef.current,
          'raster-fade-duration': 0
        }
      }, beforeLayer);
    }

    if (map.getLayer('radar-cmax-overlay-layer')) {
      map.setLayoutProperty('radar-cmax-overlay-layer', 'visibility', 'visible');
      map.setPaintProperty('radar-cmax-overlay-layer', 'raster-opacity', radarOpacityRef.current);
    }
  };

  // 4. Khởi tạo & cập nhật bản đồ MapLibre GL JS khi đổi Basemap
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getActiveStyle(selectedBasemap),
        center: [125.0, 20.0],
        zoom: 4.2,
        attributionControl: false
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (stormDataRef.current) renderStormData(map, stormDataRef.current);
        renderRadarLayer(map);
      });

      mapInstanceRef.current = map;
    } else {
      const map = mapInstanceRef.current;
      map.setStyle(getActiveStyle(selectedBasemap));

      const handleStyleLoaded = () => {
        if (stormDataRef.current) {
          renderStormData(map, stormDataRef.current);
        }
        renderRadarLayer(map);
      };

      map.once('style.load', handleStyleLoaded);
    }

    return () => {
      // Cleanup
    };
  }, [selectedBasemap, maptilerKey, jawgToken]);

  // Effect to update radar layer opacity or toggle
  useEffect(() => {
    if (mapInstanceRef.current) {
      renderRadarLayer(mapInstanceRef.current);
    }
  }, [showRadarOverlay, radarOpacity, radarData, selectedBasemap]);

  // 5. Cập nhật dữ liệu bão lên MapLibre GL
  const renderStormData = (map, data) => {
    if (!map || !data?.geojson?.features) return;
    if (!map.isStyleLoaded()) {
      map.once('style.load', () => renderStormData(map, data));
      return;
    }

    // Gỡ marker HTML cũ
    currentMarkersRef.current.forEach(m => m.remove());
    currentMarkersRef.current = [];

    // Đảm bảo GeoJSON luôn có đầy đủ LineString dự báo và quan trắc
    let enrichedFeatures = [...data.geojson.features];
    
    // Kiểm tra và tổng hợp LineString dự báo nếu chưa có
    const hasForecastTrack = enrichedFeatures.some(f => f.properties?.feature_type === 'forecast_track');
    const forecastPoints = enrichedFeatures
      .filter(f => f.properties?.feature_type === 'forecast_point')
      .sort((a, b) => (a.properties?.tau_h || 0) - (b.properties?.tau_h || 0));

    if (!hasForecastTrack && forecastPoints.length >= 2) {
      const fcCoords = forecastPoints.map(p => p.geometry.coordinates);
      enrichedFeatures.unshift({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: fcCoords },
        properties: {
          feature_type: 'forecast_track',
          feature_name_vn: 'Đường đi dự báo',
          name: 'Forecast Track'
        }
      });
    }

    // Kiểm tra và tổng hợp LineString quan trắc nếu chưa có
    const hasBestTrack = enrichedFeatures.some(f => f.properties?.feature_type === 'best_track');
    const bestPoints = enrichedFeatures
      .filter(f => f.properties?.feature_type === 'best_track_point' || f.properties?.feature_type === 'best_point');

    if (!hasBestTrack && bestPoints.length >= 2) {
      const bestCoords = bestPoints.map(p => p.geometry.coordinates);
      enrichedFeatures.unshift({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: bestCoords },
        properties: {
          feature_type: 'best_track',
          feature_name_vn: 'Đường đi thực tế',
          name: 'Best Track'
        }
      });
    }

    const geojsonData = {
      type: 'FeatureCollection',
      features: enrichedFeatures
    };

    // 1. Quản lý GeoJSON source
    const existingSource = map.getSource('storm-geojson-source');
    if (existingSource) {
      existingSource.setData(geojsonData);
    } else {
      map.addSource('storm-geojson-source', {
        type: 'geojson',
        data: geojsonData
      });
    }

    const vWind = showWindRadiiRef.current ? 'visible' : 'none';
    const vBest = showBestTrackRef.current ? 'visible' : 'none';
    const vForecast = showForecastTrackRef.current ? 'visible' : 'none';

    // 2. Wind radii & Danger Swath (Fill)
    if (!map.getLayer('storm-wind-radii-fill')) {
      map.addLayer({
        id: 'storm-wind-radii-fill',
        type: 'fill',
        source: 'storm-geojson-source',
        filter: ['match', ['get', 'feature_type'], ['wind_radii', 'danger_swath'], true, false],
        layout: {
          visibility: vWind
        },
        paint: {
          'fill-color': [
            'case',
            ['>=', ['coalesce', ['get', 'radii_kt'], 34], 64], '#dc2626',
            ['>=', ['coalesce', ['get', 'radii_kt'], 34], 50], '#ea580c',
            '#f59e0b'
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'feature_type'], 'danger_swath'], 0.12,
            ['>=', ['coalesce', ['get', 'radii_kt'], 34], 64], 0.35,
            ['>=', ['coalesce', ['get', 'radii_kt'], 34], 50], 0.28,
            0.20
          ]
        }
      });
    } else {
      map.setLayoutProperty('storm-wind-radii-fill', 'visibility', vWind);
    }

    // 3. Wind radii border (Line)
    if (!map.getLayer('storm-wind-radii-line')) {
      map.addLayer({
        id: 'storm-wind-radii-line',
        type: 'line',
        source: 'storm-geojson-source',
        filter: ['match', ['get', 'feature_type'], ['wind_radii', 'danger_swath'], true, false],
        layout: {
          visibility: vWind
        },
        paint: {
          'line-color': [
            'case',
            ['>=', ['coalesce', ['get', 'radii_kt'], 34], 64], '#b91c1c',
            ['>=', ['coalesce', ['get', 'radii_kt'], 34], 50], '#c2410c',
            '#d97706'
          ],
          'line-width': 1.8,
          'line-opacity': 0.9
        }
      });
    } else {
      map.setLayoutProperty('storm-wind-radii-line', 'visibility', vWind);
    }

    // 4. Best track glow + line (Solid Blue)
    if (!map.getLayer('storm-best-track-glow')) {
      map.addLayer({
        id: 'storm-best-track-glow',
        type: 'line',
        source: 'storm-geojson-source',
        filter: ['match', ['get', 'feature_type'], ['best_track', 'historic_track'], true, false],
        layout: {
          visibility: vBest,
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 8,
          'line-opacity': 0.25
        }
      });
    } else {
      map.setLayoutProperty('storm-best-track-glow', 'visibility', vBest);
    }

    if (!map.getLayer('storm-best-track-line')) {
      map.addLayer({
        id: 'storm-best-track-line',
        type: 'line',
        source: 'storm-geojson-source',
        filter: ['match', ['get', 'feature_type'], ['best_track', 'historic_track'], true, false],
        layout: {
          visibility: vBest,
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3.5,
          'line-opacity': 0.95
        }
      });
    } else {
      map.setLayoutProperty('storm-best-track-line', 'visibility', vBest);
    }

    // 5. Forecast track glow + line (Dashed Red)
    if (!map.getLayer('storm-forecast-track-glow')) {
      map.addLayer({
        id: 'storm-forecast-track-glow',
        type: 'line',
        source: 'storm-geojson-source',
        filter: ['match', ['get', 'feature_type'], ['forecast_track', 'predicted_track'], true, false],
        layout: {
          visibility: vForecast,
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ef4444',
          'line-width': 8,
          'line-opacity': 0.25
        }
      });
    } else {
      map.setLayoutProperty('storm-forecast-track-glow', 'visibility', vForecast);
    }

    if (!map.getLayer('storm-forecast-track-line')) {
      map.addLayer({
        id: 'storm-forecast-track-line',
        type: 'line',
        source: 'storm-geojson-source',
        filter: ['match', ['get', 'feature_type'], ['forecast_track', 'predicted_track'], true, false],
        layout: {
          visibility: vForecast,
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ef4444',
          'line-width': 3.5,
          'line-opacity': 0.95,
          'line-dasharray': [3, 2]
        }
      });
    } else {
      map.setLayoutProperty('storm-forecast-track-line', 'visibility', vForecast);
    }

    // 6. Best points (Circle - Quan trắc thực tế)
    if (!map.getLayer('storm-best-points-circle')) {
      map.addLayer({
        id: 'storm-best-points-circle',
        type: 'circle',
        source: 'storm-geojson-source',
        filter: ['match', ['get', 'feature_type'], ['best_point', 'best_track_point'], true, false],
        layout: {
          visibility: vBest
        },
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#2563eb',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        }
      });
    } else {
      map.setLayoutProperty('storm-best-points-circle', 'visibility', vBest);
    }

    // 7. Forecast points (Circle - Dự báo tương lai)
    if (!map.getLayer('storm-forecast-points-circle')) {
      map.addLayer({
        id: 'storm-forecast-points-circle',
        type: 'circle',
        source: 'storm-geojson-source',
        filter: ['==', ['get', 'feature_type'], 'forecast_point'],
        layout: {
          visibility: vForecast
        },
        paint: {
          'circle-radius': [
            'case',
            ['==', ['coalesce', ['get', 'tau_h'], 0], 0], 8,
            5.5
          ],
          'circle-color': [
            'case',
            ['==', ['coalesce', ['get', 'tau_h'], 0], 0], '#dc2626',
            ['>=', ['coalesce', ['get', 'wind_kt'], 35], 64], '#ea580c',
            '#f59e0b'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    } else {
      map.setLayoutProperty('storm-forecast-points-circle', 'visibility', vForecast);
    }

    // Tạo Marker tâm bão hiện tại với icon cánh xoay bão (Windy Cyclone Vortex Swirl)
    const currentPointFeature = forecastPoints[0] || enrichedFeatures.find(
      f => f.properties?.feature_type === 'forecast_point' && (f.properties?.tau_h === 0 || f.properties?.tau_h === undefined)
    );

    if (currentPointFeature && currentPointFeature.geometry?.coordinates) {
      const coords = currentPointFeature.geometry.coordinates;
      const el = document.createElement('div');
      el.className = 'current-storm-marker-pulse select-none';
      el.innerHTML = `
        <div class="relative flex items-center justify-center cursor-pointer -translate-x-1/2 -translate-y-1/2 group">
          <!-- Sóng radar mở rộng -->
          <div class="absolute w-14 h-14 rounded-full bg-rose-500/35 animate-ping pointer-events-none"></div>
          
          <!-- Icon cánh xoay bão phong cách Windy (Quay ngược chiều kim đồng hồ) -->
          <div class="w-11 h-11 flex items-center justify-center animate-cyclone-spin drop-shadow-[0_2px_10px_rgba(225,29,72,0.9)]">
            <svg viewBox="0 0 100 100" class="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Cánh xoáy bão trên -->
              <path d="M50 10C70 10 90 28 90 50C90 64 80 76 68 82C58 86 48 86 42 82C32 76 32 62 40 52C48 42 62 46 62 54C62 58 57 62 52 61C48 60 46 56 49 53C52 50 56 50 57 53" 
                    fill="#e11d48" stroke="#ffffff" stroke-width="1.8"/>
              <!-- Cánh xoáy bão dưới -->
              <path d="M50 90C30 90 10 72 10 50C10 36 20 24 32 18C42 14 52 14 58 18C68 24 68 38 60 48C52 58 38 54 38 46C38 42 43 38 48 39C52 40 54 44 51 47C48 50 44 50 43 47" 
                    fill="#f43f5e" stroke="#ffffff" stroke-width="1.8"/>
            </svg>
          </div>
          
          <!-- Tâm mắt bão chính giữa -->
          <div class="absolute w-4 h-4 rounded-full bg-white border-2 border-rose-600 shadow-md flex items-center justify-center pointer-events-none">
            <div class="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></div>
          </div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);

      el.addEventListener('click', () => {
        const p = currentPointFeature.properties;
        new maplibregl.Popup({ offset: 20 })
          .setLngLat(coords)
          .setHTML(`
            <div class="p-1 font-sans text-xs max-w-[220px]">
              <div class="font-bold text-sm text-slate-900 border-b pb-1 mb-1.5 flex justify-between items-center">
                <span>Tâm bão hiện tại</span>
                <span class="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded font-bold">${p.category_code || 'TC'}</span>
              </div>
              <div class="space-y-1 text-slate-700 text-xs">
                <div><strong>Bão:</strong> ${p.storm_name || data.summary?.storm_name || 'DUJUAN'}</div>
                <div><strong>Thời điểm:</strong> ${p.time_vn || 'N/A'}</div>
                <div><strong>Vị trí:</strong> ${coords[1].toFixed(1)}°N, ${coords[0].toFixed(1)}°E</div>
                <div><strong>Sức gió:</strong> <span class="text-rose-600 font-bold">${p.wind_kmh || 0} km/h</span> (${p.wind_kt || 0} kt)</div>
                <div><strong>Cấp bão:</strong> ${p.category || 'Bão'}</div>
              </div>
            </div>
          `)
          .addTo(map);
      });

      currentMarkersRef.current.push(marker);
    }

    // Hover tooltip cho các điểm dự báo
    map.on('mouseenter', 'storm-forecast-points-circle', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features || !e.features[0]) return;
      const f = e.features[0];
      const p = f.properties;
      const coords = f.geometry.coordinates.slice();

      if (!popupRef.current) {
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      }
      popupRef.current
        .setLngLat(coords)
        .setHTML(`
          <div class="p-1.5 font-sans text-xs">
            <div class="font-bold text-slate-900 mb-0.5">${p.tau_h === 0 || p.tau_h === '0' ? 'Tâm bão hiện tại' : `Dự báo +${p.tau_h}h`}</div>
            <div class="text-slate-600 text-[11px]">Thời gian: ${p.time_vn || ''}</div>
            <div class="text-rose-600 font-bold mt-0.5">Sức gió: ${p.wind_kmh || 0} km/h (${p.wind_kt || 0} kt) - ${p.category || ''}</div>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseleave', 'storm-forecast-points-circle', () => {
      map.getCanvas().style.cursor = '';
      if (popupRef.current) popupRef.current.remove();
    });

    // Hover tooltip cho các điểm quan trắc thực tế (Best Track)
    map.on('mouseenter', 'storm-best-points-circle', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features || !e.features[0]) return;
      const f = e.features[0];
      const p = f.properties;
      const coords = f.geometry.coordinates.slice();

      if (!popupRef.current) {
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      }
      popupRef.current
        .setLngLat(coords)
        .setHTML(`
          <div class="p-1.5 font-sans text-xs">
            <div class="font-bold text-blue-900 mb-0.5">Quan trắc quá khứ</div>
            <div class="text-slate-600 text-[11px]">Thời gian: ${p.time_vn || ''}</div>
            <div class="text-blue-600 font-bold mt-0.5">Sức gió: ${p.wind_kmh || 0} km/h (${p.wind_kt || 0} kt) - ${p.category || ''}</div>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseleave', 'storm-best-points-circle', () => {
      map.getCanvas().style.cursor = '';
      if (popupRef.current) popupRef.current.remove();
    });

    // Tự động căn khung (Fit Bounds) bọc trọn vùng bão
    const allCoords = [];
    enrichedFeatures.forEach(f => {
      if (f.geometry?.type === 'Point') {
        allCoords.push(f.geometry.coordinates);
      } else if (f.geometry?.type === 'LineString') {
        f.geometry.coordinates.forEach(c => allCoords.push(c));
      } else if (f.geometry?.type === 'Polygon') {
        if (f.geometry.coordinates[0]) {
          f.geometry.coordinates[0].forEach(c => allCoords.push(c));
        }
      }
    });

    if (allCoords.length > 0) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      allCoords.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      });

      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        maxZoom: 7.5,
        duration: 800
      });
    }
  };

  // 6. Cập nhật khi stormData thay đổi
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      renderStormData(map, stormData);
    } else {
      map.once('style.load', () => renderStormData(map, stormData));
    }
  }, [stormData]);

  // 7. Bật/Tắt các lớp bản đồ tương ứng
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('storm-wind-radii-fill')) {
      map.setLayoutProperty('storm-wind-radii-fill', 'visibility', showWindRadii ? 'visible' : 'none');
    }
    if (map.getLayer('storm-wind-radii-line')) {
      map.setLayoutProperty('storm-wind-radii-line', 'visibility', showWindRadii ? 'visible' : 'none');
    }
    if (map.getLayer('storm-best-track-glow')) {
      map.setLayoutProperty('storm-best-track-glow', 'visibility', showBestTrack ? 'visible' : 'none');
    }
    if (map.getLayer('storm-best-track-line')) {
      map.setLayoutProperty('storm-best-track-line', 'visibility', showBestTrack ? 'visible' : 'none');
    }
    if (map.getLayer('storm-best-points-circle')) {
      map.setLayoutProperty('storm-best-points-circle', 'visibility', showBestTrack ? 'visible' : 'none');
    }
    if (map.getLayer('storm-forecast-track-glow')) {
      map.setLayoutProperty('storm-forecast-track-glow', 'visibility', showForecastTrack ? 'visible' : 'none');
    }
    if (map.getLayer('storm-forecast-track-line')) {
      map.setLayoutProperty('storm-forecast-track-line', 'visibility', showForecastTrack ? 'visible' : 'none');
    }
    if (map.getLayer('storm-forecast-points-circle')) {
      map.setLayoutProperty('storm-forecast-points-circle', 'visibility', showForecastTrack ? 'visible' : 'none');
    }
  }, [showWindRadii, showBestTrack, showForecastTrack]);

  // 8. Xử lý đổi Basemap
  const handleBasemapChange = (basemapId) => {
    const config = MAPLIBRE_BASEMAPS[basemapId];
    if (config?.requiresKey) {
      const currentKey = config.keyParam === 'maptilerKey' ? maptilerKey : jawgToken;
      if (!currentKey) {
        openKeyModal(config.keyParam === 'maptilerKey' ? 'maptiler' : 'jawg');
      }
    }
    setSelectedBasemap(basemapId);
  };

  const openKeyModal = (type) => {
    setKeyModalType(type);
    setTempKeyInput(type === 'maptiler' ? maptilerKey : jawgToken);
    setShowKeyModal(true);
  };

  const saveKeyModal = () => {
    const trimmed = tempKeyInput.trim();
    if (keyModalType === 'maptiler') {
      setMaptilerKey(trimmed);
      localStorage.setItem('maptiler_api_key', trimmed);
    } else {
      setJawgToken(trimmed);
      localStorage.setItem('jawg_access_token', trimmed);
    }
    setShowKeyModal(false);

    // Áp dụng ngay style mới lên MapLibre mà không cần reload trang
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const targetBasemap = selectedBasemap;
      const config = MAPLIBRE_BASEMAPS[targetBasemap] || MAPLIBRE_BASEMAPS.maptiler_dark;
      
      let nextStyle;
      if (config?.requiresKey) {
        const activeKey = keyModalType === 'maptiler' ? trimmed : (config.keyParam === 'maptilerKey' ? maptilerKey : trimmed);
        nextStyle = config.getStyle(activeKey);
      } else {
        nextStyle = config?.style;
      }

      if (nextStyle) {
        map.setStyle(nextStyle);
        map.once('style.load', () => {
          if (stormDataRef.current) {
            renderStormData(map, stormDataRef.current);
          }
        });
      }
    }
  };

  // 9. Xử lý Upload file KMZ
  const handleUploadKmz = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      setUploading(true);
      setError(null);
      const res = await uploadTyphoonKmz(uploadFile, uploadStormName);
      if (res.success) {
        setStormData(res);
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadStormName('');
      } else {
        setError(res.error || 'Không phân tích được file KMZ');
      }
    } catch (err) {
      console.error('Lỗi upload KMZ:', err);
      setError(err.message || 'Lỗi khi tải lên file KMZ');
    } finally {
      setUploading(false);
    }
  };

  // 10. Copy tóm tắt nhanh bản tin bão
  const handleCopySummary = () => {
    if (!stormData) return;
    const cur = stats;
    const land = landfall || {};

    const text = `BẢN TIN DỰ BÁO BÃO (${meta.storm_name || meta.name || 'CẬP NHẬT'})
• Vị trí hiện tại (${cur.time_vn || 'N/A'}): Tâm bão ở khoảng ${cur.lat}°N; ${cur.lon || cur.lng}°E.
• Cường độ: Sức gió mạnh nhất ${cur.wind_kmh || 0} km/h (${cur.wind_kt || 0} kt), ${cur.category || 'Bão'}.
• Cường độ cực đại dự kiến: ${stormData.summary?.peak_forecast?.wind_kmh || cur.wind_kmh || 0} km/h (${stormData.summary?.peak_forecast?.wind_kt || cur.wind_kt || 0} kt).
• Đánh giá đổ bộ đất liền: ${land.estimated ? `Cảnh báo đổ bộ ${land.province} trong khoảng ${land.time_window?.join(' - ')}, gió chạm bờ ${land.wind_kmh} km/h.` : (land.note || 'Chưa có nguy cơ đổ bộ trực tiếp vào đất liền.')}
(Nguồn: Mô hình JTWC / Xử lý tự động Typhoon Hub)`.trim();

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // 11. Tải về file GeoJSON bão
  const handleDownloadGeoJson = () => {
    if (!stormData?.geojson) return;
    const blob = new Blob([JSON.stringify(stormData.geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `typhoon_${stormData.summary?.storm_name || 'track'}_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper chuẩn hóa tên tỉnh thành
  const normalizeProvinceName = (prov) => {
    if (!prov) return 'Việt Nam';
    const trimmed = String(prov).trim();
    const mapShort = {
      'Yên': 'Hưng Yên',
      'Tĩnh': 'Hà Tĩnh',
      'Lắk': 'Đắk Lắk',
      'Ninh': 'Quảng Ninh',
      'Phòng': 'Hải Phòng',
      'Trị': 'Quảng Trị',
      'Nẵng': 'Đà Nẵng',
      'Lai': 'Gia Lai',
      'Sơn': 'Lạng Sơn',
      'Hòa': 'Khánh Hòa',
      'Bằng': 'Cao Bằng',
      'BÌnh': 'Ninh Bình',
      'Bình': 'Quảng Bình',
      'Ngãi': 'Quảng Ngãi',
      'Nam': 'Quảng Nam',
      'Thanh': 'Thanh Hóa',
      'Huế': 'Thừa Thiên Huế',
      'Thuận': 'Bình Thuận',
      'Nông': 'Đắk Nông',
      'Tàu': 'Bà Rịa - Vũng Tàu',
      'Nai': 'Đồng Nai',
      'Định': 'Bình Định',
      'Thơ': 'Cần Thơ',
      'Giang': 'Kiên Giang',
      'Tre': 'Bến Tre',
      'Liêu': 'Bạc Liêu',
      'Trăng': 'Sóc Trăng',
      'Mau': 'Cà Mau',
      'Long': 'Vĩnh Long',
      'Tháp': 'Đồng Tháp',
      'Hải': 'Hải Dương',
      'Bắc': 'Bắc Giang'
    };
    const cleaned = trimmed.replace(/^(tỉnh|thành phố)\s+/i, '').trim();
    if (mapShort[cleaned]) return mapShort[cleaned];
    if (mapShort[trimmed]) return mapShort[trimmed];
    return cleaned;
  };

  // Thông số hiển thị Cards
  const meta = stormData?.summary || stormData?.storm_meta || {};
  const currentPos = stormData?.summary?.current_position || stormData?.current_stats || {};
  const peakPos = stormData?.summary?.peak_forecast || {};
  const stats = {
    lat: currentPos.lat !== undefined && currentPos.lat !== null ? currentPos.lat : null,
    lng: currentPos.lon ?? currentPos.lng ?? null,
    wind_kmh: currentPos.wind_kmh ?? 0,
    wind_kt: currentPos.wind_kt ?? 0,
    category: currentPos.category || 'Áp thấp / Bão',
    time_vn: currentPos.time_vn || '',
    peak_wind_kmh: peakPos.wind_kmh || currentPos.wind_kmh || 0,
    peak_wind_kt: peakPos.wind_kt || currentPos.wind_kt || 0,
    peak_time_vn: peakPos.time_vn || currentPos.time_vn || ''
  };
  const landfall = stormData?.landfall || stormData?.landfall_assessment;

  // Benchmark & thống kê lịch sử
  const benchmark = stormData?.historical || stormData?.historical_benchmark || {};
  const percentile = benchmark.percentile ?? benchmark.peak_forecast_percentile ?? 0;
  const meanWind = benchmark.mean_wind ?? benchmark.historical_wind_stats?.mean_kph ?? benchmark.historical_wind_stats?.mean_wind ?? 81.8;
  const maxWind = benchmark.max_wind ?? benchmark.historical_wind_stats?.max_kph ?? benchmark.historical_wind_stats?.max_wind ?? 196.4;
  const p90Wind = benchmark.p90 ?? benchmark.historical_wind_stats?.p90_kph ?? benchmark.historical_wind_stats?.p90 ?? 130.2;

  // Lọc bão tương tự (Tự động fallback tính toán từ historicalStorms nếu backend trả về rỗng)
  const similarHistorical = useMemo(() => {
    const rawList = benchmark.similar_intensity_storms || 
                    benchmark.similar_storms || 
                    stormData?.historical?.similar_intensity_storms || 
                    stormData?.historical_benchmark?.similar_intensity_storms ||
                    stormData?.historical_benchmark?.similar_storms ||
                    [];

    if (rawList && rawList.length > 0) {
      return rawList.map(s => ({
        name: s.name || s.NAME || 'Bão',
        year: s.year || 2020,
        landfall_time: s.landfall_time || s.calc_landfall_time || '',
        wind_kmh: s.wind_kmh ?? s.wind_kph ?? s.wind_at_landfall_kph ?? 0,
        wind_kt: s.wind_kt ?? Math.round((s.wind_kmh || s.wind_kph || s.wind_at_landfall_kph || 0) / 1.852),
        province: normalizeProvinceName(s.province || s.province_landfall || 'Việt Nam'),
        hours_on_land: s.hours_on_land ?? s.time_on_land_h ?? 0
      }));
    }

    // Dynamic Fallback: Nếu backend chưa có hoặc chưa trả về list, tự động lọc 10 bão tương đồng từ danh sách 500+ bão đã tải
    if (historicalStorms && historicalStorms.length > 0) {
      const targetWind = stats.peak_wind_kmh || stats.wind_kmh || 120.4;
      return historicalStorms
        .filter(s => {
          const w = s.wind_kmh ?? s.wind_at_landfall_kph ?? s.wind_kph ?? 0;
          return Math.abs(w - targetWind) <= 25;
        })
        .sort((a, b) => b.year - a.year)
        .slice(0, 10)
        .map(s => ({
          name: s.name || s.NAME || 'Bão',
          year: s.year,
          landfall_time: s.landfall_time || s.calc_landfall_time || '',
          wind_kmh: s.wind_kmh ?? s.wind_at_landfall_kph ?? s.wind_kph ?? 0,
          wind_kt: s.wind_kt ?? Math.round((s.wind_kmh || s.wind_at_landfall_kph || 0) / 1.852),
          province: normalizeProvinceName(s.province || s.province_landfall || 'Việt Nam'),
          hours_on_land: s.hours_on_land ?? s.time_on_land_h ?? 0
        }));
    }

    return [];
  }, [benchmark, stormData, historicalStorms, stats.peak_wind_kmh, stats.wind_kmh]);

  // Lọc danh sách 500+ bão lịch sử
  const filteredHistoricalStorms = useMemo(() => {
    return historicalStorms.map(s => ({
      ...s,
      normalizedProvince: normalizeProvinceName(s.province || s.province_landfall)
    })).filter(s => {
      const name = s.name || s.NAME || '';
      const year = s.year ? s.year.toString() : '';
      const province = s.normalizedProvince || '';
      const matchSearch = !histSearch || 
        name.toLowerCase().includes(histSearch.toLowerCase()) ||
        year.includes(histSearch) ||
        province.toLowerCase().includes(histSearch.toLowerCase());
      const matchProv = !histProvinceFilter || province.toLowerCase().includes(histProvinceFilter.toLowerCase());
      return matchSearch && matchProv;
    });
  }, [historicalStorms, histSearch, histProvinceFilter]);

  // Danh sách các điểm dự báo & quan trắc
  const forecastPointsList = useMemo(() => {
    if (!stormData?.geojson?.features) return [];
    return stormData.geojson.features
      .filter(f => f.properties?.feature_type === 'forecast_point')
      .sort((a, b) => (a.properties?.tau_h || 0) - (b.properties?.tau_h || 0));
  }, [stormData]);

  const bestTrackPointsList = useMemo(() => {
    if (!stormData?.geojson?.features) return [];
    return stormData.geojson.features
      .filter(f => f.properties?.feature_type === 'best_track_point' || f.properties?.feature_type === 'best_point');
  }, [stormData]);

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-rose-600 text-white rounded-2xl shadow-md">
            <Wind className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Theo dõi & Phân tích Bão (Typhoon Hub)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                MapLibre GL & Protomaps
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Nền tảng bản đồ vector WebGL hiệu năng cao kết hợp dữ liệu cảnh báo bão thời gian thực từ JTWC (Mỹ) & Kho dữ liệu 500+ bão lịch sử Việt Nam.
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Storm selector */}
          <div className="relative min-w-[240px]">
            <select
              value={selectedStormId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedStormId(id);
                const s = activeStorms.find(item => item.id === id) || presets.find(item => item.id === id);
                if (s) loadStormAnalysis(id, s);
              }}
              disabled={loading && !stormData}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
            >
              {activeStorms.length > 0 && (
                <optgroup label="🔴 Bão đang hoạt động (JTWC / JMA)">
                  {activeStorms.map(s => (
                    <option key={s.id} value={s.id}>
                      🌀 {s.name} ({s.id}) - Đang hoạt động
                    </option>
                  ))}
                </optgroup>
              )}

              {presets.length > 0 && (
                <optgroup label="📚 Siêu bão lịch sử tiêu biểu (Presets)">
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>
                      🌪️ {p.name}
                    </option>
                  ))}
                </optgroup>
              )}

              {activeStorms.length === 0 && presets.length === 0 && (
                <option value="">Không có dữ liệu bão</option>
              )}
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => loadActiveStorms(false)}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
            title="Làm mới dữ liệu từ JTWC"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Upload KMZ button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Nạp file KMZ</span>
          </button>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 text-amber-600 hover:text-amber-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* QUICK STATS CARDS */}
      {stormData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TÂM BÃO HIỆN TẠI */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Tâm bão ({meta.storm_name || meta.name || 'Bão'})</span>
              <MapPin className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
              {stats.lat !== null && stats.lng !== null 
                ? `${Math.abs(stats.lat).toFixed(1)}°${stats.lat >= 0 ? 'N' : 'S'} - ${Math.abs(stats.lng).toFixed(1)}°${stats.lng >= 0 ? 'E' : 'W'}` 
                : 'Đang cập nhật'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Thời điểm: <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.time_vn || 'N/A'}</span>
            </div>
          </div>

          {/* CƯỜNG ĐỘ HIỆN TẠI */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Cường độ hiện tại</span>
              <Gauge className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.wind_kmh || 0}
              </span>
              <span className="text-xs text-slate-500">km/h ({stats.wind_kt || 0} kt)</span>
            </div>
            <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-1">
              {stats.category || 'Áp thấp / Bão'}
            </div>
          </div>

          {/* CỰC ĐẠI DỰ KIẾN (PEAK) */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Cực đại dự kiến (Peak)</span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.peak_wind_kmh || stats.wind_kmh || 0}
              </span>
              <span className="text-xs text-slate-500">km/h ({stats.peak_wind_kt || stats.wind_kt || 0} kt)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Khoảng: <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.peak_time_vn || 'N/A'}</span>
            </div>
          </div>

          {/* XẾP HẠNG LỊCH SỬ VIỆT NAM */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Tương quan lịch sử VN</span>
              <BarChart3 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
              {percentile > 0 ? `Top ${(100 - percentile).toFixed(1)}%` : 'Tham chiếu'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Mạnh hơn <span className="font-semibold text-slate-700 dark:text-slate-300">{percentile}%</span> bão lịch sử (1950 - 2025)
            </div>
          </div>
        </div>
      )}

      {/* LANDFALL WARNING BANNER */}
      {landfall && (
        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          landfall.estimated 
            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-100'
            : 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${landfall.estimated ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>{landfall.estimated ? 'CẢNH BÁO NGUY CƠ ĐỔ BỘ ĐẤT LIỀN VIỆT NAM' : 'DỰ BÁO ĐỔ BỘ ĐẤT LIỀN VIỆT NAM'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${landfall.estimated ? 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200' : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'}`}>
                  {landfall.estimated ? 'NGUY CƠ CAO' : 'CHƯA CÓ NGUY CƠ'}
                </span>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                {landfall.estimated 
                  ? `Đường dự báo cho thấy tâm bão có thể ảnh hưởng trực tiếp tới khu vực ${landfall.province} trong khoảng ${landfall.time_window?.[0]} → ${landfall.time_window?.[1]}. Sức gió chạm bờ dự kiến khoảng ${landfall.wind_kmh} km/h (${landfall.category}).`
                  : (landfall.note || 'Tâm bão di chuyển lệch ra ngoài hoặc chưa cắt qua đất liền Việt Nam theo dữ liệu dự báo 5 ngày.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? 'Đã sao chép' : 'Copy tin nhanh'}</span>
            </button>
            <button
              onClick={handleDownloadGeoJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              title="Tải GeoJSON phục vụ đồ họa bản đồ (QGIS / Mapbox)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất GeoJSON</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT: MAP (LEFT) & ANALYSIS PANELS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CỘT TRÁI: BẢN ĐỒ TƯƠNG TÁC (7 COLUMNS) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col h-[650px]">
            {/* Map Header with MapLibre Basemap Switcher & Layer Toggles */}
            <div className="p-3.5 px-4 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
              {/* MapLibre Basemap Selector */}
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Basemap:</span>
                <select
                  value={selectedBasemap}
                  onChange={(e) => handleBasemapChange(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer shadow-2xs"
                >
                  <optgroup label="📡 Basemap Radar Thời Tiết (KTTV)">
                    <option value="radar_cmax">📡 Radar Thời Tiết CMAX (Nền Tối)</option>
                    <option value="radar_satellite">🛰️ Vệ Tinh + Radar CMAX</option>
                  </optgroup>
                  <optgroup label="⚡ Vector WebGL Tự Do (Không cần Key)">
                    <option value="dark_matter">🌙 ESRI Dark Canvas (Tối - Chuẩn khí tượng)</option>
                    <option value="positron">☀️ ESRI Light Canvas (Sáng Tinh Tế)</option>
                    <option value="satellite">🛰️ Vệ Tinh Thực Tế (ESRI)</option>
                    <option value="voyager">🧭 Carto Voyager (Chi tiết địa giới)</option>
                    <option value="osm">🗺️ OpenStreetMap Standard</option>
                    <option value="maplibre_demo">🌐 MapLibre Open Vector</option>
                  </optgroup>
                  <optgroup label="🔑 Vector Tùy Biến (Key / Style URL)">
                    <option value="maptiler_dark">🗺️ MapTiler Dataviz Dark / Custom</option>
                    <option value="maptiler_streets">🏙️ MapTiler Streets</option>
                    <option value="custom_style">🎨 Custom Style JSON URL</option>
                    <option value="jawg_dark">🐆 Jawg Maps Dark</option>
                    <option value="jawg_sunny">☀️ Jawg Maps Sunny</option>
                  </optgroup>
                </select>

                {/* Key Config Button for MapTiler / Custom Style / Jawg */}
                {MAPLIBRE_BASEMAPS[selectedBasemap]?.requiresKey && (
                  <button
                    onClick={() => openKeyModal(MAPLIBRE_BASEMAPS[selectedBasemap].keyParam === 'maptilerKey' ? 'maptiler' : 'jawg')}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md text-[11px] font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                    title="Cấu hình API Key hoặc dán toàn bộ Style JSON URL"
                  >
                    <Key className="w-3 h-3" />
                    <span>{maptilerKey || jawgToken ? 'Đổi Key / URL' : 'Nhập Key / URL'}</span>
                  </button>
                )}
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showRadarOverlay || selectedBasemap.startsWith('radar_')}
                    onChange={(e) => setShowRadarOverlay(e.target.checked)}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  <span className="flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    Lớp Radar CMAX
                  </span>
                </label>

                {(showRadarOverlay || selectedBasemap.startsWith('radar_')) && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-lg text-[11px]" title="Độ trong suốt của lớp Radar">
                    <Sliders className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span className="font-mono text-cyan-700 dark:text-cyan-300">{Math.round(radarOpacity * 100)}%</span>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={radarOpacity}
                      onChange={(e) => setRadarOpacity(parseFloat(e.target.value))}
                      className="w-14 accent-cyan-600 cursor-pointer"
                    />
                  </div>
                )}

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showWindRadii}
                    onChange={(e) => setShowWindRadii(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span>Vùng gió bão</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showForecastTrack}
                    onChange={(e) => setShowForecastTrack(e.target.checked)}
                    className="rounded text-rose-500 focus:ring-0"
                  />
                  <span>Đường dự báo ({forecastPointsList.length} điểm)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showBestTrack}
                    onChange={(e) => setShowBestTrack(e.target.checked)}
                    className="rounded text-blue-500 focus:ring-0"
                  />
                  <span>Đường thực tế ({bestTrackPointsList.length} điểm)</span>
                </label>
              </div>
            </div>

            {/* Map Viewport Container */}
            <div className="relative flex-1 w-full h-full min-h-[480px]">
              <div ref={mapContainerRef} className="w-full h-full z-0" />

              {/* Map Legend (Chú giải góc bản đồ) */}
              <div className="absolute bottom-4 left-4 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-lg text-[11px] space-y-1.5 pointer-events-none select-none">
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
                  <span>Chú giải bản đồ:</span>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
                    MapLibre Vector
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-600 inline-block border border-white"></span>
                  <span className="text-slate-600 dark:text-slate-300">Đường thực tế quan trắc</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1 border-t-2 border-dashed border-rose-600 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Đường dự báo 5 ngày (JTWC)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-amber-400/50 border border-amber-600 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Vùng gió ≥ 34 kt (Cấp 8)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-orange-400/50 border border-orange-600 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Vùng gió ≥ 50 kt (Cấp 10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-rose-500/50 border border-rose-700 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Vùng gió ≥ 64 kt (Cấp 12)</span>
                </div>
              </div>
            </div>
          </div>

          {/* DỰ BÁO THEO TỪNG MỐC THỜI GIAN (TAU POINTS & OBSERVED POINTS TABLE) */}
          {stormData?.geojson?.features && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBottomTableTab('forecast')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      bottomTableTab === 'forecast'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Mốc dự báo ({forecastPointsList.length} điểm)</span>
                  </button>

                  {bestTrackPointsList.length > 0 && (
                    <button
                      onClick={() => setBottomTableTab('observed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        bottomTableTab === 'observed'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Quan trắc thực tế ({bestTrackPointsList.length} điểm)</span>
                    </button>
                  )}
                </div>

                <span className="text-[11px] text-slate-400">
                  {bottomTableTab === 'forecast' ? 'Mô hình JTWC 0h - 120h' : 'Dữ liệu Best Track'}
                </span>
              </div>

              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-2.5">Mốc thời gian</th>
                      <th className="py-2 px-2.5">Thời gian (VN)</th>
                      <th className="py-2 px-2.5">Tọa độ</th>
                      <th className="py-2 px-2.5">Sức gió</th>
                      <th className="py-2 px-2.5">Cấp bão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bottomTableTab === 'forecast' ? (
                      forecastPointsList.map((f, i) => {
                        const p = f.properties;
                        const coords = f.geometry?.coordinates || [0, 0];
                        return (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="py-2 px-2.5 font-bold">
                              {p.tau_h === 0 || p.tau_h === '0' ? (
                                <span className="text-rose-600 dark:text-rose-400">Tâm hiện tại</span>
                              ) : (
                                `+${p.tau_h} giờ`
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">{p.time_vn || 'N/A'}</td>
                            <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500">
                              {coords[1]?.toFixed(1)}°N, {coords[0]?.toFixed(1)}°E
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-slate-800 dark:text-slate-200">
                              {p.wind_kmh} km/h <span className="text-slate-400 text-[11px]">({p.wind_kt} kt)</span>
                            </td>
                            <td className="py-2 px-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.wind_kt >= 64 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                                p.wind_kt >= 50 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {p.category || 'Áp thấp'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      bestTrackPointsList.map((f, i) => {
                        const p = f.properties;
                        const coords = f.geometry?.coordinates || [0, 0];
                        return (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="py-2 px-2.5 font-bold text-blue-600 dark:text-blue-400">
                              Quan trắc #{i + 1}
                            </td>
                            <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">{p.time_vn || 'N/A'}</td>
                            <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500">
                              {coords[1]?.toFixed(1)}°N, {coords[0]?.toFixed(1)}°E
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-slate-800 dark:text-slate-200">
                              {p.wind_kmh} km/h <span className="text-slate-400 text-[11px]">({p.wind_kt} kt)</span>
                            </td>
                            <td className="py-2 px-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {p.category || 'Quan trắc'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: PHÂN TÍCH SO SÁNH & THỐNG KÊ (5 COLUMNS) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* TABS SELECTOR */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Bão tương tự
            </button>
            <button
              onClick={() => setActiveTab('provinces')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'provinces' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tần suất tỉnh
            </button>
            <button
              onClick={() => setActiveTab('historical')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'historical' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Kho 500+ bão
            </button>
          </div>

          {/* TAB 1: BÃO TƯƠNG TỰ CÙNG CƯỜNG ĐỘ TRONG LỊCH SỬ */}
          {activeTab === 'overview' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Bão lịch sử có cường độ tương đồng (±20 km/h)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">1950 - 2025</span>
              </div>
              <p className="text-[11px] text-slate-500">
                So sánh với bão có sức gió đổ bộ xấp xỉ {stats.peak_wind_kmh || stats.wind_kmh || 120} km/h để đánh giá kịch bản thiệt hại thực tế.
              </p>

              {/* Thống kê nhanh benchmark */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px]">
                <div>
                  <div className="text-slate-500">Gió TB đổ bộ:</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{meanWind} km/h</div>
                </div>
                <div>
                  <div className="text-slate-500">Mạnh nhất VN:</div>
                  <div className="font-bold text-rose-600 dark:text-rose-400">{maxWind} km/h</div>
                </div>
                <div>
                  <div className="text-slate-500">Mốc P90:</div>
                  <div className="font-bold text-amber-600 dark:text-amber-400">{p90Wind} km/h</div>
                </div>
              </div>

              {/* Danh sách bão tương tự */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {similarHistorical.length > 0 ? (
                  similarHistorical.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          {s.name || s.NAME} ({s.year})
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {s.wind_kmh || s.wind_kph} km/h
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span>Đổ bộ: <strong>{s.province || s.province_landfall || 'Việt Nam'}</strong> • {s.landfall_time?.split(' ')[0]}</span>
                        <span>{s.hours_on_land ?? s.time_on_land_h ?? 0}h trên bờ</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Chưa có dữ liệu bão so sánh tương đương
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TẦN SUẤT BÃO THEO TỈNH THÀNH */}
          {activeTab === 'provinces' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Thống kê bão đổ bộ theo tỉnh (1950 - 2025)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">{provinceMetrics.length} tỉnh thành</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Dữ liệu tần suất bão đổ bộ trực tiếp và số lần bão quét qua từng địa phương ven biển Việt Nam.
              </p>

              <div className="max-h-[460px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 text-[11px]">
                      <th className="py-2 px-2">Tỉnh / Thành</th>
                      <th className="py-2 px-2 text-center">Đổ bộ</th>
                      <th className="py-2 px-2 text-center">Quét qua</th>
                      <th className="py-2 px-2 text-right">Gió TB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {provinceMetrics.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-2 px-2 font-semibold text-slate-800 dark:text-slate-200">
                          {p.province}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                            {p.direct_landfall_count ?? p.landfall_count ?? 0}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">
                          {p.crossed_count ?? p.swath_count ?? 0}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {p.avg_wind_kph ?? p.avg_wind_kmh ?? 0} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TRA CỨU KHO 500+ CƠN BÃO LỊCH SỬ */}
          {activeTab === 'historical' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Kho dữ liệu 500+ bão đổ bộ Việt Nam
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">{filteredHistoricalStorms.length} bản ghi</span>
              </div>

              {/* BỘ LỌC TÌM KIẾM */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Tìm tên bão, năm..."
                  value={histSearch}
                  onChange={(e) => setHistSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Lọc theo tỉnh..."
                  value={histProvinceFilter}
                  onChange={(e) => setHistProvinceFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* BẢNG BÃO LỊCH SỬ */}
              <div className="max-h-[410px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 text-[11px]">
                      <th className="py-2 px-2">Bão</th>
                      <th className="py-2 px-2">Năm</th>
                      <th className="py-2 px-2">Tỉnh đổ bộ</th>
                      <th className="py-2 px-2 text-right">Sức gió</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {filteredHistoricalStorms.slice(0, 100).map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-2 px-2 font-bold text-slate-800 dark:text-slate-200">
                          {s.name || s.NAME || 'UNNAMED'}
                        </td>
                        <td className="py-2 px-2 text-slate-500">{s.year}</td>
                        <td className="py-2 px-2 text-slate-700 dark:text-slate-300 font-medium">
                          {s.normalizedProvince || 'N/A'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {s.wind_kmh || s.wind_at_landfall_kph || 0} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CẤU HÌNH KEY / STYLE JSON URL */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {keyModalType === 'maptiler' ? 'Cấu hình MapTiler API Key / Style JSON URL' : 'Cấu hình Jawg Access Token'}
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {keyModalType === 'maptiler'
                ? 'Nhập API Key MapTiler (lấy tại cloud.maptiler.com) HOẶC dán trực tiếp toàn bộ link Style JSON URL (từ MapTiler Cloud Studio / Custom Style). Hệ thống sẽ tự động nhận diện và cập nhật giao diện bản đồ ngay lập tức.'
                : 'Nhập Access Token từ tài khoản Jawg Maps của bạn (lấy tại jawg.io) hoặc dán link Style JSON.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {keyModalType === 'maptiler' ? 'MapTiler API Key hoặc Style JSON URL' : 'Jawg Access Token hoặc Style JSON URL'}
              </label>
              <textarea
                rows={3}
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder={keyModalType === 'maptiler' ? 'VD: HxvGLxEoKQ... hoặc https://api.maptiler.com/maps/.../style.json?key=...' : 'VD: your_jawg_access_token'}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveKeyModal}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Lưu Key & Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẢI FILE KMZ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tải lên File KMZ từ JTWC
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadKmz} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn file KMZ cảnh báo bão (.kmz)
                </label>
                <input
                  type="file"
                  accept=".kmz"
                  required
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên bão (tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="VD: YAGI, DUJUAN, 24W..."
                  value={uploadStormName}
                  onChange={(e) => setUploadStormName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                  <span>{uploading ? 'Đang phân tích...' : 'Phân tích ngay'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
