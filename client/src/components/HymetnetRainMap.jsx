import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  Layers,
  Maximize2,
  LocateFixed,
  MapPin,
  ExternalLink,
  Radio,
  Eye,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { MAPLIBRE_BASEMAPS } from '../services/maplibreBasemaps';

// Setup MapLibre worker for Vite
if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  try {
    maplibregl.setWorkerUrl(workerUrl);
  } catch (e) {
    console.warn('Maplibre worker init:', e);
  }
}

/**
 * Component Bản đồ Hiển thị Vị trí Các Điểm Mưa Lớn Trọng Điểm (Hymetnet)
 * Hỗ trợ:
 * - Hiển thị toàn bộ các điểm mưa lớn với marker badge thứ hạng (#1, #2,...)
 * - Phân cấp màu: Top 1 (đỏ/hồng phát sáng), Top 2-3 (cam/vàng), Top 4+ (xanh cyan)
 * - Tương tác 2 chiều với bảng dữ liệu (click marker -> highlight bảng, click bảng -> bay tới marker)
 * - Chuyển đổi Basemap (Dark Canvas khí tượng, Vệ tinh, OSM Standard)
 * - Nút toàn cảnh (Fit Bounds) bao trọn toàn bộ điểm mưa cả nước
 * - Chế độ chuyển đổi xem Bản đồ GIS hoặc xem trực tiếp Ảnh Radar Mưa QPE
 */
