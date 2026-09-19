import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { 
  Wind, Eye, Compass, CloudRain, AlertTriangle, Gauge, Clock, MapPin, 
  TrendingUp, BarChart3, UploadCloud, FileText, Download, Copy, Check, 
  RefreshCw, Sliders, ShieldAlert, Layers, ExternalLink, ChevronRight,
  Info, Sparkles, Navigation, Globe, Palette, Key, X
} from 'lucide-react';
import { 
  getActiveTyphoons, 
  getStormDetails, 
  uploadTyphoonKmz, 
  getHistoricalLandfalls, 
  getTyphoonProvinceMetrics 
} from '../services/api';
import { MAPLIBRE_BASEMAPS } from '../services/maplibreBasemaps';

export default function ToolTyphoon() {
  // State danh sách bão & bão đang chọn
  const [activeStorms, setActiveStorms] = useState([]);
  const [selectedStormId, setSelectedStormId] = useState('');
  const [stormData, setStormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab & bộ lọc
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'historical' | 'provinces'
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

  // Refs MapLibre GL
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentMarkersRef = useRef([]);
  const popupRef = useRef(null);

  // Helper tính style URL hoặc Object cho MapLibre
  const getActiveStyle = (basemapId) => {
    const config = MAPLIBRE_BASEMAPS[basemapId] || MAPLIBRE_BASEMAPS.dark_matter;
    if (config.requiresKey) {
      const key = config.keyParam === 'maptilerKey' ? maptilerKey : jawgToken;
      return config.getStyle(key);
    }
    return config.style;
  };

  // 1. Tải danh sách bão đang hoạt động từ JTWC
  const loadActiveStorms = async (autoSelectFirst = true) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getActiveTyphoons();
      if (res.success && res.storms?.length > 0) {
        setActiveStorms(res.storms);
        const priorityStorm = res.storms.find(s => s.id !== 'FORMATION' && s.isNorthwestPacific) ||
                              res.storms.find(s => s.id !== 'FORMATION') ||
                              res.storms[0];
        if (autoSelectFirst && (!selectedStormId || !res.storms.some(s => s.id === selectedStormId))) {
          setSelectedStormId(priorityStorm.id);
          loadStormAnalysis(priorityStorm.id, priorityStorm);
        }
      } else {
        setActiveStorms([]);
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

  // 3. Tải số liệu thống kê tỉnh thành & lịch sử
  useEffect(() => {
    loadActiveStorms();

    getTyphoonProvinceMetrics()
      .then(res => { if (res.success) setProvinceMetrics(res.data || []); })
      .catch(err => console.warn('Lỗi tải metrics tỉnh:', err));

    getHistoricalLandfalls({ minWind: 50 })
      .then(res => { if (res.success) setHistoricalStorms(res.data || []); })
      .catch(err => console.warn('Lỗi tải bão lịch sử:', err));
  }, []);

  // 4. Khởi tạo bản đồ MapLibre GL JS
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getActiveStyle(selectedBasemap),
        center: [118.0, 18.0],
        zoom: 4.8,
        attributionControl: false
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (stormData) renderStormData(map, stormData);
      });

      mapInstanceRef.current = map;
    } else {
      const map = mapInstanceRef.current;
      map.setStyle(getActiveStyle(selectedBasemap));
      map.once('style.load', () => {
        if (stormData) renderStormData(map, stormData);
      });
    }

    return () => {
      // Dọn dẹp khi unmount
    };
  }, [selectedBasemap, maptilerKey, jawgToken]);

  // 5. Cập nhật dữ liệu bão lên MapLibre GL
  const renderStormData = (map, data) => {
    if (!map || !data?.geojson?.features) return;

    // Gỡ marker HTML cũ
    currentMarkersRef.current.forEach(m => m.remove());
    currentMarkersRef.current = [];

    // Gỡ layers cũ
    const layerIds = [
      'storm-forecast-points-circle',
      'storm-best-points-circle',
      'storm-forecast-track-line',
      'storm-best-track-line',
      'storm-wind-radii-line',
      'storm-wind-radii-fill'
    ];
    layerIds.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('storm-geojson-source')) {
      map.removeSource('storm-geojson-source');
    }

    // Nạp source GeoJSON
    map.addSource('storm-geojson-source', {
      type: 'geojson',
      data: data.geojson
    });

    // 1. Wind radii & Danger Swath (Fill)
    map.addLayer({
      id: 'storm-wind-radii-fill',
      type: 'fill',
      source: 'storm-geojson-source',
      filter: ['in', 'feature_type', 'wind_radii', 'danger_swath'],
      layout: {
        visibility: showWindRadii ? 'visible' : 'none'
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
          ['==', ['get', 'feature_type'], 'danger_swath'], 0.15,
          ['>=', ['coalesce', ['get', 'radii_kt'], 34], 64], 0.32,
          ['>=', ['coalesce', ['get', 'radii_kt'], 34], 50], 0.26,
          0.20
        ]
      }
    });

    // 2. Wind radii border (Line)
    map.addLayer({
      id: 'storm-wind-radii-line',
      type: 'line',
      source: 'storm-geojson-source',
      filter: ['in', 'feature_type', 'wind_radii', 'danger_swath'],
      layout: {
        visibility: showWindRadii ? 'visible' : 'none'
      },
      paint: {
        'line-color': [
          'case',
          ['>=', ['coalesce', ['get', 'radii_kt'], 34], 64], '#b91c1c',
          ['>=', ['coalesce', ['get', 'radii_kt'], 34], 50], '#c2410c',
          '#d97706'
        ],
        'line-width': 1.5,
        'line-opacity': 0.85
      }
    });

    // 3. Best track (Solid Blue)
    map.addLayer({
      id: 'storm-best-track-line',
      type: 'line',
      source: 'storm-geojson-source',
      filter: ['==', 'feature_type', 'best_track'],
      layout: {
        visibility: showBestTrack ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#2563eb',
        'line-width': 3.5,
        'line-opacity': 0.9
      }
    });

    // 4. Forecast track (Dashed Red)
    map.addLayer({
      id: 'storm-forecast-track-line',
      type: 'line',
      source: 'storm-geojson-source',
      filter: ['==', 'feature_type', 'forecast_track'],
      layout: {
        visibility: showForecastTrack ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#dc2626',
        'line-width': 3.5,
        'line-opacity': 0.9,
        'line-dasharray': [3, 2]
      }
    });

    // 5. Best points (Circle)
    map.addLayer({
      id: 'storm-best-points-circle',
      type: 'circle',
      source: 'storm-geojson-source',
      filter: ['==', 'feature_type', 'best_point'],
      layout: {
        visibility: showBestTrack ? 'visible' : 'none'
      },
      paint: {
        'circle-radius': 3.5,
        'circle-color': '#3b82f6',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    });

    // 6. Forecast points (Circle)
    map.addLayer({
      id: 'storm-forecast-points-circle',
      type: 'circle',
      source: 'storm-geojson-source',
      filter: ['==', 'feature_type', 'forecast_point'],
      layout: {
        visibility: showForecastTrack ? 'visible' : 'none'
      },
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'tau_h'], 0], 8,
          5
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'tau_h'], 0], '#dc2626',
          '#f59e0b'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Tạo Marker tâm bão hiện tại với hiệu ứng sóng radar (Pulse)
    const currentPointFeature = data.geojson.features.find(
      f => f.properties?.feature_type === 'forecast_point' && f.properties?.tau_h === 0
    );

    if (currentPointFeature && currentPointFeature.geometry?.coordinates) {
      const coords = currentPointFeature.geometry.coordinates;
      const el = document.createElement('div');
      el.className = 'current-storm-marker-pulse';
      el.innerHTML = `
        <div class="relative flex items-center justify-center cursor-pointer -translate-x-1/2 -translate-y-1/2">
          <div class="absolute w-10 h-10 rounded-full bg-rose-500/40 animate-ping"></div>
          <div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black z-10 hover:scale-110 transition-transform">
            🌪️
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
                <div><strong>Bão:</strong> ${p.storm_name || 'DUJUAN'}</div>
                <div><strong>Thời điểm:</strong> ${p.time_vn || 'N/A'}</div>
                <div><strong>Vị trí:</strong> ${coords[1].toFixed(1)}°N, ${coords[0].toFixed(1)}°E</div>
                <div><strong>Sức gió:</strong> <span class="text-rose-600 font-bold">${p.wind_kmh || 0} km/h</span> (${p.wind_kt} kt)</div>
                <div><strong>Cấp bão:</strong> ${p.category || 'Bão rất mạnh'}</div>
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
            <div class="font-bold text-slate-900 mb-0.5">${p.tau_h === 0 ? 'Tâm bão hiện tại' : `Dự báo +${p.tau_h}h`}</div>
            <div class="text-slate-600 text-[11px]">Thời gian: ${p.time_vn || ''}</div>
            <div class="text-rose-600 font-bold mt-0.5">Sức gió: ${p.wind_kmh || 0} km/h (${p.wind_kt} kt) - ${p.category}</div>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseleave', 'storm-forecast-points-circle', () => {
      map.getCanvas().style.cursor = '';
      if (popupRef.current) popupRef.current.remove();
    });

    // Tự động căn khung (Fit Bounds) bọc trọn vùng bão
    const allCoords = [];
    data.geojson.features.forEach(f => {
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
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 8,
        duration: 1000
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
    if (map.getLayer('storm-best-track-line')) {
      map.setLayoutProperty('storm-best-track-line', 'visibility', showBestTrack ? 'visible' : 'none');
    }
    if (map.getLayer('storm-best-points-circle')) {
      map.setLayoutProperty('storm-best-points-circle', 'visibility', showBestTrack ? 'visible' : 'none');
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
    if (keyModalType === 'maptiler') {
      setMaptilerKey(tempKeyInput.trim());
      localStorage.setItem('maptiler_api_key', tempKeyInput.trim());
    } else {
      setJawgToken(tempKeyInput.trim());
      localStorage.setItem('jawg_access_token', tempKeyInput.trim());
    }
    setShowKeyModal(false);
  };

  // 9. Xử lý Upload file KMZ
  const handleUploadKmz = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      setUploading(true);
      setError(null);
      const res = await uploadTyphoonKmz(uploadFile, uploadStormName.trim());
      if (res.success) {
        setStormData(res);
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadStormName('');
      } else {
        setError(res.error || 'Lỗi phân tích file KMZ');
      }
    } catch (err) {
      console.error('Upload KMZ lỗi:', err);
      setError(err.message || 'Không thể xử lý file KMZ tải lên');
    } finally {
      setUploading(false);
    }
  };

  // 10. Xuất GeoJSON
  const handleDownloadGeoJson = () => {
    if (!stormData?.geojson) return;
    const blob = new Blob([JSON.stringify(stormData.geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `typhoon_${stormData.storm_meta?.name || 'track'}_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 11. Copy bản tin tóm tắt cho nhà báo
  const handleCopySummary = () => {
    if (!stormData) return;
    const meta = stormData.storm_meta || {};
    const cur = stormData.current_stats || {};
    const land = stormData.landfall_assessment || {};

    const text = `BẢN TIN DỰ BÁO BÃO (${meta.name || 'CẬP NHẬT'})
• Vị trí hiện tại (${cur.time_vn || 'N/A'}): Tâm bão ở khoảng ${cur.lat}°N; ${cur.lng}°E.
• Cường độ: Sức gió mạnh nhất ${cur.wind_kmh || 0} km/h (${cur.wind_kt || 0} kt), ${cur.category || 'Bão'}.
• Cường độ cực đại dự kiến: ${cur.peak_wind_kmh || cur.wind_kmh || 0} km/h (${cur.peak_wind_kt || cur.wind_kt || 0} kt).
• Đánh giá đổ bộ đất liền: ${land.estimated ? `Cảnh báo đổ bộ ${land.province} trong khoảng ${land.time_window?.join(' - ')}, gió chạm bờ ${land.wind_kmh} km/h.` : (land.note || 'Chưa có nguy cơ đổ bộ trực tiếp vào đất liền.')}
(Nguồn: Mô hình JTWC / Xử lý tự động Environmental Data Hub)`.trim();

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Lọc bão tương tự
  const similarHistorical = useMemo(() => {
    if (!stormData?.historical_benchmark?.similar_storms) return [];
    return stormData.historical_benchmark.similar_storms;
  }, [stormData]);

  // Lọc danh sách 500+ bão lịch sử
  const filteredHistoricalStorms = useMemo(() => {
    return historicalStorms.filter(s => {
      const matchSearch = !histSearch || 
        (s.name && s.name.toLowerCase().includes(histSearch.toLowerCase())) ||
        (s.year && s.year.toString().includes(histSearch));
      const matchProv = !histProvinceFilter || s.province === histProvinceFilter;
      return matchSearch && matchProv;
    });
  }, [historicalStorms, histSearch, histProvinceFilter]);

  const meta = stormData?.summary || stormData?.storm_meta || {};
  const currentPos = stormData?.summary?.current_position || stormData?.current_stats || {};
  const peakPos = stormData?.summary?.peak_forecast || {};
  const stats = {
    lat: currentPos.lat,
    lng: currentPos.lon ?? currentPos.lng,
    wind_kmh: currentPos.wind_kmh,
    wind_kt: currentPos.wind_kt,
    category: currentPos.category,
    time_vn: currentPos.time_vn,
    peak_wind_kmh: peakPos.wind_kmh || currentPos.wind_kmh,
    peak_wind_kt: peakPos.wind_kt || currentPos.wind_kt,
    peak_time_vn: peakPos.time_vn || currentPos.time_vn
  };
  const landfall = stormData?.landfall || stormData?.landfall_assessment;
  const benchmark = stormData?.historical?.benchmark || stormData?.historical_benchmark;

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
              Nền tảng bản đồ vector WebGL hiệu năng cao kết hợp dữ liệu cảnh báo bão thời gian thực từ JTWC (Mỹ) & Mô hình đổ bộ VnExpress.
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Storm selector */}
          <div className="relative min-w-[220px]">
            <select
              value={selectedStormId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedStormId(id);
                const s = activeStorms.find(item => item.id === id);
                if (s) loadStormAnalysis(id, s);
              }}
              disabled={loading || activeStorms.length === 0}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
            >
              {activeStorms.length > 0 ? (
                activeStorms.map(s => (
                  <option key={s.id} value={s.id}>
                    🌀 {s.name} ({s.id}) - {s.title || 'Đang hoạt động'}
                  </option>
                ))
              ) : (
                <option value="">Không có bão hoạt động</option>
              )}
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => loadActiveStorms(false)}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-700 dark:text-slate-200 shadow-2xs"
            title="Làm mới dữ liệu từ JTWC"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Upload KMZ button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Nạp file KMZ</span>
          </button>
        </div>
      </div>

      {/* QUICK STATS CARDS */}
      {stormData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TÂM BÃO HIỆN TẠI */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Tâm bão ({meta.name || 'Bão'})</span>
              <MapPin className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
              {stats.lat ? `${stats.lat}°N - ${stats.lng}°E` : 'Đang cập nhật'}
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
              {benchmark?.percentile ? `Top ${(100 - benchmark.percentile).toFixed(1)}%` : 'Tham chiếu'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Mạnh hơn <span className="font-semibold text-slate-700 dark:text-slate-300">{benchmark?.percentile || 0}%</span> bão lịch sử
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
                  ? `Đường dự báo cho thấy tâm bão có thể ảnh hưởng trực tiếp tới khu vực ${landfall.province} trong khoảng ${landfall.time_window[0]} → ${landfall.time_window[1]}. Sức gió chạm bờ dự kiến khoảng ${landfall.wind_kmh} km/h (${landfall.category}).`
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
                  <optgroup label="⚡ Vector WebGL Tự Do (Không cần Key)">
                    <option value="dark_matter">🌙 Protomaps / Dark Matter (Tối)</option>
                    <option value="positron">☀️ Protomaps / Positron (Sáng Tinh Tế)</option>
                    <option value="voyager">🧭 Voyager (Chi tiết địa giới)</option>
                    <option value="satellite">🛰️ Vệ Tinh Thực Tế (ESRI)</option>
                    <option value="maplibre_demo">🌐 MapLibre Open Vector</option>
                  </optgroup>
                  <optgroup label="🔑 Nhà cung cấp Vector (Tuỳ chọn Key)">
                    <option value="maptiler_dark">🗺️ MapTiler Dataviz</option>
                    <option value="jawg_dark">🐆 Jawg Maps Dark</option>
                  </optgroup>
                </select>

                {/* Key Config Button for MapTiler or Jawg */}
                {(selectedBasemap === 'maptiler_dark' || selectedBasemap === 'jawg_dark') && (
                  <button
                    onClick={() => openKeyModal(selectedBasemap === 'maptiler_dark' ? 'maptiler' : 'jawg')}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md text-[11px] font-medium hover:bg-indigo-100 transition-colors cursor-pointer"
                    title="Nhập Key/Token cá nhân"
                  >
                    <Key className="w-3 h-3" />
                    <span>Nhập Key</span>
                  </button>
                )}
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-3 text-xs">
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
                  <span>Đường dự báo</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showBestTrack}
                    onChange={(e) => setShowBestTrack(e.target.checked)}
                    className="rounded text-blue-500 focus:ring-0"
                  />
                  <span>Đường thực tế</span>
                </label>
              </div>
            </div>

            {/* Thông tin WebGL Banner */}
            <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-700/80 text-[11px] flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span>
                  <strong>MapLibre GL JS:</strong> Basemap vector WebGL 60fps mượt mà, không dính watermark, không phụ thuộc Google Billing.
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
                {MAPLIBRE_BASEMAPS[selectedBasemap]?.provider || 'Vector'}
              </span>
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

          {/* DỰ BÁO THEO TỪNG MỐC THỜI GIAN (TAU POINTS TABLE) */}
          {stormData?.geojson?.features && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>Các mốc dự báo tâm bão (Mô hình JTWC 12h - 120h)</span>
              </h3>
              <div className="overflow-x-auto max-h-52">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-2.5">Mốc dự báo</th>
                      <th className="py-2 px-2.5">Thời gian (VN)</th>
                      <th className="py-2 px-2.5">Tọa độ</th>
                      <th className="py-2 px-2.5">Sức gió</th>
                      <th className="py-2 px-2.5">Cấp bão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stormData.geojson.features
                      .filter(f => f.properties?.feature_type === 'forecast_point')
                      .map((f, i) => {
                        const p = f.properties;
                        const coords = f.geometry?.coordinates || [0, 0];
                        return (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="py-2 px-2.5 font-bold">
                              {p.tau_h === 0 ? (
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
                      })}
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
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Bão tương tự
            </button>
            <button
              onClick={() => setActiveTab('provinces')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'provinces' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tần suất tỉnh
            </button>
            <button
              onClick={() => setActiveTab('historical')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
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
                So sánh với bão có sức gió đổ bộ xấp xỉ {stats.wind_kmh || 120} km/h để đánh giá kịch bản thiệt hại thực tế.
              </p>

              {/* Thống kê nhanh benchmark */}
              {benchmark && (
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px]">
                  <div>
                    <div className="text-slate-500">Gió TB đổ bộ:</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{benchmark.mean_wind} km/h</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Mạnh nhất VN:</div>
                    <div className="font-bold text-rose-600 dark:text-rose-400">{benchmark.max_wind} km/h</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Mốc P90:</div>
                    <div className="font-bold text-amber-600 dark:text-amber-400">{benchmark.p90} km/h</div>
                  </div>
                </div>
              )}

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
                          {s.name} ({s.year})
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {s.wind_kmh} km/h
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span>Đổ bộ: <strong>{s.province}</strong> • {s.landfall_time?.split(' ')[0]}</span>
                        <span>{s.hours_on_land}h trên bờ</span>
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
                <span className="text-[11px] text-slate-400">63 tỉnh thành</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Dữ liệu tần suất bão đổ bộ trực tiếp và số lần bão quét qua từng địa phương theo VnExpress Spotlight.
              </p>

              <div className="max-h-[460px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 text-[11px]">
                      <th className="py-2 px-2">Tỉnh / Thành</th>
                      <th className="py-2 px-2 text-center">Đổ bộ</th>
                      <th className="py-2 px-2 text-center">Quét qua</th>
                      <th className="py-2 px-2 text-right">Gió max</th>
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
                            {p.landfall_count || 0}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">
                          {p.swath_count || 0}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {p.max_wind_kmh || 0} <span className="text-[10px] font-normal text-slate-400">km/h</span>
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
                          {s.name}
                        </td>
                        <td className="py-2 px-2 text-slate-500">{s.year}</td>
                        <td className="py-2 px-2 text-slate-700 dark:text-slate-300">{s.province}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {s.wind_kmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
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

      {/* MODAL CẤU HÌNH KEY (MAPTILER / JAWG) */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {keyModalType === 'maptiler' ? 'Cấu hình MapTiler API Key' : 'Cấu hình Jawg Access Token'}
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {keyModalType === 'maptiler'
                ? 'Nhập API Key MapTiler từ tài khoản của bạn (lấy tại cloud.maptiler.com). Key sẽ được lưu an toàn trong trình duyệt của bạn.'
                : 'Nhập Access Token từ tài khoản Jawg Maps của bạn (lấy tại jawg.io). Token được lưu an toàn trong trình duyệt.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {keyModalType === 'maptiler' ? 'MapTiler API Key' : 'Jawg Access Token'}
              </label>
              <input
                type="text"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder={keyModalType === 'maptiler' ? 'VD: get_free_key_from_maptiler' : 'VD: your_jawg_access_token'}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
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
