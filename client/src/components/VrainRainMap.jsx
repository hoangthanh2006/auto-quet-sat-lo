import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Maximize2 } from 'lucide-react';
import { MAPLIBRE_BASEMAPS } from '../services/maplibreBasemaps';

if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  try {
    maplibregl.setWorkerUrl(workerUrl);
  } catch (e) {
    console.warn('Maplibre worker init:', e);
  }
}

const SOURCE_ID = 'vrain-stations';
const LAYER_ID = 'vrain-stations-circles';

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const toGeoJSON = (stations) => ({
  type: 'FeatureCollection',
  features: (stations || [])
    .filter((s) => Number.isFinite(s.lt) && Number.isFinite(s.lg))
    .map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lg, s.lt] },
      properties: { n: s.n || '', d: s.d || 0, l: s.l || '', c: s.c || '#38bdf8' }
    }))
});

/**
 * Bản đồ các trạm đo mưa Vrain (chỉ trạm đang có mưa).
 * Vòng tròn: màu theo cấp mưa, bán kính theo lượng mưa.
 */
export default function VrainRainMap({ stations = [], selectedStation = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const stationsRef = useRef(stations);
  const [basemap, setBasemap] = useState('dark_matter');

  stationsRef.current = stations;

  const styleOf = (id) => (MAPLIBRE_BASEMAPS[id] || MAPLIBRE_BASEMAPS.dark_matter).style;

  const applyLayers = (map) => {
    const data = toGeoJSON(stationsRef.current);
    if (map.getSource(SOURCE_ID)) {
      map.getSource(SOURCE_ID).setData(data);
      return;
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': ['get', 'c'],
        'circle-radius': ['interpolate', ['linear'], ['get', 'd'], 0, 3, 10, 5, 50, 9, 100, 13, 250, 20],
        'circle-opacity': 0.75,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.8,
        'circle-stroke-opacity': 0.8
      }
    });
  };

  const fitAll = (map, list) => {
    const pts = toGeoJSON(list).features;
    if (!pts.length) return;
    const bounds = new maplibregl.LngLatBounds();
    pts.forEach((f) => bounds.extend(f.geometry.coordinates));
    map.fitBounds(bounds, { padding: 50, maxZoom: 9, duration: 800 });
  };

  const openPopup = (map, lngLat, p) => {
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
      .setLngLat(lngLat)
      .setHTML(
        `<div style="font-family:system-ui;font-size:12px;color:#0f172a;min-width:160px">
          <div style="font-weight:700;font-size:13px">${escapeHtml(p.n)}</div>
          <div style="margin-top:4px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${escapeHtml(p.c)};margin-right:6px"></span>${escapeHtml(p.l)}</div>
          <div style="margin-top:2px;font-weight:700">${Number(p.d).toFixed(1)} mm</div>
        </div>`
      )
      .addTo(map);
  };

  // Khởi tạo bản đồ
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleOf('dark_matter'),
      center: [106.0, 16.2],
      zoom: 5.2,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      applyLayers(map);
      fitAll(map, stationsRef.current);
    });
    map.on('click', LAYER_ID, (e) => {
      const f = e.features?.[0];
      if (f) openPopup(map, e.lngLat, f.properties);
    });
    map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đổi basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setStyle(styleOf(basemap));
    map.once('style.load', () => applyLayers(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // Cập nhật dữ liệu
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      applyLayers(map);
      fitAll(map, stations);
    };
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations]);

  // Bay tới trạm được chọn từ bảng
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStation) return;
    map.flyTo({ center: [selectedStation.lg, selectedStation.lt], zoom: 11, essential: true });
    openPopup(map, [selectedStation.lg, selectedStation.lt], selectedStation);
  }, [selectedStation]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-2 left-2 z-10 flex gap-1 bg-slate-900/80 backdrop-blur rounded-lg p-1">
        {[['dark_matter', 'Tối'], ['satellite', 'Vệ tinh'], ['osm', 'OSM']].map(([id, label]) => (
          <button
            key={id}
            id={`vrain-basemap-${id}`}
            onClick={() => setBasemap(id)}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
              basemap === id ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          id="vrain-map-fit"
          title="Toàn cảnh"
          onClick={() => mapRef.current && fitAll(mapRef.current, stations)}
          className="px-2 py-1 text-slate-300 hover:bg-slate-700 rounded-md"
        >
          <Maximize2 size={13} />
        </button>
      </div>
    </div>
  );
}