export default function HymetnetRainMap({
  points = [],
  selectedPoint = null,
  onSelectPoint = () => {},
  timeVn = '',
  radarRainImages = []
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);

  const [activeBasemap, setActiveBasemap] = useState('dark_matter'); // 'dark_matter' | 'satellite' | 'osm'
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'radar_qpe'
  const [radarZoomed, setRadarZoomed] = useState(false);

  // Basemap style mapper
  const getStyle = (basemapId) => {
    if (basemapId === 'satellite') return MAPLIBRE_BASEMAPS.satellite.style;
    if (basemapId === 'osm') return MAPLIBRE_BASEMAPS.osm.style;
    return MAPLIBRE_BASEMAPS.dark_matter.style;
  };

  // 1. Khởi tạo bản đồ MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getStyle(activeBasemap),
        center: [106.0, 16.2], // Trung tâm Việt Nam
        zoom: 5.2,
        attributionControl: false
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        renderMarkers(map, points, selectedPoint);
        fitAllPoints(map, points);
      });

      mapInstanceRef.current = map;
    } else {
      const map = mapInstanceRef.current;
      map.setStyle(getStyle(activeBasemap));
      map.once('style.load', () => {
        renderMarkers(map, points, selectedPoint);
      });
    }

    return () => {
      // Do not destroy on basemap change, destroyed on unmount below
    };
  }, [activeBasemap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Cập nhật Marker khi danh sách points hoặc selectedPoint thay đổi
  useEffect(() => {
    if (mapInstanceRef.current && mapInstanceRef.current.isStyleLoaded()) {
      renderMarkers(mapInstanceRef.current, points, selectedPoint);
    }
  }, [points, selectedPoint]);

  // 3. Khi selectedPoint thay đổi -> Bay tới tọa độ điểm và mở popup
  useEffect(() => {
    if (!selectedPoint || !mapInstanceRef.current) return;
    const { longitude, latitude } = selectedPoint;
    if (!latitude || !longitude) return;

    const map = mapInstanceRef.current;
    map.flyTo({
      center: [longitude, latitude],
      zoom: 11,
      speed: 1.4,
      essential: true
    });

    openPopupForPoint(map, selectedPoint);
  }, [selectedPoint]);

  // Hàm tính toán bounding box bao phủ tất cả các điểm
  const fitAllPoints = (map, pts) => {
    if (!map || !pts || pts.length === 0) return;
    const validPts = pts.filter((p) => p.latitude && p.longitude);
    if (validPts.length === 0) return;

    if (validPts.length === 1) {
      map.flyTo({
        center: [validPts[0].longitude, validPts[0].latitude],
        zoom: 9,
        duration: 1000
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    validPts.forEach((p) => {
      bounds.extend([p.longitude, p.latitude]);
    });

    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 10,
      duration: 1000
    });
  };

  // Mở popup thông tin điểm mưa
  const openPopupForPoint = (map, pt) => {
    if (!map || !pt.latitude || !pt.longitude) return;

    if (popupRef.current) {
      popupRef.current.remove();
    }

    const rank = pt.globalRank || pt.rank + 1;
    const rankColor =
      rank === 1
        ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800'
        : rank <= 3
        ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800'
        : 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800';

    const htmlContent = `
      <div class="p-2.5 font-sans min-w-[210px] text-slate-800 dark:text-slate-100">
        <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${rankColor}">
            🌧️ #${rank} Trọng Điểm
          </span>
          <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            ${pt.province || ''}
          </span>
        </div>
        <div class="space-y-1 text-xs">
          <div class="flex items-baseline justify-between">
            <span class="text-slate-500 dark:text-slate-400">Quận / Huyện:</span>
            <strong class="text-slate-900 dark:text-white font-bold">${pt.district || 'Chưa rõ'}</strong>
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-slate-500 dark:text-slate-400">Tỉnh / TP:</span>
            <span class="text-slate-700 dark:text-slate-200 font-medium">${pt.province || 'Chưa rõ'}</span>
          </div>
          ${
            pt.timeVn
              ? `<div class="flex items-baseline justify-between">
                  <span class="text-slate-500 dark:text-slate-400">Mốc giờ:</span>
                  <span class="text-slate-600 dark:text-slate-300 text-[11px]">${pt.timeVn}</span>
                </div>`
              : ''
          }
          <div class="flex items-baseline justify-between font-mono text-[11px] pt-1 text-slate-500">
            <span>Tọa độ:</span>
            <span>${pt.latitude.toFixed(4)}°N, ${pt.longitude.toFixed(4)}°E</span>
          </div>
        </div>
        <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <a
            href="https://www.google.com/maps?q=${pt.latitude},${pt.longitude}"
            target="_blank"
            rel="noreferrer"
            class="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            Google Maps ↗
          </a>
          <span class="text-[10px] text-slate-400">Hymetnet QPE</span>
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: 16,
      closeButton: true,
      closeOnClick: false,
      className: 'hymetnet-rain-popup'
    })
      .setLngLat([pt.longitude, pt.latitude])
      .setHTML(htmlContent)
      .addTo(map);

    popupRef.current = popup;
  };

  // 4. Vẽ Marker HTML lên bản đồ
  const renderMarkers = (map, pts, currentSelected) => {
    if (!map) return;

    // Gỡ các markers cũ
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pts.forEach((pt) => {
      if (!pt.latitude || !pt.longitude) return;

      const rank = pt.globalRank || pt.rank + 1;
      const isSelected = currentSelected && currentSelected.id === pt.id;

      // Màu sắc theo thứ hạng
      let bgGradient = 'from-cyan-600 to-sky-500 shadow-cyan-500/50';
      let borderGlow = 'border-cyan-300 dark:border-cyan-400';
      let pulseRing = false;

      if (rank === 1) {
        bgGradient = 'from-rose-600 via-red-500 to-amber-500 shadow-rose-500/60';
        borderGlow = 'border-white';
        pulseRing = true;
      } else if (rank <= 3) {
        bgGradient = 'from-amber-500 to-orange-500 shadow-amber-500/60';
        borderGlow = 'border-amber-200';
        pulseRing = true;
      }

      // Tạo wrapper marker HTML
      const el = document.createElement('div');
      el.className = 'group cursor-pointer transition-transform duration-200';
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      el.innerHTML = `
        <div class="relative flex items-center justify-center ${isSelected ? 'scale-125 z-50' : 'hover:scale-115'} transition-transform duration-200">
          ${
            pulseRing
              ? `<span class="absolute -inset-1 rounded-full bg-rose-500/40 dark:bg-rose-400/40 animate-ping pointer-events-none"></span>`
              : ''
          }
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr ${bgGradient} text-white font-extrabold text-xs flex items-center justify-center shadow-lg border-2 ${borderGlow} ${
            isSelected ? 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''
          }">
            #${rank}
          </div>
          <!-- Mũi nhọn tam giác chỉ vị trí -->
          <div class="absolute -bottom-1 w-2 h-2 rotate-45 bg-slate-900 dark:bg-slate-100 border-r border-b border-white/40"></div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectPoint(pt);
        openPopupForPoint(map, pt);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pt.longitude, pt.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  };

  const latestRadarImage = radarRainImages?.[0]?.imageUrl || null;

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
      {/* 1. Header Toolbar */}
      <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              Bản Đồ Điểm Mưa Trọng Điểm
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60">
                {points.length} điểm
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {timeVn ? `Mốc dữ liệu: ${timeVn}` : 'Tọa độ quan trắc trạm Hymetnet'}
            </p>
          </div>
        </div>

        {/* View Mode & Map Controls */}
        <div className="flex items-center gap-2">
          {/* Chuyển chế độ: Map vs Ảnh Radar QPE */}
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'map'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Bản đồ GIS</span>
            </button>
            <button
              onClick={() => setViewMode('radar_qpe')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'radar_qpe'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Radar QPE</span>
            </button>
          </div>

          {viewMode === 'map' && (
            <>
              {/* Basemap switcher */}
              <div className="hidden sm:flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
                <button
                  onClick={() => setActiveBasemap('dark_matter')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    activeBasemap === 'dark_matter'
                      ? 'bg-slate-900 text-white dark:bg-slate-700'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="Nền tối chuyên dụng khí tượng"
                >
                  🌙 Tối
                </button>
                <button
                  onClick={() => setActiveBasemap('satellite')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    activeBasemap === 'satellite'
                      ? 'bg-slate-900 text-white dark:bg-slate-700'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="Vệ tinh thực tế ESRI"
                >
                  🛰️ Vệ tinh
                </button>
                <button
                  onClick={() => setActiveBasemap('osm')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    activeBasemap === 'osm'
                      ? 'bg-slate-900 text-white dark:bg-slate-700'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="Bản đồ đường bộ OpenStreetMap"
                >
                  🗺️ OSM
                </button>
              </div>

              {/* Nút Toàn Cảnh (Fit Bounds) */}
              <button
                onClick={() => fitAllPoints(mapInstanceRef.current, points)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                title="Bao trọn tất cả điểm mưa (Fit to all points)"
              >
                <LocateFixed className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Main Map / Radar Display Area */}
      <div className="relative w-full h-[520px] lg:h-[600px] bg-slate-950">
        {/* VIEW 1: MapLibre Map */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full ${viewMode === 'map' ? 'block' : 'hidden'}`}
        />

        {/* Legend Overlay góc dưới trái bản đồ */}
        {viewMode === 'map' && (
          <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 shadow-xl space-y-1.5 pointer-events-auto max-w-[240px]">
            <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs pb-1 border-b border-slate-700/60">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Chú Giải Thứ Hạng Mưa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-white/50">
                #1
              </span>
              <span>Điểm mưa lớn nhất (#1)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                #2
              </span>
              <span>Điểm mưa trọng điểm (#2 - #3)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                #
              </span>
              <span>Các điểm mưa khác (#4 trở lên)</span>
            </div>
            <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-800">
              * Click vào marker hoặc dòng ở bảng để xem chi tiết
            </div>
          </div>
        )}

        {/* Selected Point Banner nếu có */}
        {viewMode === 'map' && selectedPoint && (
          <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-cyan-500/50 text-xs text-white shadow-xl flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <div>
              <span className="font-bold text-cyan-400">
                #{selectedPoint.globalRank || selectedPoint.rank + 1}:
              </span>{' '}
              <strong className="text-white">{selectedPoint.district}</strong> ({selectedPoint.province})
            </div>
            <a
              href={`https://www.google.com/maps?q=${selectedPoint.latitude},${selectedPoint.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-cyan-300 hover:underline flex items-center gap-0.5 ml-1"
            >
              Maps <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* VIEW 2: Static Radar QPE Image */}
        {viewMode === 'radar_qpe' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
            {latestRadarImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={latestRadarImage}
                  alt="Ảnh Radar Mưa Tích Lũy QPE"
                  className={`max-w-full max-h-full object-contain transition-transform duration-300 ${
                    radarZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
                  }`}
                  onClick={() => setRadarZoomed(!radarZoomed)}
                />
                <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                  <span>{radarZoomed ? 'Click để thu nhỏ' : 'Click để phóng to'}</span>
                  <a
                    href={latestRadarImage}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    Xem ảnh gốc <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Chưa có ảnh Radar mưa tích lũy QPE cho mốc này.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Footer Bar */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-500" />
          Bản đồ MapLibre WebGL hiển thị vị trí các tâm mưa lớn quét từ Hymetnet.
        </span>
        <button
          onClick={() => fitAllPoints(mapInstanceRef.current, points)}
          className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium cursor-pointer"
        >
          Đặt lại góc nhìn
        </button>
      </div>
    </div>
  );
}
