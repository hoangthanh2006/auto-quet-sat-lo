import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Wind, Eye, Compass, CloudRain, AlertTriangle, Gauge, Clock, MapPin, 
  TrendingUp, BarChart3, UploadCloud, FileText, Download, Copy, Check, 
  RefreshCw, Sliders, ShieldAlert, Layers, ExternalLink, ChevronRight,
  Info, Sparkles, Navigation, Globe
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  getActiveTyphoons, 
  getStormDetails, 
  uploadTyphoonKmz, 
  getHistoricalLandfalls, 
  getTyphoonProvinceMetrics 
} from '../services/api';

// Sửa lỗi hiển thị icon mặc định của Leaflet khi build bundle
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

  // Refs bản đồ
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    windRadiiGroup: null,
    trackGroup: null,
    markerGroup: null
  });

  // 1. Tải danh sách bão đang hoạt động từ JTWC/JMA
  const loadActiveStorms = async (autoSelectFirst = true) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getActiveTyphoons();
      if (res.success && res.storms?.length > 0) {
        setActiveStorms(res.storms);
        if (autoSelectFirst && (!selectedStormId || !res.storms.some(s => s.id === selectedStormId))) {
          setSelectedStormId(res.storms[0].id);
          loadStormAnalysis(res.storms[0].id, res.storms[0]);
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

  // 4. Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [17.0, 116.0],
        zoom: 5,
        zoomControl: true,
        scrollWheelZoom: true
      });

      // Lớp bản đồ nền CartoDB Positron nhẹ nhàng, dễ đọc
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>, JTWC, Spotlight VnExpress',
        maxZoom: 18
      }).addTo(map);

      layersRef.current.windRadiiGroup = L.featureGroup().addTo(map);
      layersRef.current.trackGroup = L.featureGroup().addTo(map);
      layersRef.current.markerGroup = L.featureGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      // Dọn dẹp bản đồ khi component unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 5. Cập nhật các lớp dữ liệu bão lên bản đồ khi stormData thay đổi
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !stormData?.geojson?.features) return;

    const { windRadiiGroup, trackGroup, markerGroup } = layersRef.current;
    windRadiiGroup.clearLayers();
    trackGroup.clearLayers();
    markerGroup.clearLayers();

    const features = stormData.geojson.features;
    const bounds = L.latLngBounds();

    // A. Vẽ các vùng gió nguy hiểm (Wind Radii & Danger Swath)
    if (showWindRadii) {
      features.forEach(f => {
        const type = f.properties?.feature_type;
        if (type === 'wind_radii' || type === 'danger_swath') {
          const coords = f.geometry.coordinates;
          if (coords && coords[0]) {
            const latlngs = coords[0].map(c => [c[1], c[0]]);
            const radiiKt = f.properties?.radii_kt || 34;
            
            // Màu sắc theo cấp gió
            let color = '#f59e0b'; // cấp 8 (>=34 kt)
            let fillColor = '#fef3c7';
            if (radiiKt >= 64) {
              color = '#dc2626'; // cấp 12 (>=64 kt)
              fillColor = '#fee2e2';
            } else if (radiiKt >= 50) {
              color = '#ea580c'; // cấp 10 (>=50 kt)
              fillColor = '#ffedd5';
            }

            const poly = L.polygon(latlngs, {
              color,
              weight: 1.5,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.18,
              dashArray: type === 'danger_swath' ? '4, 4' : null
            });

            poly.bindTooltip(`
              <div class="font-sans text-xs p-1">
                <div class="font-bold text-slate-800">${f.properties?.feature_name_vn || 'Vùng gió mạnh'}</div>
                <div class="text-slate-600">Sức gió: ≥ ${radiiKt} kt (${f.properties?.radii_kmh || Math.round(radiiKt * 1.852)} km/h)</div>
                ${f.properties?.time_vn ? `<div class="text-slate-500 text-[11px]">${f.properties.time_vn}</div>` : ''}
              </div>
            `, { sticky: true });

            windRadiiGroup.addLayer(poly);
            latlngs.forEach(ll => bounds.extend(ll));
          }
        }
      });
    }

    // B. Vẽ đường đi quá khứ & đường dự báo
    features.forEach(f => {
      const type = f.properties?.feature_type;
      if (f.geometry?.type === 'LineString') {
        const latlngs = f.geometry.coordinates.map(c => [c[1], c[0]]);
        if (latlngs.length < 2) return;

        if (type === 'best_track' && showBestTrack) {
          const line = L.polyline(latlngs, {
            color: '#2563eb',
            weight: 3.5,
            opacity: 0.85
          }).bindTooltip('Đường đi thực tế quan trắc');
          trackGroup.addLayer(line);
          latlngs.forEach(ll => bounds.extend(ll));
        } else if (type === 'forecast_track' && showForecastTrack) {
          const line = L.polyline(latlngs, {
            color: '#dc2626',
            weight: 3.5,
            opacity: 0.9,
            dashArray: '8, 6'
          }).bindTooltip('Đường đi dự báo (5 ngày)');
          trackGroup.addLayer(line);
          latlngs.forEach(ll => bounds.extend(ll));
        }
      }
    });

    // C. Điểm quan trắc quá khứ & Điểm dự báo
    features.forEach(f => {
      const type = f.properties?.feature_type;
      if (f.geometry?.type === 'Point') {
        const coords = f.geometry.coordinates;
        const latlng = [coords[1], coords[0]];
        const p = f.properties;

        if (type === 'forecast_point' && showForecastTrack) {
          const isCurrent = p.tau_h === 0;
          
          // Icon tâm bão đặc biệt cho vị trí hiện tại
          const icon = L.divIcon({
            className: 'custom-storm-icon',
            html: isCurrent ? `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 rounded-full bg-rose-500/30 animate-ping"></div>
                <div class="w-6 h-6 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-black">
                  🌪️
                </div>
              </div>
            ` : `
              <div class="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-md hover:scale-125 transition-transform"></div>
            `,
            iconSize: isCurrent ? [32, 32] : [14, 14],
            iconAnchor: isCurrent ? [16, 16] : [7, 7]
          });

          const marker = L.marker(latlng, { icon });
          marker.bindPopup(`
            <div class="font-sans text-xs p-1 max-w-[220px]">
              <div class="font-bold text-sm text-slate-800 border-b pb-1 mb-1.5 flex items-center justify-between">
                <span>${isCurrent ? 'Tâm bão hiện tại' : `Dự báo +${p.tau_h}h`}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">${p.category_code || 'TC'}</span>
              </div>
              <div class="space-y-1 text-slate-600 text-xs">
                <div><strong>Thời điểm:</strong> ${p.time_vn || 'Chưa rõ'}</div>
                <div><strong>Vị trí:</strong> ${latlng[0].toFixed(1)}°N, ${latlng[1].toFixed(1)}°E</div>
                <div><strong>Sức gió:</strong> <span class="text-rose-600 font-bold">${p.wind_kmh || 0} km/h</span> (${p.wind_kt} kt)</div>
                <div><strong>Cấp bão:</strong> <span class="text-slate-800 font-medium">${p.category}</span></div>
                ${p.movement_kmh ? `<div><strong>Di chuyển:</strong> ${p.movement_deg}° ở ${p.movement_kmh} km/h</div>` : ''}
              </div>
            </div>
          `);

          markerGroup.addLayer(marker);
          bounds.extend(latlng);
        } else if (type === 'best_track_point' && showBestTrack) {
          const icon = L.divIcon({
            className: 'custom-btk-icon',
            html: `<div class="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow-xs"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5]
          });

          const marker = L.marker(latlng, { icon });
          marker.bindPopup(`
            <div class="font-sans text-xs p-1">
              <div class="font-bold text-slate-800">Quan trắc quá khứ</div>
              <div class="text-slate-600">Thời gian: ${p.time_vn || ''}</div>
              <div class="text-slate-600">Gió: ${p.wind_kmh || 0} km/h (${p.wind_kt} kt) - ${p.category}</div>
            </div>
          `);

          markerGroup.addLayer(marker);
          bounds.extend(latlng);
        }
      }
    });

    // Zoom bản đồ vừa vặn khu vực bão
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }
  }, [stormData, showWindRadii, showBestTrack, showForecastTrack]);

  // 6. Xử lý Upload file KMZ
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

  // 7. Tạo đoạn văn bản tin nhanh báo chí (VnExpress Spotlight format)
  const generateJournalistSummary = () => {
    if (!stormData?.summary) return '';
    const s = stormData.summary;
    const pos = s.current_position;
    const pk = s.peak_forecast;
    const lf = stormData.landfall;

    let text = `BẢN TIN DỰ BÁO BÃO (${s.storm_name})\n`;
    text += `• Vị trí hiện tại (${pos.time_vn}): Tâm bão ở khoảng ${pos.lat.toFixed(1)} độ Vĩ Bắc; ${pos.lon.toFixed(1)} độ Kinh Đông.\n`;
    text += `• Cường độ: Sức gió mạnh nhất vùng gần tâm bão đạt ${pos.wind_kmh} km/h (${pos.wind_kt} hải lý/giờ), ${pos.category}.\n`;
    if (pos.movement_kmh) {
      text += `• Hướng di chuyển: Bão đang di chuyển theo hướng ${pos.movement_deg} độ với tốc độ khoảng ${pos.movement_kmh} km/h.\n`;
    }
    if (pk) {
      text += `• Cực đại dự kiến: Bão có thể đạt cường độ cực đại lên tới ${pk.wind_kmh} km/h (${pk.wind_kt} kt, ${pk.category}) vào khoảng ${pk.time_vn}.\n`;
    }
    if (lf?.estimated) {
      text += `• Nguy cơ đổ bộ: Dự báo tâm bão có khả năng đi vào đất liền khu vực ${lf.province} trong khoảng thời gian từ ${lf.time_window[0]} đến ${lf.time_window[1]}. Sức gió khi chạm bờ ước tính ${lf.wind_kmh} km/h (${lf.category}).\n`;
    } else {
      text += `• Dự báo bão hiện tại chưa có dấu hiệu đổ bộ trực tiếp vào đất liền Việt Nam.\n`;
    }

    if (stormData.historical?.peak_forecast_percentile) {
      text += `• So sánh dữ liệu lịch sử (1950-nay): Cơn bão này có cường độ dự báo mạnh hơn khoảng ${stormData.historical.peak_forecast_percentile}% các cơn bão từng đổ bộ Việt Nam.`;
    }

    return text;
  };

  const handleCopySummary = () => {
    const text = generateJournalistSummary();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleDownloadGeoJson = () => {
    if (!stormData?.geojson) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stormData.geojson, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${stormData.summary?.storm_name || 'typhoon'}_track.geojson`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Lọc danh sách bão lịch sử
  const filteredHistorical = useMemo(() => {
    return historicalStorms.filter(s => {
      const matchSearch = !histSearch || s.NAME?.toLowerCase().includes(histSearch.toLowerCase()) || String(s.year).includes(histSearch);
      const matchProv = !histProvinceFilter || s.province_landfall?.toLowerCase().includes(histProvinceFilter.toLowerCase());
      return matchSearch && matchProv;
    });
  }, [historicalStorms, histSearch, histProvinceFilter]);

  const summary = stormData?.summary;
  const currentPos = summary?.current_position;
  const peak = summary?.peak_forecast;
  const landfall = stormData?.landfall;
  const historical = stormData?.historical;

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-rose-500 rounded-xl text-white shadow-md shadow-amber-500/20">
              <Wind className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 font-heading flex items-center gap-2">
                Theo dõi & Phân tích Bão (Typhoon Hub)
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  JTWC & JMA Live
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dữ liệu thời gian thực từ Trung tâm Cảnh báo Bão Hải quân Mỹ (JTWC) & Mô hình phân tích đổ bộ VnExpress Spotlight
              </p>
            </div>
          </div>
        </div>

        {/* SELECTOR & ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dropdown chọn bão */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <Compass className="w-4 h-4 text-amber-500" />
            <select
              value={selectedStormId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedStormId(id);
                const s = activeStorms.find(x => x.id === id);
                if (s) loadStormAnalysis(id, s);
              }}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-2"
              disabled={activeStorms.length === 0}
            >
              {activeStorms.length === 0 ? (
                <option value="">Không có bão hoạt động</option>
              ) : (
                activeStorms.map(s => (
                  <option key={s.id} value={s.id} className="dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {s.name} ({s.id}) - {s.fullName || 'Đang hoạt động'}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Nút làm mới */}
          <button
            onClick={() => loadActiveStorms(false)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-colors"
            title="Cập nhật lại từ JTWC"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          {/* Nút Tải lên KMZ thủ công */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 transition-colors shadow-xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Nạp file KMZ</span>
          </button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* KEY METRICS CARDS */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Vị trí tâm bão */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Tâm bão ({summary.storm_name})</span>
              <MapPin className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-xl font-black text-slate-900 dark:text-slate-50 font-heading">
              {currentPos?.lat?.toFixed(1)}°N - {currentPos?.lon?.toFixed(1)}°E
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Thời điểm: <span className="font-semibold text-slate-700 dark:text-slate-200">{currentPos?.time_vn || 'N/A'}</span>
            </div>
          </div>

          {/* Card 2: Cường độ hiện tại */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Cường độ hiện tại</span>
              <Gauge className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-xl font-black text-amber-600 dark:text-amber-400 font-heading flex items-baseline gap-1.5">
              <span>{currentPos?.wind_kmh || 0}</span>
              <span className="text-xs font-bold text-slate-500">km/h</span>
              <span className="text-xs font-normal text-slate-400">({currentPos?.wind_kt} kt)</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
              {currentPos?.category}
            </div>
          </div>

          {/* Card 3: Dự báo cực đại (Peak Forecast) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Cực đại dự kiến (Peak)</span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 text-xl font-black text-purple-600 dark:text-purple-400 font-heading flex items-baseline gap-1.5">
              <span>{peak?.wind_kmh || currentPos?.wind_kmh || 0}</span>
              <span className="text-xs font-bold text-slate-500">km/h</span>
              <span className="text-xs font-normal text-slate-400">({peak?.wind_kt} kt)</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {peak?.time_vn ? `Khoảng: ${peak.time_vn}` : 'Cường độ hiện tại là cực đại'}
            </div>
          </div>

          {/* Card 4: Tương quan lịch sử (Percentile) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Tương quan lịch sử VN</span>
              <BarChart3 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
              Top {(100 - (historical?.peak_forecast_percentile || 0)).toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Mạnh hơn <span className="font-semibold text-slate-700 dark:text-slate-200">{historical?.peak_forecast_percentile}%</span> bão lịch sử
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? 'Đã sao chép' : 'Copy tin nhanh'}</span>
            </button>
            <button
              onClick={handleDownloadGeoJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col h-[600px]">
            {/* Map Header & Layer Toggles */}
            <div className="p-3.5 px-4 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                <Globe className="w-4 h-4 text-indigo-500" />
                <span>Bản đồ đường đi & Bán kính gió nguy hiểm</span>
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

            {/* Map Canvas */}
            <div className="relative flex-1 w-full h-full">
              <div ref={mapContainerRef} className="w-full h-full z-0" />

              {/* Map Legend (Chú giải góc bản đồ) */}
              <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md text-[11px] space-y-1">
                <div className="font-bold text-slate-700 dark:text-slate-200 mb-1">Chú giải cấp gió:</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Đường đi thực tế quan trắc</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1 border-t-2 border-dashed border-rose-600 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Đường dự báo 5 ngày (JTWC)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-400/50 border border-amber-600 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Vùng gió ≥ 34 kt (Cấp 8)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-orange-400/50 border border-orange-600 inline-block"></span>
                  <span className="text-slate-600 dark:text-slate-300">Vùng gió ≥ 50 kt (Cấp 10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-rose-500/50 border border-rose-700 inline-block"></span>
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
                      <th className="py-2 px-2.5">Thời điểm (VN)</th>
                      <th className="py-2 px-2.5">Mốc TAU</th>
                      <th className="py-2 px-2.5">Tọa độ</th>
                      <th className="py-2 px-2.5">Sức gió</th>
                      <th className="py-2 px-2.5">Cấp bão (QĐ 18)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stormData.geojson.features
                      .filter(f => f.properties?.feature_type === 'forecast_point')
                      .sort((a, b) => (a.properties?.tau_h || 0) - (b.properties?.tau_h || 0))
                      .map((pt, idx) => {
                        const p = pt.properties;
                        const coords = pt.geometry.coordinates;
                        const isNow = p.tau_h === 0;
                        return (
                          <tr key={idx} className={isNow ? 'bg-rose-50/50 dark:bg-rose-950/20 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}>
                            <td className="py-2 px-2.5 text-slate-800 dark:text-slate-200">
                              {p.time_vn} {isNow && <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500 text-white ml-1">Hiện tại</span>}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500">+{p.tau_h}h</td>
                            <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {coords[1].toFixed(1)}°N, {coords[0].toFixed(1)}°E
                            </td>
                            <td className="py-2 px-2.5 text-rose-600 dark:text-rose-400 font-bold">
                              {p.wind_kmh} km/h <span className="text-slate-400 font-normal">({p.wind_kt} kt)</span>
                            </td>
                            <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300">
                              {p.category}
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

        {/* CỘT PHẢI: TABS PHÂN TÍCH SO SÁNH & THỐNG KÊ (5 COLUMNS) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* TAB SELECTOR */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Bão tương tự
            </button>
            <button
              onClick={() => setActiveTab('provinces')}
              className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                activeTab === 'provinces'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tần suất tỉnh
            </button>
            <button
              onClick={() => setActiveTab('historical')}
              className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                activeTab === 'historical'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Kho 500+ bão
            </button>
          </div>

          {/* TAB 1: BÃO TƯƠNG TỰ TRONG LỊCH SỬ */}
          {activeTab === 'overview' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Bão lịch sử có cường độ tương đồng (±20 km/h)
                  </span>
                  <span className="text-xs font-normal text-slate-400">1950 - 2025</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  So sánh với bão có sức gió đổ bộ xấp xỉ {peak?.wind_kmh || currentPos?.wind_kmh || 80} km/h
                </p>
              </div>

              {/* Stats Summary */}
              {historical?.historical_wind_stats && (
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Gió TB đổ bộ:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{historical.historical_wind_stats.mean_kph} km/h</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mạnh nhất VN:</span>
                    <strong className="text-rose-600 dark:text-rose-400">{historical.historical_wind_stats.max_kph} km/h</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mốc P90:</span>
                    <strong className="text-amber-600 dark:text-amber-400">{historical.historical_wind_stats.p90_kph} km/h</strong>
                  </div>
                </div>
              )}

              {/* Danh sách 10 bão tương tự */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {historical?.similar_intensity_storms?.length > 0 ? (
                  historical.similar_intensity_storms.map((s, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{s.name} ({s.year})</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold">
                            {s.wind_kph} km/h
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                          Đổ bộ: <span className="font-medium text-slate-700 dark:text-slate-300">{s.province || 'Miền Trung'}</span> • {s.landfall_time?.substring(0, 10)}
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400">
                        <span>{s.time_on_land_h ? `${s.time_on_land_h}h trên bờ` : ''}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Không tìm thấy cơn bão lịch sử tương tự trong cơ sở dữ liệu
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TẦN SUẤT TỈNH THÀNH (PROVINCE VULNERABILITY) */}
          {activeTab === 'provinces' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  Xếp hạng tần suất bão đổ bộ theo tỉnh (1884 - 2025)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Dữ liệu thống kê dựa trên hơn 500 cơn bão chính thức đổ bộ vào đất liền Việt Nam
                </p>
              </div>

              <div className="overflow-y-auto max-h-[420px] divide-y divide-slate-100 dark:divide-slate-800">
                {provinceMetrics.map((p, idx) => (
                  <div key={idx} className="py-2.5 px-2 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        idx < 3 ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 block">{p.province}</span>
                        <span className="text-[10px] text-slate-400">Gió TB: {p.avg_wind_kph} km/h • Đi qua: {p.crossed_count} lần</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400">{p.direct_landfall_count}</span>
                      <span className="text-[10px] text-slate-400 block">lần đổ bộ trực tiếp</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TRA CỨU KHO 500+ BÃO LỊCH SỬ */}
          {activeTab === 'historical' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Tra cứu bão đổ bộ Việt Nam (1950 - 2025)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Hơn 500 cơn bão với thông tin gió khi đổ bộ, tỉnh thành và giờ hoành hành trên đất liền
                </p>
              </div>

              {/* Ô tìm kiếm */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tìm tên bão (YAGI, TRAMI...) hoặc năm..."
                  value={histSearch}
                  onChange={(e) => setHistSearch(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              {/* Danh sách bão */}
              <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistorical.slice(0, 50).map((s, idx) => (
                  <div key={idx} className="py-2.5 px-2 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 dark:text-slate-100">{s.NAME}</strong>
                        <span className="text-[10px] text-slate-400">({s.year})</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-bold text-rose-600">
                          {s.wind_at_landfall_kph} km/h
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {s.province_landfall} • {s.calc_landfall_time?.substring(0, 10)}
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-slate-400">
                      {s.time_on_land_h > 0 ? `${s.time_on_land_h} giờ trên bờ` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL TẢI LÊN FILE KMZ THỦ CÔNG */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-50 font-heading flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                Nạp file KMZ phân tích bão
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tải file <code>.kmz</code> từ JTWC (ví dụ <code>wp2426.kmz</code>) để phân tích đường dự báo, bán kính gió và nguy cơ đổ bộ vào Việt Nam.
            </p>

            <form onSubmit={handleUploadKmz} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tên bão (Tùy chọn, ví dụ: Bão số 3 - YAGI):
                </label>
                <input
                  type="text"
                  placeholder="Để trống nếu muốn lấy tên tự động từ KMZ"
                  value={uploadStormName}
                  onChange={(e) => setUploadStormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Chọn file .kmz:
                </label>
                <input
                  type="file"
                  accept=".kmz,.kml"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                  <span>{uploading ? 'Đang phân tích...' : 'Bắt đầu phân tích'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
