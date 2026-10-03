import { useState, useEffect, useMemo, useRef } from 'react';
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
  Sliders,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  ListFilter,
  Check,
  Map,
  X,
  Eye
} from 'lucide-react';
import {
  getHymetnetLatestData,
  subscribeHymetnetRealtime,
  triggerHymetnetManualSync,
  getHymetnetHistoryTimeline,
  getHymetnetSnapshotData
} from '../services/hymetnetClientService';
import { HYMETNET_RADAR_STATIONS } from '../services/hymetnetClientService';
import HymetnetRainMap from './HymetnetRainMap';

export default function ToolHymetnet() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('dongset'); // 'dongset' | 'lightning' | 'rain' | 'radar' | 'timeline'
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncMessage, setSyncMessage] = useState(null);

  // States quản lý snapshot lịch sử
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
  const [loadingSnapshotId, setLoadingSnapshotId] = useState(null);
  const selectedSnapshotIdRef = useRef(null);
  selectedSnapshotIdRef.current = selectedSnapshotId;

  // Filter states
  const [dongSetStep, setDongSetStep] = useState('all');
  const [dongSetSearch, setDongSetSearch] = useState('');
  const [lightningFilterType, setLightningFilterType] = useState('all'); // 'all' | 'CG' | 'CC'
  const [lightningSearch, setLightningSearch] = useState('');
  const [radarFrameIdx, setRadarFrameIdx] = useState(0);
  const [radarPlaying, setRadarPlaying] = useState(false);
  const [radarLayerType, setRadarLayerType] = useState('cmax'); // 'cmax' | 'sat_ir' | 'sat_vsb'
  const [historyTimeline, setHistoryTimeline] = useState([]);

  // States cho Tab Mưa Lớn Trọng Điểm (/rain/)
  const [rainSearch, setRainSearch] = useState('');
  const [rainProvinceFilter, setRainProvinceFilter] = useState('all');
  const [rainLetterFilter, setRainLetterFilter] = useState('all');
  const [rainTimeFilter, setRainTimeFilter] = useState('all');
  const [rainSortColumn, setRainSortColumn] = useState('rank'); // 'rank' | 'district' | 'province' | 'latitude' | 'longitude'
  const [rainSortOrder, setRainSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [selectedRainPoint, setSelectedRainPoint] = useState(null);

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
        // Chỉ tự động cập nhật nếu không đang ở chế độ xem snapshot lịch sử
        if (!selectedSnapshotIdRef.current) {
          setData(res.data);
          setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
        }
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
          setSelectedSnapshotId(null);
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

  // Chọn và nạp dữ liệu snapshot lịch sử
  const handleSelectSnapshot = async (item, targetTab = null) => {
    const snapshotId = typeof item === 'string' ? item : item?.snapshotId;
    if (!snapshotId) return;

    if (selectedSnapshotId === snapshotId) {
      if (targetTab) setActiveTab(targetTab);
      return;
    }

    setLoadingSnapshotId(snapshotId);
    setSyncMessage(`Đang nạp dữ liệu snapshot ${snapshotId}...`);
    try {
      const res = await getHymetnetSnapshotData(snapshotId);
      if (res.success && res.data) {
        setData(res.data);
        setSelectedSnapshotId(snapshotId);
        setLastUpdated(res.data.vnTime || item?.vnTime || new Date().toLocaleTimeString('vi-VN'));
        setSyncMessage(`Đã nạp thành công bản ghi ${snapshotId} (${res.data.vnTime || item?.vnTime || ''}). Các tab Dông sét, Sét quan trắc, Mưa & Radar đã đồng bộ về mốc này.`);
        if (targetTab) {
          setActiveTab(targetTab);
        }
      } else {
        setSyncMessage(`Lỗi tải dữ liệu snapshot: ${res.message || 'Không tìm thấy dữ liệu'}`);
      }
    } catch (err) {
      setSyncMessage(`Lỗi khi nạp snapshot: ${err.message}`);
    } finally {
      setLoadingSnapshotId(null);
    }
  };

  // Quay về dữ liệu trực tiếp mới nhất (Live)
  const handleReturnToLive = async () => {
    setLoadingSnapshotId('live');
    setSyncMessage('Đang lấy dữ liệu trực tiếp mới nhất...');
    try {
      const res = await getHymetnetLatestData();
      if (res.success && res.data) {
        setData(res.data);
        setSelectedSnapshotId(null);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
        setSyncMessage('Đã quay về chế độ xem dữ liệu trực tiếp mới nhất (Live).');
      } else {
        setSyncMessage(`Không thể lấy dữ liệu mới nhất: ${res.message}`);
      }
    } catch (err) {
      setSyncMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setLoadingSnapshotId(null);
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

  // Chuẩn hóa toàn bộ danh sách điểm mưa lớn từ các frame dữ liệu
  const allRainPoints = useMemo(() => {
    const frames = rainLayer.stormFrames || [];
    let list = [];
    let idx = 1;

    if (frames.length > 0) {
      frames.forEach((f) => {
        (f.points || []).forEach((pt) => {
          list.push({
            ...pt,
            id: `rain-${f.frameIndex}-${pt.district}-${pt.province}-${pt.latitude}-${pt.longitude}-${idx}`,
            globalRank: idx,
            displayRank: idx,
            timeVn: f.timeVn || pt.timeVn || 'N/A',
            timeKey: f.timeKey || pt.timeKey || '',
            frameIndex: f.frameIndex
          });
          idx++;
        });
      });
    } else if (Array.isArray(rainLayer.points)) {
      rainLayer.points.forEach((pt) => {
        list.push({
          ...pt,
          id: `rain-pt-${pt.district}-${pt.province}-${idx}`,
          globalRank: idx,
          displayRank: idx,
          timeVn: pt.timeVn || 'N/A',
          timeKey: pt.timeKey || '',
          frameIndex: 0
        });
        idx++;
      });
    }

    return list;
  }, [rainLayer]);

  // Danh sách các tỉnh thành duy nhất có điểm mưa lớn
  const uniqueRainProvinces = useMemo(() => {
    const counts = {};
    allRainPoints.forEach((pt) => {
      if (pt.province) {
        counts[pt.province] = (counts[pt.province] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [allRainPoints]);

  // Danh sách các chữ cái đầu tiên có trong dữ liệu (Quận/Huyện hoặc Tỉnh)
  const uniqueRainLetters = useMemo(() => {
    const letters = new Set();
    allRainPoints.forEach((pt) => {
      if (pt.district) {
        const char = pt.district.trim().charAt(0).toUpperCase();
        if (char) letters.add(char);
      }
      if (pt.province) {
        const char = pt.province.trim().charAt(0).toUpperCase();
        if (char) letters.add(char);
      }
    });
    return Array.from(letters).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allRainPoints]);

  // Bộ lọc và sắp xếp cho bảng điểm mưa lớn
  const filteredAndSortedRainPoints = useMemo(() => {
    let list = [...allRainPoints];

    // 1. Lọc theo mốc thời gian
    if (rainTimeFilter !== 'all') {
      list = list.filter((pt) => String(pt.frameIndex) === String(rainTimeFilter));
    }

    // 2. Lọc theo tỉnh / thành phố
    if (rainProvinceFilter !== 'all') {
      list = list.filter((pt) => pt.province === rainProvinceFilter);
    }

    // 3. Lọc theo chữ cái ở đầu tên Quận/Huyện hoặc Tỉnh
    if (rainLetterFilter !== 'all') {
      const letter = rainLetterFilter.toUpperCase();
      list = list.filter((pt) => {
        const d = (pt.district || '').trim().toUpperCase();
        const p = (pt.province || '').trim().toUpperCase();
        return d.startsWith(letter) || p.startsWith(letter);
      });
    }

    // 4. Lọc theo chuỗi tìm kiếm
    if (rainSearch.trim()) {
      const q = rainSearch.toLowerCase().trim();
      list = list.filter(
        (pt) =>
          (pt.district || '').toLowerCase().includes(q) ||
          (pt.province || '').toLowerCase().includes(q) ||
          String(pt.latitude).includes(q) ||
          String(pt.longitude).includes(q)
      );
    }

    // 5. Sắp xếp đa tiêu chí (Thứ hạng, Quận/Huyện A-Z, Tỉnh/TP A-Z, Tọa độ)
    list.sort((a, b) => {
      let cmp = 0;
      if (rainSortColumn === 'rank') {
        cmp = (a.globalRank || 0) - (b.globalRank || 0);
      } else if (rainSortColumn === 'district') {
        cmp = (a.district || '').localeCompare(b.district || '', 'vi', { numeric: true, sensitivity: 'base' });
      } else if (rainSortColumn === 'province') {
        cmp = (a.province || '').localeCompare(b.province || '', 'vi', { numeric: true, sensitivity: 'base' });
      } else if (rainSortColumn === 'latitude') {
        cmp = (a.latitude || 0) - (b.latitude || 0);
      } else if (rainSortColumn === 'longitude') {
        cmp = (a.longitude || 0) - (b.longitude || 0);
      }
      return rainSortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [
    allRainPoints,
    rainTimeFilter,
    rainProvinceFilter,
    rainLetterFilter,
    rainSearch,
    rainSortColumn,
    rainSortOrder
  ]);

  // Handler sắp xếp cột khi click vào Header
  const handleSortRainColumn = (col) => {
    if (rainSortColumn === col) {
      if (rainSortOrder === 'asc') {
        setRainSortOrder('desc');
      } else {
        setRainSortColumn('rank');
        setRainSortOrder('asc');
      }
    } else {
      setRainSortColumn(col);
      setRainSortOrder('asc');
    }
  };

  // Handler reset toàn bộ bộ lọc
  const handleResetRainFilters = () => {
    setRainSearch('');
    setRainProvinceFilter('all');
    setRainLetterFilter('all');
    setRainTimeFilter('all');
    setRainSortColumn('rank');
    setRainSortOrder('asc');
    setSelectedRainPoint(null);
  };

  const isRainFilterActive =
    rainSearch.trim() !== '' ||
    rainProvinceFilter !== 'all' ||
    rainLetterFilter !== 'all' ||
    rainTimeFilter !== 'all' ||
    rainSortColumn !== 'rank' ||
    rainSortOrder !== 'asc';

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
              {selectedSnapshotId ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  Đang xem Snapshot: {selectedSnapshotId}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                  Firebase Realtime Database Live
                </span>
              )}
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

        {selectedSnapshotId && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border-2 border-amber-500/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-100 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-black text-[10px] tracking-wide uppercase shadow-xs shrink-0">
                SNAPSHOT LỊCH SỬ
              </span>
              <div>
                <span className="font-bold">
                  Đang xem bản ghi: {selectedSnapshotId}
                </span>
                <span className="text-slate-600 dark:text-slate-300 ml-1.5">
                  (Mốc thời gian: <strong className="text-amber-800 dark:text-amber-300">{data?.vnTime || selectedSnapshotId}</strong>)
                </span>
                <span className="hidden lg:inline text-slate-500 dark:text-slate-400 ml-2">
                  — Toàn bộ số liệu các tab Dông sét, Sét quan trắc, Mưa & Radar đang hiển thị mốc này.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReturnToLive}
                disabled={loadingSnapshotId === 'live'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingSnapshotId === 'live' ? 'animate-spin' : ''}`} />
                <span>Quay về Live mới nhất</span>
              </button>
            </div>
          </div>
        )}

        {syncMessage && (
          <div className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
            syncMessage.startsWith('Lỗi')
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200'
          }`}>
            {syncMessage.startsWith('Lỗi') ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="flex-1">{syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-xs opacity-60 hover:opacity-100 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
            >
              ✕
            </button>
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
            {/* Cột trái: Bảng điểm mưa lớn với sắp xếp và lọc đa tiêu chí */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
                {/* 1. Header Bảng */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CloudRain className="w-4 h-4 text-cyan-500" />
                      Điểm Mưa Lớn Trọng Điểm
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hiển thị <strong className="text-cyan-600 dark:text-cyan-400 font-bold">{filteredAndSortedRainPoints.length}</strong> / {allRainPoints.length} điểm
                      </span>
                      {selectedRainPoint && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 font-medium">
                          Đã chọn: #{selectedRainPoint.displayRank} {selectedRainPoint.district}
                        </span>
                      )}
                    </div>
                  </div>

                  {isRainFilterActive && (
                    <button
                      onClick={handleResetRainFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition cursor-pointer"
                      title="Đặt lại toàn bộ bộ lọc và sắp xếp"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Xóa bộ lọc</span>
                    </button>
                  )}
                </div>

                {/* 2. Bộ lọc Tìm kiếm, Tỉnh/Thành phố & Mốc thời gian */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* Tìm kiếm */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={rainSearch}
                      onChange={(e) => setRainSearch(e.target.value)}
                      placeholder="Tìm quận huyện, tỉnh..."
                      className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-800 dark:text-slate-100"
                    />
                    {rainSearch && (
                      <button
                        onClick={() => setRainSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Lọc theo Tỉnh/Thành phố */}
                  <div>
                    <select
                      value={rainProvinceFilter}
                      onChange={(e) => setRainProvinceFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="all">📍 Tất cả tỉnh thành ({allRainPoints.length})</option>
                      {uniqueRainProvinces.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} ({p.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lọc theo Mốc giờ */}
                  <div>
                    <select
                      value={rainTimeFilter}
                      onChange={(e) => setRainTimeFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="all">⏰ Tất cả các mốc giờ</option>
                      {(rainLayer.stormFrames || []).map((f) => (
                        <option key={f.frameIndex} value={String(f.frameIndex)}>
                          Frame #{f.frameIndex + 1} ({f.count} điểm) {f.timeVn ? `· ${f.timeVn}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Thanh Lọc Nhanh Theo Chữ Cái (A - Z) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs text-slate-500 scrollbar-thin">
                  <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0 flex items-center gap-1">
                    <ListFilter className="w-3 h-3 text-cyan-500" />
                    Chữ cái:
                  </span>
                  <button
                    onClick={() => setRainLetterFilter('all')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                      rainLetterFilter === 'all'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả
                  </button>
                  {uniqueRainLetters.map((l) => (
                    <button
                      key={l}
                      onClick={() => setRainLetterFilter(l === rainLetterFilter ? 'all' : l)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                        rainLetterFilter === l
                          ? 'bg-cyan-600 text-white shadow-sm scale-105'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={`Lọc địa danh bắt đầu bằng chữ '${l}'`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                {/* 4. Bảng Dữ Liệu có Header Sắp Xếp */}
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-10 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider shadow-sm select-none">
                      <tr>
                        {/* Header Thứ Hạng */}
                        <th className="p-2.5">
                          <button
                            onClick={() => handleSortRainColumn('rank')}
                            className="flex items-center gap-1 group font-bold hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                            title="Nhấn để sắp xếp theo Thứ hạng mưa"
                          >
                            <span>Thứ hạng</span>
                            {rainSortColumn === 'rank' ? (
                              rainSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-500" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>

                        {/* Header Quận / Huyện A-Z */}
                        <th className="p-2.5">
                          <button
                            onClick={() => handleSortRainColumn('district')}
                            className="flex items-center gap-1 group font-bold hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                            title="Nhấn để sắp xếp theo chữ cái Quận / Huyện (A-Z)"
                          >
                            <span>Quận / Huyện</span>
                            {rainSortColumn === 'district' ? (
                              rainSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-500" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>

                        {/* Header Tỉnh / Thành Phố A-Z */}
                        <th className="p-2.5">
                          <button
                            onClick={() => handleSortRainColumn('province')}
                            className="flex items-center gap-1 group font-bold hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                            title="Nhấn để sắp xếp theo chữ cái Tỉnh / Thành phố (A-Z)"
                          >
                            <span>Tỉnh / TP</span>
                            {rainSortColumn === 'province' ? (
                              rainSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-500" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>

                        {/* Header Vĩ độ */}
                        <th className="p-2.5">
                          <button
                            onClick={() => handleSortRainColumn('latitude')}
                            className="flex items-center gap-1 group font-bold hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                            title="Sắp xếp theo Vĩ độ"
                          >
                            <span>Vĩ độ</span>
                            {rainSortColumn === 'latitude' ? (
                              rainSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-500" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>

                        {/* Header Kinh độ */}
                        <th className="p-2.5">
                          <button
                            onClick={() => handleSortRainColumn('longitude')}
                            className="flex items-center gap-1 group font-bold hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                            title="Sắp xếp theo Kinh độ"
                          >
                            <span>Kinh độ</span>
                            {rainSortColumn === 'longitude' ? (
                              rainSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-500" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>

                        {/* Header Maps */}
                        <th className="p-2.5 text-right">Maps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAndSortedRainPoints.map((pt) => {
                        const isSelected = selectedRainPoint && selectedRainPoint.id === pt.id;
                        const rank = pt.displayRank || pt.globalRank || pt.rank + 1;

                        let rankStyle = 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800/60';
                        if (rank === 1) {
                          rankStyle = 'text-white bg-gradient-to-tr from-rose-600 to-red-500 border-rose-300 font-extrabold shadow-sm';
                        } else if (rank <= 3) {
                          rankStyle = 'text-white bg-gradient-to-tr from-amber-500 to-orange-500 border-amber-300 font-bold shadow-sm';
                        }

                        return (
                          <tr
                            key={pt.id}
                            onClick={() => setSelectedRainPoint(pt)}
                            className={`transition cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-100/60 dark:bg-cyan-950/60 ring-1 ring-cyan-500'
                                : 'hover:bg-cyan-50/40 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="p-2.5">
                              <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-[11px] border ${rankStyle}`}>
                                #{rank}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                              {pt.district || 'N/A'}
                            </td>
                            <td className="p-2.5 text-slate-700 dark:text-slate-300">
                              {pt.province || 'N/A'}
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-500">
                              {pt.latitude?.toFixed(4)}
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-500">
                              {pt.longitude?.toFixed(4)}
                            </td>
                            <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedRainPoint(pt)}
                                  className="text-[11px] px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900 transition flex items-center gap-1 font-medium cursor-pointer"
                                  title="Ghim và phóng to điểm này trên bản đồ"
                                >
                                  <MapPin className="w-3 h-3" />
                                  <span>Ghim</span>
                                </button>
                                <a
                                  href={`https://www.google.com/maps?q=${pt.latitude},${pt.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 inline-flex items-center p-1"
                                  title="Mở Google Maps vệ tinh"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredAndSortedRainPoints.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                            <div className="space-y-2">
                              <p>Không tìm thấy điểm mưa nào phù hợp với bộ lọc hiện tại.</p>
                              <button
                                onClick={handleResetRainFilters}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 transition cursor-pointer"
                              >
                                Đặt lại bộ lọc
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Cột phải: Bản đồ MapLibre trực quan điểm mưa lớn & Radar QPE */}
            <div className="lg:col-span-6 space-y-4">
              <HymetnetRainMap
                points={filteredAndSortedRainPoints}
                selectedPoint={selectedRainPoint}
                onSelectPoint={(pt) => setSelectedRainPoint(pt)}
                timeVn={rainLayer.timeSlots?.[0]?.timeVn || data?.vnTime || ''}
                radarRainImages={rainLayer.radarRainImages || []}
              />
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
                    <th className="p-3">MÃ SNAPSHOT</th>
                    <th className="p-3">THỜI GIAN GHI NHẬN</th>
                    <th className="p-3">CẢNH BÁO DÔNG</th>
                    <th className="p-3">SÉT QUAN TRẮC</th>
                    <th className="p-3">ĐIỂM MƯA LỚN</th>
                    <th className="p-3">KHUNG RADAR</th>
                    <th className="p-3">NGUỒN KÍCH HOẠT</th>
                    <th className="p-3 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                  {historyTimeline.map((item, idx) => {
                    const isSelected = selectedSnapshotId === item.snapshotId;
                    const isLoadingThis = loadingSnapshotId === item.snapshotId;

                    return (
                      <tr
                        key={item.snapshotId || idx}
                        onClick={() => handleSelectSnapshot(item)}
                        title="Nhấp để tải và xem dữ liệu snapshot này"
                        className={`transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-100/70 dark:bg-amber-950/40 border-l-4 border-l-amber-500 font-semibold'
                            : 'hover:bg-amber-50/50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span>{item.snapshotId}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-500 text-white shadow-xs">
                                Đang xem
                              </span>
                            )}
                          </div>
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
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {isLoadingThis ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Đang tải...
                            </span>
                          ) : isSelected ? (
                            <button
                              type="button"
                              onClick={() => handleReturnToLive()}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition inline-flex items-center gap-1 cursor-pointer"
                              title="Trở về chế độ xem dữ liệu trực tiếp mới nhất"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Về Live</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectSnapshot(item)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Xem dữ liệu</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {historyTimeline.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                        Đang nạp dữ liệu snapshot từ Firebase RTDB...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedSnapshotId && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Đang hiển thị bản ghi <strong>{selectedSnapshotId}</strong> ({data?.vnTime || ''}). Chuyển nhanh đến:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dongset')}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer shadow-xs transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Cảnh Báo Dông Sét</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lightning')}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer shadow-xs transition"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Sét Quan Trắc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('rain')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer shadow-xs transition"
                  >
                    <CloudRain className="w-3.5 h-3.5" />
                    <span>Mưa & Radar Mưa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('radar')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer shadow-xs transition"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Radar & Vệ Tinh</span>
                  </button>
                </div>
              </div>
            )}
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
