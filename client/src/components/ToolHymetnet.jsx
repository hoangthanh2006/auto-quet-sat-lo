import { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  CloudRain,
  Radio,
  Clock,
  RefreshCw,
  ExternalLink,
  Search,
  Filter,
  Layers,
  ChevronRight,
  AlertTriangle,
  Play,
  Pause,
  MapPin,
  CheckCircle2,
  Calendar,
  Activity,
  Download,
  Info,
  Sliders
} from 'lucide-react';
import {
  getHymetnetLatestData,
  subscribeHymetnetRealtime,
  triggerHymetnetManualSync,
  getHymetnetHistoryTimeline
} from '../services/hymetnetClientService';
import { HYMETNET_RADAR_STATIONS } from '../services/hymetnetClientService';

export default function ToolHymetnet() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('dongset'); // 'dongset' | 'lightning' | 'rain' | 'radar' | 'timeline'
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncMessage, setSyncMessage] = useState(null);

  // Filter states
  const [dongSetStep, setDongSetStep] = useState('all');
  const [dongSetSearch, setDongSetSearch] = useState('');
  const [lightningFilterType, setLightningFilterType] = useState('all'); // 'all' | 'CG' | 'CC'
  const [lightningSearch, setLightningSearch] = useState('');
  const [radarFrameIdx, setRadarFrameIdx] = useState(0);
  const [radarPlaying, setRadarPlaying] = useState(false);
  const [radarLayerType, setRadarLayerType] = useState('cmax'); // 'cmax' | 'sat_ir' | 'sat_vsb'
  const [historyTimeline, setHistoryTimeline] = useState([]);

  // Tải dữ liệu ban đầu và đăng ký lắng nghe WebSocket Firebase
  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const res = await getHymetnetLatestData();
        if (res.success && res.data && isMounted) {
          setData(res.data);
          setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
        } else if (isMounted) {
          setError(res.message || 'Không thể tải dữ liệu từ Hymetnet');
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitial();

    // Lắng nghe thay đổi real-time từ Firebase RTDB
    const unsubscribe = subscribeHymetnetRealtime('all', (res) => {
      if (res.success && res.data && isMounted) {
        setData(res.data);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
      }
    });

    // Lấy chuỗi lịch sử 2h
    getHymetnetHistoryTimeline(24).then((res) => {
      if (res.success && Array.isArray(res.data) && isMounted) {
        setHistoryTimeline(res.data);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Animation player cho khung radar
  useEffect(() => {
    let timer = null;
    const timeline = data?.layers?.radar?.timeline || [];
    if (radarPlaying && timeline.length > 1) {
      timer = setInterval(() => {
        setRadarFrameIdx((prev) => (prev + 1) % timeline.length);
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [radarPlaying, data?.layers?.radar?.timeline]);

  // Kích hoạt quét thủ công
  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await triggerHymetnetManualSync();
      if (res.success) {
        setSyncMessage('Đã quét và đồng bộ dữ liệu mới nhất lên Firebase thành công!');
        const fresh = await getHymetnetLatestData();
        if (fresh.success && fresh.data) {
          setData(fresh.data);
          setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
        }
      } else {
        setSyncMessage(`Lỗi đồng bộ: ${res.error || res.message}`);
      }
    } catch (err) {
      setSyncMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Trích xuất các lớp dữ liệu
  const summary = data?.summary || {};
  const counts = data?.counts || {};
  const dongSetLayer = data?.layers?.dong_set || {};
  const lightningLayer = data?.layers?.lightning || {};
  const rainLayer = data?.layers?.rain || {};
  const radarLayer = data?.layers?.radar || {};

  // Lọc danh sách cảnh báo dông sét
  const filteredDongSetItems = useMemo(() => {
    const steps = dongSetLayer.steps || [];
    let items = [];
    if (dongSetStep === 'all') {
      steps.forEach((s) => {
        items.push(...(s.items || []));
      });
    } else {
      const targetStep = steps.find((s) => String(s.forecastMinutes) === String(dongSetStep));
      if (targetStep) items = targetStep.items || [];
    }

    if (!dongSetSearch.trim()) return items;
    const q = dongSetSearch.toLowerCase().trim();
    return items.filter(
      (it) =>
        (it.commune || '').toLowerCase().includes(q) ||
        (it.province || '').toLowerCase().includes(q)
    );
  }, [dongSetLayer, dongSetStep, dongSetSearch]);

  // Lọc danh sách các cú sét
  const filteredStrikes = useMemo(() => {
    const all = lightningLayer.latestStrikes || [];
    return all.filter((s) => {
      if (lightningFilterType !== 'all' && s.type !== lightningFilterType) return false;
      if (!lightningSearch.trim()) return true;
      const q = lightningSearch.toLowerCase().trim();
      return (
        String(s.lat).includes(q) ||
        String(s.lng).includes(q) ||
        (s.time || '').toLowerCase().includes(q)
      );
    });
  }, [lightningLayer, lightningFilterType, lightningSearch]);

  // Xuất file JSON
  const handleExportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hymetnet_${data.snapshotId || 'data'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* 1. Header & Status Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-amber-500 to-yellow-500 rounded-xl text-white shadow-md shadow-amber-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 font-heading">
                  Hymetnet - Dữ Liệu Khí Tượng Thủy Văn & Dông Sét
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Quan trắc & Cảnh báo thời gian thực từ Trung tâm Kỹ thuật Quan trắc KTTV (
                  <a
                    href="http://hymetnet.gov.vn/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    hymetnet.gov.vn
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  )
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Cron tự động: 2h/lần
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                Firebase Realtime Database Live
              </span>
              {data?.vnTime && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Bản tin: <strong className="text-slate-700 dark:text-slate-300">{data.vnTime}</strong>
                </span>
              )}
              {lastUpdated && (
                <span className="text-[11px] text-slate-400">· Cập nhật UI: {lastUpdated}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={handleExportJSON}
              disabled={!data}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Tải toàn bộ dữ liệu dạng JSON"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất JSON</span>
            </button>

            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Đang quét...' : 'Quét & Đồng Bộ Ngay'}</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}
      </div>

      {/* 2. KPI Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Dông sét */}
        <div
          onClick={() => setActiveTab('dongset')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'dongset'
              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
              : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cảnh Báo Dông Sét</span>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
              {counts.dong_set || summary.totalAlertCommunes || 0}
            </span>
            <span className="text-xs text-slate-500">xã/phường</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {summary.topDongSetProvinces?.[0]?.province
              ? `Tâm điểm: ${summary.topDongSetProvinces[0].province}`
              : 'Dự báo dông trong 60 phút'}
          </p>
        </div>

        {/* Card 2: Sét quan trắc */}
        <div
          onClick={() => setActiveTab('lightning')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'lightning'
              ? 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/20'
              : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-purple-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sét Quan Trắc Thực Tế</span>
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-heading">
              {(counts.lightning_strikes || summary.totalLightningStrikes || 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">cú sét</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Đất (CG): <strong className="text-rose-500">{summary.totalLightningCG || 0}</strong></span>
            <span>· Mây (CC): <strong className="text-indigo-400">{summary.totalLightningCC || 0}</strong></span>
          </div>
        </div>

        {/* Card 3: Mưa lớn */}
        <div
          onClick={() => setActiveTab('rain')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'rain'
              ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-700 ring-2 ring-cyan-500/20'
              : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-cyan-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Điểm Mưa Trọng Điểm</span>
            <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400">
              <CloudRain className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-heading">
              {counts.heavy_rain_points || summary.heavyRainPointsCount || 0}
            </span>
            <span className="text-xs text-slate-500">điểm đo mưa lớn</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {summary.topRainProvinces?.[0]?.province
              ? `Nhiều nhất: ${summary.topRainProvinces[0].province}`
              : 'Ảnh Radar tích lũy QPE'}
          </p>
        </div>

        {/* Card 4: Radar & Vệ tinh */}
        <div
          onClick={() => setActiveTab('radar')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'radar'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20'
              : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-indigo-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Radar & Mây Vệ Tinh</span>
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-heading">
              {counts.radar_frames || summary.radarFramesCount || 12}
            </span>
            <span className="text-xs text-slate-500">khung ảnh</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            10 trạm Radar KTTV Composite CMAX
          </p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('dongset')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'dongset'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Cảnh Báo Dông Sét (/dongset)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white">
            {counts.dong_set || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('lightning')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'lightning'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Sét Quan Trắc Thực Tế (/lightningmaps/)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white">
            {counts.lightning_strikes || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rain')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'rain'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CloudRain className="w-3.5 h-3.5" />
          <span>Mưa & Radar Mưa QPE (/rain/)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white">
            {counts.heavy_rain_points || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'radar'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Radar CMAX & Vệ Tinh IR/VSB</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'timeline'
              ? 'bg-slate-700 text-white shadow-md shadow-slate-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Lịch Sử Quét 2 Giờ & API</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500 mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Đang tải dữ liệu khí tượng thủy văn Hymetnet...
          </p>
          <p className="text-xs text-slate-400 mt-1">Đồng bộ từ Firebase Realtime Database & API hymetnet.gov.vn</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleManualSync}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CẢNH BÁO DÔNG SÉT */}
      {/* ========================================================================= */}
      {activeTab === 'dongset' && !loading && (
        <div className="space-y-4">
          {/* Top provinces with warnings */}
          {dongSetLayer.provinces && dongSetLayer.provinces.length > 0 && (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                Các Tỉnh/Thành Có Cảnh Báo Dông Sét Nhiều Nhất
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {dongSetLayer.provinces.map((prov) => (
                  <button
                    key={prov.province}
                    onClick={() => setDongSetSearch(prov.province)}
                    className="p-2.5 text-left rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-slate-200/60 dark:border-slate-700/60 transition cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {prov.province}
                    </div>
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                      {prov.communeCount} xã/phường
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls: Step & Search */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Mốc dự báo:
              </span>
              <button
                onClick={() => setDongSetStep('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  dongSetStep === 'all'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Tất cả (+10 đến +60p)
              </button>
              {(dongSetLayer.steps || []).map((st) => (
                <button
                  key={st.forecastMinutes}
                  onClick={() => setDongSetStep(String(st.forecastMinutes))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                    dongSetStep === String(st.forecastMinutes)
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  +{st.forecastMinutes} phút ({st.count})
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={dongSetSearch}
                onChange={(e) => setDongSetSearch(e.target.value)}
                placeholder="Tìm xã, phường, huyện, tỉnh..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {dongSetSearch && (
                <button
                  onClick={() => setDongSetSearch('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Table of communes */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Danh sách xã/phường có cảnh báo ({filteredDongSetItems.length} kết quả)
              </span>
              <span className="text-slate-400 text-[11px]">Nguồn: http://hymetnet.gov.vn/dongset</span>
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Xã / Phường / Thị trấn</th>
                    <th className="p-3">Tỉnh / Thành phố</th>
                    <th className="p-3">Thời gian dự báo</th>
                    <th className="p-3">Vĩ độ (Lat)</th>
                    <th className="p-3">Kinh độ (Lng)</th>
                    <th className="p-3 text-right">Xem bản đồ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDongSetItems.map((item, idx) => (
                    <tr key={`${item.commune}-${item.timeSlot}-${idx}`} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/50 transition">
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{item.commune}</span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{item.province}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          +{item.forecastMinutes} phút ({item.displayTime?.split(' ')[0] || item.timeSlot})
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{item.lat?.toFixed(4) || 'N/A'}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{item.lng?.toFixed(4) || 'N/A'}</td>
                      <td className="p-3 text-right">
                        {item.lat && item.lng ? (
                          <a
                            href={`https://www.google.com/maps?q=${item.lat},${item.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium"
                          >
                            Google Maps
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredDongSetItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                        Không tìm thấy xã/phường cảnh báo nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SÉT QUAN TRẮC THỰC TẾ */}
      {/* ========================================================================= */}
      {activeTab === 'lightning' && !loading && (
        <div className="space-y-4">
          {/* Controls: Type filter & Search */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Phân loại sét:</span>
              <button
                onClick={() => setLightningFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  lightningFilterType === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Tất cả ({(lightningLayer.summary?.totalStrikes || 0).toLocaleString()})
              </button>
              <button
                onClick={() => setLightningFilterType('CG')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  lightningFilterType === 'CG'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                ⚡ Sét mây - đất (CG): {lightningLayer.summary?.totalCG || 0}
              </button>
              <button
                onClick={() => setLightningFilterType('CC')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  lightningFilterType === 'CC'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                ☁️ Sét trong mây (CC): {lightningLayer.summary?.totalCC || 0}
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={lightningSearch}
                onChange={(e) => setLightningSearch(e.target.value)}
                placeholder="Tìm tọa độ, thời gian..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Table of strikes */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Nhật ký các cú sét đánh quan trắc thực địa ({filteredStrikes.length} cú sét hiển thị)
              </span>
              <span className="text-slate-400 text-[11px]">
                Biên độ cực đại: <strong>{lightningLayer.summary?.maxAmplitudeKa || 0} kA</strong>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Thời gian ghi nhận</th>
                    <th className="p-3">Loại sét</th>
                    <th className="p-3">Biên độ (kA)</th>
                    <th className="p-3">Vĩ độ (Lat)</th>
                    <th className="p-3">Kinh độ (Lng)</th>
                    <th className="p-3">Cảm biến ghi nhận</th>
                    <th className="p-3 text-right">Xem vị trí</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                  {filteredStrikes.slice(0, 500).map((st, idx) => (
                    <tr key={`${st.timestamp}-${st.lat}-${st.lng}-${idx}`} className="hover:bg-purple-50/40 dark:hover:bg-slate-800/50 transition">
                      <td className="p-3 text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-sans text-slate-800 dark:text-slate-200">{st.time}</td>
                      <td className="p-3 font-sans">
                        {st.type === 'CG' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                            ⚡ CG (Mây - Đất)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            ☁️ CC (Trong mây)
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {st.amplitudeKa !== null ? `${st.amplitudeKa} kA` : '--'}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{st.lat?.toFixed(4)}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{st.lng?.toFixed(4)}</td>
                      <td className="p-3 font-sans text-slate-500 text-[11px]">
                        {st.sensorCount ? `${st.sensorCount} sensor` : '--'}
                      </td>
                      <td className="p-3 text-right font-sans">
                        <a
                          href={`https://www.google.com/maps?q=${st.lat},${st.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium"
                        >
                          Bản đồ
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filteredStrikes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                        Không có cú sét nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MƯA & RADAR MƯA QPE */}
      {/* ========================================================================= */}
      {activeTab === 'rain' && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Cột trái: Bảng điểm mưa lớn */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-cyan-500" />
                  Các Điểm Mưa Lớn Trọng Điểm ({counts.heavy_rain_points || 0} điểm)
                </h3>

                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 text-[11px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="p-2.5">Thứ hạng</th>
                        <th className="p-2.5">Quận / Huyện</th>
                        <th className="p-2.5">Tỉnh / Thành phố</th>
                        <th className="p-2.5">Vĩ độ</th>
                        <th className="p-2.5">Kinh độ</th>
                        <th className="p-2.5 text-right">Maps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(rainLayer.stormFrames || [])
                        .flatMap((f) => f.points || [])
                        .map((pt, idx) => (
                          <tr key={`${pt.district}-${pt.province}-${idx}`} className="hover:bg-cyan-50/40 dark:hover:bg-slate-800/50 transition">
                            <td className="p-2.5 font-bold text-cyan-600 dark:text-cyan-400">#{idx + 1}</td>
                            <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{pt.district || 'N/A'}</td>
                            <td className="p-2.5 text-slate-700 dark:text-slate-300">{pt.province || 'N/A'}</td>
                            <td className="p-2.5 font-mono text-slate-500">{pt.latitude?.toFixed(4)}</td>
                            <td className="p-2.5 font-mono text-slate-500">{pt.longitude?.toFixed(4)}</td>
                            <td className="p-2.5 text-right">
                              <a
                                href={`https://www.google.com/maps?q=${pt.latitude},${pt.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 font-medium inline-flex items-center gap-0.5"
                              >
                                Xem
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Cột phải: Xem ảnh Radar mưa QPE */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-cyan-500" />
                    Ảnh Radar Mưa Tích Lũy QPE
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Cập nhật mốc gần nhất: {rainLayer.timeSlots?.[0]?.timeVn || 'N/A'}
                  </span>
                </div>

                {rainLayer.radarRainImages && rainLayer.radarRainImages.length > 0 ? (
                  <div className="space-y-3">
                    <div className="aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-800">
                      <img
                        src={rainLayer.radarRainImages[0].imageUrl}
                        alt="Radar Rain QPE"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                      Ảnh Radar ước lượng lượng mưa tích lũy (QPE) quét toàn mạng lưới trạm radar Việt Nam.
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Chưa có liên kết ảnh radar mưa cho mốc này.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RADAR CMAX & MÂY VỆ TINH */}
      {/* ========================================================================= */}
      {activeTab === 'radar' && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Trình chiếu chuỗi ảnh Radar / Vệ tinh */}
            <div className="lg:col-span-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRadarLayerType('cmax')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      radarLayerType === 'cmax'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Radar CMAX (Toàn quốc)
                  </button>
                  <button
                    onClick={() => setRadarLayerType('sat_ir')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      radarLayerType === 'sat_ir'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Vệ Tinh Hồng Ngoại (IR)
                  </button>
                  <button
                    onClick={() => setRadarLayerType('sat_vsb')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      radarLayerType === 'sat_vsb'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Vệ Tinh Khả Kiến (VSB)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRadarPlaying(!radarPlaying)}
                    className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                    title={radarPlaying ? 'Tạm dừng' : 'Chạy trình chiếu ảnh'}
                  >
                    {radarPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    Khung {radarFrameIdx + 1}/{(radarLayer.timeline || []).length || 12}
                  </span>
                </div>
              </div>

              {/* Khung hiển thị ảnh */}
              {radarLayer.timeline && radarLayer.timeline.length > 0 ? (
                <div className="space-y-3">
                  <div className="aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-800">
                    {(() => {
                      const cur = radarLayer.timeline[radarFrameIdx] || radarLayer.timeline[0];
                      let targetUrl = cur.radarCmaxUrl;
                      if (radarLayerType === 'sat_ir') targetUrl = cur.satelliteIrUrl;
                      if (radarLayerType === 'sat_vsb') targetUrl = cur.satelliteVisibleUrl;

                      return (
                        <>
                          <img
                            key={targetUrl}
                            src={targetUrl}
                            alt="Radar & Satellite Frame"
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[11px] font-mono">
                            {cur.timeVn || cur.timeKey}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Thanh trượt timeline qua các khung giờ */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 font-mono">Cũ hơn</span>
                    <input
                      type="range"
                      min={0}
                      max={(radarLayer.timeline?.length || 1) - 1}
                      value={radarFrameIdx}
                      onChange={(e) => setRadarFrameIdx(parseInt(e.target.value, 10))}
                      className="flex-1 cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">Mới nhất</span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chưa có chuỗi ảnh radar.
                </div>
              )}
            </div>

            {/* Danh mục 10 trạm radar KTTV */}
            <div className="lg:col-span-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-indigo-500" />
                Mạng Lưới 10 Trạm Radar KTTV
              </h3>

              <div className="space-y-2 max-h-[460px] overflow-y-auto">
                {(HYMETNET_RADAR_STATIONS || radarLayer.stations || []).map((station) => (
                  <div
                    key={station.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Trạm {station.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {station.province} · {station.region}
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-400">
                      <div>{station.lat}° N</div>
                      <div>{station.lng}° E</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: LỊCH SỬ QUÉT 2 GIỜ & THÔNG TIN HỆ THỐNG */}
      {/* ========================================================================= */}
      {activeTab === 'timeline' && !loading && (
        <div className="space-y-4">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Lịch Sử Đồng Bộ Snapshot Định Kỳ 2 Giờ (Firebase RTDB)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Hệ thống tự động quét và lưu bản ghi mỗi 2 giờ một lần qua GitHub Actions Cron và tiến trình ngầm server.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-3">Mã Snapshot</th>
                    <th className="p-3">Thời gian ghi nhận</th>
                    <th className="p-3">Cảnh báo dông</th>
                    <th className="p-3">Sét quan trắc</th>
                    <th className="p-3">Điểm mưa lớn</th>
                    <th className="p-3">Khung Radar</th>
                    <th className="p-3">Nguồn kích hoạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                  {historyTimeline.map((item, idx) => (
                    <tr key={item.snapshotId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {item.snapshotId}
                      </td>
                      <td className="p-3 font-sans text-slate-600 dark:text-slate-400">
                        {item.vnTime || item.timestamp}
                      </td>
                      <td className="p-3 font-bold text-amber-600">
                        {item.counts?.dong_set || 0} xã
                      </td>
                      <td className="p-3 font-bold text-purple-600">
                        {(item.counts?.lightning_strikes || 0).toLocaleString()} cú
                      </td>
                      <td className="p-3 font-bold text-cyan-600">
                        {item.counts?.heavy_rain_points || 0} điểm
                      </td>
                      <td className="p-3 text-slate-500">
                        {item.counts?.radar_frames || 12}
                      </td>
                      <td className="p-3 font-sans text-[11px] text-slate-400">
                        {item.source || 'cron_2h'}
                      </td>
                    </tr>
                  ))}
                  {historyTimeline.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400 text-xs">
                        Đang lưu trữ snapshot đầu tiên lên Firebase RTDB.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hướng dẫn API REST Endpoint */}
          <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-3 font-mono text-xs">
            <div className="text-sm font-bold text-amber-400 font-sans flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              REST API Endpoints (Backend Server)
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div><strong className="text-emerald-400">GET</strong>  /api/hymetnet/all <span className="text-slate-500 font-sans">- Lấy toàn bộ dữ liệu tổng hợp thời gian thực</span></div>
              <div><strong className="text-emerald-400">GET</strong>  /api/hymetnet/dongset <span className="text-slate-500 font-sans">- Cảnh báo dông sét 6 mốc (+10m đến +60m)</span></div>
              <div><strong className="text-emerald-400">GET</strong>  /api/hymetnet/lightning <span className="text-slate-500 font-sans">- Số liệu sét quan trắc thực tế CG/CC</span></div>
              <div><strong className="text-emerald-400">GET</strong>  /api/hymetnet/rain <span className="text-slate-500 font-sans">- Các điểm mưa lớn & radar mưa QPE</span></div>
              <div><strong className="text-emerald-400">GET</strong>  /api/hymetnet/radar <span className="text-slate-500 font-sans">- Radar Composite CMAX & Mây Vệ Tinh IR/VSB</span></div>
              <div><strong className="text-amber-400">POST</strong> /api/hymetnet/sync-now <span className="text-slate-500 font-sans">- Kích hoạt quét & lưu Firebase ngay lập tức</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
