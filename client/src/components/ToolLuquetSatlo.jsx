import { useState, useEffect, useMemo } from 'react';
import {
  Waves,
  CloudRain,
  AlertTriangle,
  MapPin,
  Search,
  Download,
  Copy,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  Calendar,
  Clock,
  Compass,
  Layers,
  FileSpreadsheet,
  FileCode,
  Map,
  ArrowUpDown,
  Activity,
  Droplets,
  ShieldAlert,
  Radio,
  Eye,
  Sliders,
  Play,
  Pause,
  Database,
  DownloadCloud,
  History,
  Check,
  Sparkles,
  BarChart3,
  TrendingUp,
  PieChart,
  Zap,
  Trash2,
  Timer,
  Bell,
  ArrowUpRight,
  Info,
  RotateCcw
} from 'lucide-react';
import {
  fetchLuquetSatloProvinces,
  fetchLuquetSatloCanhBao,
  fetchLuquetSatloDiemSatLo,
  fetchLuquetSatloTramMua,
  fetchLuquetSatloDoAmDat,
  fetchLuquetSatloDiemDaXayRaSatLo,
  fetchLuquetSatloDiemDaXayRaLuQuet,
  fetchLuquetSatloTrongDiemSLLQ,
  fetchLuquetSatloRadar,
  triggerServerAutoSync,
  getServerAutoSyncStatus
} from '../services/api';
import {
  saveLuquetSatloToRTDB,
  fetchLuquetSatloFromRTDB,
  fetchLuquetSatloHistory,
  subscribeToLuquetSatlo,
  saveAutoSyncSnapshot,
  fetchStatisticsTimeline,
  fetchSnapshotDetail,
  deleteSnapshot,
  fetchAutoSyncStatus
} from '../services/firebase';
import DriveUploadButton from './DriveUploadButton';

// Helper to remove accents for filenames
function removeVietnameseTones(str) {
  if (!str) return 'luquet_satlo';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
}

export default function ToolLuquetSatlo() {
  // Navigation tabs: 'layers' (Bộ 4 lớp như hình) | 'canh-bao' | 'tram-mua' | 'do-am-dat'
  const [activeTab, setActiveTab] = useState('layers');

  // Common metadata
  const [provinces, setProvinces] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copiedText, setCopiedText] = useState(false);

  // Firebase Realtime DB State
  const [savingFirebase, setSavingFirebase] = useState(null); // layer key or 'all'
  const [loadingFirebase, setLoadingFirebase] = useState(null);
  const [firebaseSuccessMsg, setFirebaseSuccessMsg] = useState(null);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [firebaseHistoryList, setFirebaseHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryLayer, setSelectedHistoryLayer] = useState('canh_bao');

  // =========================================================================
  // TỰ ĐỘNG QUÉT (AUTO-SYNC) & THỐNG KÊ (ANALYTICS)
  // =========================================================================
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    return localStorage.getItem('nchmf_auto_sync_enabled') === 'true';
  });
  const [autoSyncInterval, setAutoSyncInterval] = useState(() => {
    return parseInt(localStorage.getItem('nchmf_auto_sync_interval') || '15', 10);
  });
  const [nextSyncCountdown, setNextSyncCountdown] = useState(15 * 60);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [showAutoSyncModal, setShowAutoSyncModal] = useState(false);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState(null);
  const [autoSyncLogs, setAutoSyncLogs] = useState([]);

  // Dữ liệu Thống kê chuỗi thời gian
  const [timelineData, setTimelineData] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [selectedSnapshotDetail, setSelectedSnapshotDetail] = useState(null);
  const [loadingSnapshotDetail, setLoadingSnapshotDetail] = useState(false);
  const [showSnapshotDetailModal, setShowSnapshotDetailModal] = useState(false);
  const [snapshotSearch, setSnapshotSearch] = useState('');
  const [activeStatProvince, setActiveStatProvince] = useState('all');
  const [statTimeframe, setStatTimeframe] = useState('all'); // 'all' | 'today' | 'week'

  // Bộ lọc thời gian nâng cao cho Thống kê
  const [filterPreset, setFilterPreset] = useState('all'); // 'all' | 'today' | '24h' | '3days' | '7days' | 'custom'
  const [filterCustomDate, setFilterCustomDate] = useState(''); // 'YYYY-MM-DD'
  const [filterHourPreset, setFilterHourPreset] = useState('all'); // 'all' | 'morning' | 'afternoon' | 'evening' | 'custom'
  const [filterStartHour, setFilterStartHour] = useState(0); // 0 - 23
  const [filterEndHour, setFilterEndHour] = useState(23); // 0 - 23

  // =========================================================================
  // 4 TRƯỜNG LẤY DỮ LIỆU NHƯ HÌNH:
  // 1. Dữ liệu radar (checked mặc định như hình)
  // 2. Điểm đã xảy ra sạt lở
  // 3. Điểm đã xảy ra lũ quét
  // 4. Trọng điểm sạt lở lũ quét
  // =========================================================================
  const [checkedRadar, setCheckedRadar] = useState(true);
  const [checkedSatLo, setCheckedSatLo] = useState(false);
  const [checkedLuQuet, setCheckedLuQuet] = useState(false);
  const [checkedTrongDiem, setCheckedTrongDiem] = useState(false);

  // Active view among the 4 layers: 'radar' | 'sat-lo' | 'lu-quet' | 'trong-diem'
  const [activeLayerSubTab, setActiveLayerSubTab] = useState('radar');

  // Layer 1: Radar Data
  const [radarData, setRadarData] = useState(null);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [selectedRadarIdx, setSelectedRadarIdx] = useState(0);
  const [isRadarPlaying, setIsRadarPlaying] = useState(false);

  // Layer 2: Điểm đã xảy ra sạt lở (12.506 điểm)
  const [dxrSatLoList, setDxrSatLoList] = useState([]);
  const [loadingDxrSatLo, setLoadingDxrSatLo] = useState(false);
  const [dxrSatLoSearch, setDxrSatLoSearch] = useState('');
  const [dxrSatLoProvince, setDxrSatLoProvince] = useState('');
  const [dxrSatLoPage, setDxrSatLoPage] = useState(1);
  const [dxrSatLoPageSize, setDxrSatLoPageSize] = useState(25);

  // Layer 3: Điểm đã xảy ra lũ quét (1.048 điểm)
  const [dxrLuQuetList, setDxrLuQuetList] = useState([]);
  const [loadingDxrLuQuet, setLoadingDxrLuQuet] = useState(false);
  const [dxrLuQuetSearch, setDxrLuQuetSearch] = useState('');
  const [dxrLuQuetProvince, setDxrLuQuetProvince] = useState('');
  const [dxrLuQuetPage, setDxrLuQuetPage] = useState(1);
  const [dxrLuQuetPageSize, setDxrLuQuetPageSize] = useState(25);

  // Layer 4: Trọng điểm sạt lở lũ quét (776 điểm)
  const [trongDiemList, setTrongDiemList] = useState([]);
  const [loadingTrongDiem, setLoadingTrongDiem] = useState(false);
  const [trongDiemSearch, setTrongDiemSearch] = useState('');
  const [trongDiemProvince, setTrongDiemProvince] = useState('');
  const [trongDiemPage, setTrongDiemPage] = useState(1);
  const [trongDiemPageSize, setTrongDiemPageSize] = useState(25);

  // =========================================================================
  // OTHER EXISTING DATASETS (Cảnh báo Xã/Huyện, Trạm đo mưa, Độ ẩm đất)
  // =========================================================================
  const [cbDate, setCbDate] = useState(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [cbHour, setCbHour] = useState(() => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(new Date().getHours())}:00:00`;
  });
  const [cbSogio, setCbSogio] = useState(6);
  const [cbList, setCbList] = useState([]);
  const [cbActualDate, setCbActualDate] = useState('');
  const [loadingCb, setLoadingCb] = useState(false);
  const [cbProvinceFilter, setCbProvinceFilter] = useState('');
  const [cbRiskFilter, setCbRiskFilter] = useState('all');
  const [cbSearch, setCbSearch] = useState('');
  const [cbMinRain, setCbMinRain] = useState(0);
  const [cbPage, setCbPage] = useState(1);
  const [cbPageSize, setCbPageSize] = useState(25);
  const [cbSortField, setCbSortField] = useState('luongmua_tong');
  const [cbSortDir, setCbSortDir] = useState('desc');

  // Trạm đo mưa
  const [tramMuaList, setTramMuaList] = useState([]);
  const [loadingTramMua, setLoadingTramMua] = useState(false);
  const [tmSearch, setTmSearch] = useState('');
  const [tmOnlyRain, setTmOnlyRain] = useState(false);
  const [tmPage, setTmPage] = useState(1);
  const [tmPageSize, setTmPageSize] = useState(25);

  // Độ ẩm đất
  const [doAmDatList, setDoAmDatList] = useState([]);
  const [loadingDoAmDat, setLoadingDoAmDat] = useState(false);
  const [dadSearch, setDadSearch] = useState('');
  const [dadPage, setDadPage] = useState(1);
  const [dadPageSize, setDadPageSize] = useState(25);

  // Initial load
  useEffect(() => {
    loadProvinces();
    loadRadarData();
    loadCanhBaoData(true);
    loadStatisticsTimeline();
  }, []);

  // Load timeline statistics from Firebase RTDB
  const loadStatisticsTimeline = async () => {
    try {
      setLoadingTimeline(true);
      const res = await fetchStatisticsTimeline(100);
      if (res.success && Array.isArray(res.data)) {
        setTimelineData(res.data);
      }
    } catch (err) {
      console.error('Failed to load statistics timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Thực hiện quét tự động NCHMF và đẩy snapshot vào Firebase RTDB
  const performAutoSync = async (source = 'client_auto') => {
    try {
      setIsSyncingNow(true);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const hStr = `${pad(now.getHours())}:00:00`;
      const queryDate = `${dStr} ${hStr}`;

      const [cbRes, rdRes] = await Promise.allSettled([
        fetchLuquetSatloCanhBao({ date: queryDate, autoFallback: true }),
        fetchLuquetSatloRadar()
      ]);

      const canhBaoList = cbRes.status === 'fulfilled' && cbRes.value?.success ? cbRes.value.data : [];
      const actualDate = cbRes.status === 'fulfilled' && cbRes.value?.actualDate ? cbRes.value.actualDate : queryDate;
      const radarObj = rdRes.status === 'fulfilled' && rdRes.value?.success ? rdRes.value.data : null;

      if (canhBaoList.length > 0) {
        setCbList(canhBaoList);
        setCbActualDate(actualDate);
        if (radarObj) setRadarData(radarObj);

        const isManual = source === 'manual_button' || source === 'modal_sync_now';
        const saveRes = await saveAutoSyncSnapshot({
          canhBaoData: canhBaoList,
          radarData: radarObj,
          actualDate,
          source,
          forceSave: isManual
        });

        const timeStr = now.toLocaleTimeString('vi-VN');
        setLastAutoSyncTime(timeStr);
        if (saveRes.isDuplicate) {
          setFirebaseSuccessMsg(`[Tự động quét] ${saveRes.message}`);
        } else {
          setFirebaseSuccessMsg(`[Tự động quét] Đã lưu snapshot mới "${saveRes.snapshotId}" (${saveRes.summary.totalCommunes} xã, Max mưa: ${saveRes.summary.maxRain}mm) lúc ${timeStr}!`);
        }
        setTimeout(() => setFirebaseSuccessMsg(null), 8000);

        loadStatisticsTimeline();
      }
    } catch (err) {
      console.error('performAutoSync error:', err);
      setErrorMsg(`Lỗi tự động quét: ${err.message}`);
      setTimeout(() => setErrorMsg(null), 8000);
    } finally {
      setIsSyncingNow(false);
    }
  };

  // Vòng lặp đếm ngược và kích hoạt Auto-Sync
  useEffect(() => {
    let countdownInterval = null;
    if (autoSyncEnabled) {
      countdownInterval = setInterval(() => {
        setNextSyncCountdown((prev) => {
          if (prev <= 1) {
            performAutoSync('client_interval');
            return autoSyncInterval * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [autoSyncEnabled, autoSyncInterval]);

  const handleToggleAutoSync = (enabled) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('nchmf_auto_sync_enabled', String(enabled));
    if (enabled) {
      setNextSyncCountdown(autoSyncInterval * 60);
      setFirebaseSuccessMsg(`Đã BẬT tự động quét NCHMF định kỳ mỗi ${autoSyncInterval} phút! Dữ liệu sẽ tự động lưu vào Firebase RTDB.`);
      setTimeout(() => setFirebaseSuccessMsg(null), 5000);
    } else {
      setFirebaseSuccessMsg('Đã TẮT tự động quét NCHMF.');
      setTimeout(() => setFirebaseSuccessMsg(null), 4000);
    }
  };

  const handleChangeInterval = (mins) => {
    setAutoSyncInterval(mins);
    localStorage.setItem('nchmf_auto_sync_interval', String(mins));
    setNextSyncCountdown(mins * 60);
  };


  // Radar autoplay loop
  useEffect(() => {
    let interval = null;
    if (isRadarPlaying && radarData?.timeline?.length > 0) {
      interval = setInterval(() => {
        setSelectedRadarIdx((prev) => (prev + 1) % radarData.timeline.length);
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRadarPlaying, radarData]);

  const loadProvinces = async () => {
    try {
      setLoadingProvinces(true);
      const res = await fetchLuquetSatloProvinces();
      if (res.success && Array.isArray(res.data)) {
        setProvinces(res.data);
      }
    } catch (err) {
      console.error('Failed to load provinces:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  // 1. Radar
  const loadRadarData = async () => {
    try {
      setLoadingRadar(true);
      setErrorMsg(null);
      const res = await fetchLuquetSatloRadar();
      if (res.success) {
        setRadarData(res.data);
        setSelectedRadarIdx(0);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi tải dữ liệu radar');
    } finally {
      setLoadingRadar(false);
    }
  };

  // 2. Điểm đã xảy ra sạt lở
  const loadDxrSatLoData = async () => {
    if (dxrSatLoList.length > 0) return;
    try {
      setLoadingDxrSatLo(true);
      setErrorMsg(null);
      const res = await fetchLuquetSatloDiemDaXayRaSatLo();
      if (res.success) {
        setDxrSatLoList(res.data || []);
        setDxrSatLoPage(1);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi tải điểm đã xảy ra sạt lở');
    } finally {
      setLoadingDxrSatLo(false);
    }
  };

  // 3. Điểm đã xảy ra lũ quét
  const loadDxrLuQuetData = async () => {
    if (dxrLuQuetList.length > 0) return;
    try {
      setLoadingDxrLuQuet(true);
      setErrorMsg(null);
      const res = await fetchLuquetSatloDiemDaXayRaLuQuet();
      if (res.success) {
        setDxrLuQuetList(res.data || []);
        setDxrLuQuetPage(1);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi tải điểm đã xảy ra lũ quét');
    } finally {
      setLoadingDxrLuQuet(false);
    }
  };

  // 4. Trọng điểm sạt lở lũ quét
  const loadTrongDiemData = async () => {
    if (trongDiemList.length > 0) return;
    try {
      setLoadingTrongDiem(true);
      setErrorMsg(null);
      const res = await fetchLuquetSatloTrongDiemSLLQ();
      if (res.success) {
        setTrongDiemList(res.data || []);
        setTrongDiemPage(1);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi tải trọng điểm sạt lở lũ quét');
    } finally {
      setLoadingTrongDiem(false);
    }
  };

  // Handlers for the 4 checkboxes
  const handleToggleRadar = (checked) => {
    setCheckedRadar(checked);
    if (checked) {
      setActiveLayerSubTab('radar');
      if (!radarData) loadRadarData();
    }
  };

  const handleToggleSatLo = (checked) => {
    setCheckedSatLo(checked);
    if (checked) {
      setActiveLayerSubTab('sat-lo');
      loadDxrSatLoData();
    }
  };

  const handleToggleLuQuet = (checked) => {
    setCheckedLuQuet(checked);
    if (checked) {
      setActiveLayerSubTab('lu-quet');
      loadDxrLuQuetData();
    }
  };

  const handleToggleTrongDiem = (checked) => {
    setCheckedTrongDiem(checked);
    if (checked) {
      setActiveLayerSubTab('trong-diem');
      loadTrongDiemData();
    }
  };

  // Helper: Chuyển snapshot item thành Date object chính xác
  const getSnapshotDate = (item) => {
    if (!item) return new Date();
    if (item.timestamp) {
      const d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (item.actualDate) {
      const d = new Date(item.actualDate.replace(' ', 'T'));
      if (!isNaN(d.getTime())) return d;
    }
    if (item.snapshotId && item.snapshotId.length >= 8) {
      const y = item.snapshotId.slice(0, 4);
      const m = item.snapshotId.slice(4, 6);
      const day = item.snapshotId.slice(6, 8);
      let h = '00';
      let min = '00';
      if (item.snapshotId.includes('_')) {
        const parts = item.snapshotId.split('_');
        if (parts[1]) {
          h = parts[1].slice(0, 2) || '00';
          min = parts[1].slice(2, 4) || '00';
        }
      } else if (item.snapshotId.length >= 10) {
        h = item.snapshotId.slice(8, 10);
      }
      const d = new Date(`${y}-${m}-${day}T${h}:${min}:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  // Danh sách các ngày phân biệt có trong timelineData
  const availableDates = useMemo(() => {
    const dates = new Set();
    for (const item of timelineData) {
      const d = getSnapshotDate(item);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates.add(str);
    }
    return Array.from(dates).sort().reverse();
  }, [timelineData]);

  // Lọc dữ liệu timeline theo Bộ lọc Ngày & Giờ
  const filteredTimelineData = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return timelineData.filter((item) => {
      const d = getSnapshotDate(item);
      const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const itemHour = d.getHours();

      // 1. Lọc theo Preset Ngày
      if (filterPreset === 'today') {
        if (itemDateStr !== todayStr) return false;
      } else if (filterPreset === '24h') {
        const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
        if (diffHours < 0 || diffHours > 24) return false;
      } else if (filterPreset === '3days') {
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 3) return false;
      } else if (filterPreset === '7days') {
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 7) return false;
      } else if (filterPreset === 'custom' && filterCustomDate) {
        if (itemDateStr !== filterCustomDate) return false;
      }

      // 2. Lọc theo Khung Giờ
      if (filterHourPreset === 'morning') {
        if (itemHour < 0 || itemHour >= 12) return false;
      } else if (filterHourPreset === 'afternoon') {
        if (itemHour < 12 || itemHour >= 18) return false;
      } else if (filterHourPreset === 'evening') {
        if (itemHour < 18 || itemHour > 23) return false;
      } else if (filterHourPreset === 'custom') {
        if (itemHour < filterStartHour || itemHour > filterEndHour) return false;
      }

      return true;
    });
  }, [timelineData, filterPreset, filterCustomDate, filterHourPreset, filterStartHour, filterEndHour]);

  // Helper: Thống kê tổng hợp từ filteredTimelineData
  const kpiMetrics = useMemo(() => {
    if (!filteredTimelineData || filteredTimelineData.length === 0) {
      return {
        totalSnapshots: 0,
        totalCommunesSum: 0,
        allTimeMaxRain: 0,
        topVulnerableProvince: '—',
        ratCaoCount: 0,
        caoCount: 0,
        trungBinhCount: 0
      };
    }

    let totalCommunesSum = 0;
    let allTimeMaxRain = 0;
    let ratCaoCount = 0;
    let caoCount = 0;
    let trungBinhCount = 0;
    const provAgg = {};

    for (const snap of filteredTimelineData) {
      totalCommunesSum += (snap.totalCommunes || 0);
      if (snap.maxRain > allTimeMaxRain) allTimeMaxRain = snap.maxRain;
      ratCaoCount += (snap.ratCao || 0);
      caoCount += (snap.cao || 0);
      trungBinhCount += (snap.trungBinh || 0);

      if (Array.isArray(snap.topProvinces)) {
        for (const p of snap.topProvinces) {
          if (!provAgg[p.province]) provAgg[p.province] = 0;
          provAgg[p.province] += p.count;
        }
      }
    }

    let topVulnerableProvince = '—';
    let maxProvCount = 0;
    for (const [prov, count] of Object.entries(provAgg)) {
      if (count > maxProvCount) {
        maxProvCount = count;
        topVulnerableProvince = `${prov} (${count} lượt)`;
      }
    }

    return {
      totalSnapshots: filteredTimelineData.length,
      totalCommunesSum,
      allTimeMaxRain: Math.round(allTimeMaxRain * 10) / 10,
      topVulnerableProvince,
      ratCaoCount,
      caoCount,
      trungBinhCount
    };
  }, [filteredTimelineData]);

  // Bảng xếp hạng tỉnh thành chịu rủi ro
  const provinceRanking = useMemo(() => {
    const provMap = {};
    for (const snap of filteredTimelineData) {
      if (Array.isArray(snap.topProvinces)) {
        for (const p of snap.topProvinces) {
          if (!provMap[p.province]) {
            provMap[p.province] = {
              province: p.province,
              totalOccurrences: 0,
              totalCommunes: 0,
              maxRainRecorded: 0,
              totalRatCao: 0,
              totalCao: 0
            };
          }
          provMap[p.province].totalOccurrences++;
          provMap[p.province].totalCommunes += p.count;
          if (p.maxRain > provMap[p.province].maxRainRecorded) {
            provMap[p.province].maxRainRecorded = p.maxRain;
          }
          provMap[p.province].totalRatCao += (p.ratCao || 0);
          provMap[p.province].totalCao += (p.cao || 0);
        }
      }
    }

    const list = Object.values(provMap).sort((a, b) => b.totalCommunes - a.totalCommunes);
    const maxVal = list.length > 0 ? list[0].totalCommunes : 1;
    return list.map((item) => ({
      ...item,
      percentage: Math.round((item.totalCommunes / maxVal) * 100)
    }));
  }, [timelineData]);

  // Xem chi tiết Snapshot lịch sử
  const handleViewSnapshotDetail = async (snapshotId) => {
    try {
      setLoadingSnapshotDetail(true);
      setShowSnapshotDetailModal(true);
      const res = await fetchSnapshotDetail(snapshotId);
      if (res.success && res.data) {
        setSelectedSnapshotDetail(res.data);
      } else {
        setErrorMsg('Không tải được chi tiết snapshot này');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tải chi tiết snapshot');
    } finally {
      setLoadingSnapshotDetail(false);
    }
  };

  // Xóa Snapshot
  const handleDeleteSnapshotConfirm = async (snapshotId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản ghi thống kê "${snapshotId}" khỏi Firebase không?`)) {
      return;
    }
    try {
      await deleteSnapshot(snapshotId);
      setFirebaseSuccessMsg(`Đã xóa thành công snapshot "${snapshotId}"!`);
      setTimeout(() => setFirebaseSuccessMsg(null), 5000);
      loadStatisticsTimeline();
      if (selectedSnapshotDetail?.snapshotId === snapshotId) {
        setShowSnapshotDetailModal(false);
        setSelectedSnapshotDetail(null);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi xóa snapshot');
    }
  };

  // Xuất CSV báo cáo thống kê theo bộ lọc
  const exportStatisticsToCSV = () => {
    if (!filteredTimelineData || filteredTimelineData.length === 0) return;
    const headers = [
      'Mã Snapshot',
      'Thời gian ghi nhận NCHMF',
      'Thời gian lưu vào CSDL',
      'Tổng số xã cảnh báo',
      'Nguy cơ Rất cao',
      'Nguy cơ Cao',
      'Nguy cơ Trung bình',
      'Lượng mưa lớn nhất (mm)',
      'Lượng mưa trung bình (mm)',
      'Nguồn quét',
      'Top các tỉnh rủi ro'
    ];

    const rows = filteredTimelineData.map((item) => {
      const topProvStr = (item.topProvinces || [])
        .map((p) => `${p.province} (${p.count} xã)`)
        .join('; ');
      return [
        item.snapshotId || '',
        item.actualDate || '',
        item.displayTime || item.timestamp || '',
        item.totalCommunes || 0,
        item.ratCao || 0,
        item.cao || 0,
        item.trungBinh || 0,
        item.maxRain || 0,
        item.avgRain || 0,
        item.source || 'client',
        `"${topProvStr}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thong_ke_luquet_satlo_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Canh bao theo gio
  const loadCanhBaoData = async (isRealtime = false) => {
    try {
      setLoadingCb(true);
      setErrorMsg(null);
      let queryDate = `${cbDate} ${cbHour}`;
      if (isRealtime) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const dStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const hStr = `${pad(now.getHours())}:00:00`;
        queryDate = `${dStr} ${hStr}`;
        setCbDate(dStr);
        setCbHour(hStr);
      }

      const res = await fetchLuquetSatloCanhBao({
        date: queryDate,
        sogiodubao: cbSogio,
        autoFallback: true
      });

      if (res.success) {
        setCbList(res.data || []);
        setCbActualDate(res.actualDate || queryDate);
        setCbPage(1);
      } else {
        setErrorMsg(res.error || 'Không thể tải dữ liệu cảnh báo');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi kết nối đến API NCHMF');
    } finally {
      setLoadingCb(false);
    }
  };

  // Trạm mưa
  const loadTramMuaData = async () => {
    if (tramMuaList.length > 0) return;
    try {
      setLoadingTramMua(true);
      setErrorMsg(null);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:00:00`;
      const res = await fetchLuquetSatloTramMua({ thoigian: timeStr });
      if (res.success) {
        setTramMuaList(res.data || []);
        setTmPage(1);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi tải trạm đo mưa');
    } finally {
      setLoadingTramMua(false);
    }
  };

  // Độ ẩm đất
  const loadDoAmDatData = async () => {
    if (doAmDatList.length > 0) return;
    try {
      setLoadingDoAmDat(true);
      setErrorMsg(null);
      const res = await fetchLuquetSatloDoAmDat();
      if (res.success) {
        setDoAmDatList(res.data || []);
        setDadPage(1);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi tải độ ẩm đất');
    } finally {
      setLoadingDoAmDat(false);
    }
  };

  // =========================================================================
  // FIREBASE REALTIME DATABASE HANDLERS
  // =========================================================================
  const handleSaveToFirebase = async (layerKey, data, metadata = {}) => {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      setErrorMsg(`Chưa có dữ liệu "${layerKey}" để lưu vào Firebase.`);
      return;
    }
    try {
      setSavingFirebase(layerKey);
      setErrorMsg(null);
      setFirebaseSuccessMsg(null);
      const res = await saveLuquetSatloToRTDB({
        layer: layerKey,
        data,
        metadata,
        saveHistory: true
      });
      setFirebaseSuccessMsg(`Đã lưu thành công ${res.count} bản ghi (${layerKey}) lên Firebase Realtime DB!`);
      setTimeout(() => setFirebaseSuccessMsg(null), 6000);
    } catch (err) {
      setErrorMsg(`Lỗi lưu Firebase: ${err.message}`);
    } finally {
      setSavingFirebase(null);
    }
  };

  const handleLoadFromFirebase = async (layerKey) => {
    try {
      setLoadingFirebase(layerKey);
      setErrorMsg(null);
      setFirebaseSuccessMsg(null);
      const res = await fetchLuquetSatloFromRTDB(layerKey);
      if (res.success && res.data) {
        const payload = res.data;
        if (layerKey === 'sat_lo' && Array.isArray(payload.data)) {
          setDxrSatLoList(payload.data);
          setCheckedSatLo(true);
          setActiveLayerSubTab('sat-lo');
        } else if (layerKey === 'lu_quet' && Array.isArray(payload.data)) {
          setDxrLuQuetList(payload.data);
          setCheckedLuQuet(true);
          setActiveLayerSubTab('lu-quet');
        } else if (layerKey === 'trong_diem' && Array.isArray(payload.data)) {
          setTrongDiemList(payload.data);
          setCheckedTrongDiem(true);
          setActiveLayerSubTab('trong-diem');
        } else if (layerKey === 'radar' && payload.data) {
          setRadarData(payload.data);
          setCheckedRadar(true);
          setActiveLayerSubTab('radar');
        } else if (layerKey === 'canh_bao' && Array.isArray(payload.data)) {
          setCbList(payload.data);
          setActiveTab('canh-bao');
        } else if (layerKey === 'tram_mua' && Array.isArray(payload.data)) {
          setTramMuaList(payload.data);
          setActiveTab('tram-mua');
        } else if (layerKey === 'do_am_dat' && Array.isArray(payload.data)) {
          setDoAmDatList(payload.data);
          setActiveTab('do-am-dat');
        }
        setFirebaseSuccessMsg(`Đã tải dữ liệu (${layerKey}) từ Firebase Realtime DB (Lưu lúc: ${payload.clientTime || payload.updatedAt})!`);
        setTimeout(() => setFirebaseSuccessMsg(null), 6000);
      } else {
        setErrorMsg(res.message || `Chưa có bản ghi "${layerKey}" trên Firebase Realtime DB.`);
      }
    } catch (err) {
      setErrorMsg(`Lỗi tải từ Firebase: ${err.message}`);
    } finally {
      setLoadingFirebase(null);
    }
  };

  const handleSaveAllToFirebase = async () => {
    try {
      setSavingFirebase('all');
      setErrorMsg(null);
      setFirebaseSuccessMsg(null);
      const tasks = [];
      if (radarData) tasks.push(saveLuquetSatloToRTDB({ layer: 'radar', data: radarData, metadata: { name: 'Dữ liệu radar' }, saveHistory: true }));
      if (dxrSatLoList.length > 0) tasks.push(saveLuquetSatloToRTDB({ layer: 'sat_lo', data: dxrSatLoList, metadata: { name: 'Điểm đã xảy ra sạt lở' }, saveHistory: true }));
      if (dxrLuQuetList.length > 0) tasks.push(saveLuquetSatloToRTDB({ layer: 'lu_quet', data: dxrLuQuetList, metadata: { name: 'Điểm đã xảy ra lũ quét' }, saveHistory: true }));
      if (trongDiemList.length > 0) tasks.push(saveLuquetSatloToRTDB({ layer: 'trong_diem', data: trongDiemList, metadata: { name: 'Trọng điểm sạt lở lũ quét' }, saveHistory: true }));
      if (cbList.length > 0) tasks.push(saveLuquetSatloToRTDB({ layer: 'canh_bao', data: cbList, metadata: { name: 'Cảnh báo nguy cơ lũ quét sạt lở', actualDate: cbActualDate }, saveHistory: true }));

      if (tasks.length === 0) {
        setErrorMsg('Chưa có dữ liệu nào đang hiển thị để lưu lên Firebase. Hãy tải dữ liệu trước.');
        return;
      }

      await Promise.all(tasks);
      setFirebaseSuccessMsg(`Đã lưu thành công toàn bộ ${tasks.length} lớp dữ liệu lên Firebase Realtime Database!`);
      setTimeout(() => setFirebaseSuccessMsg(null), 6000);
    } catch (err) {
      setErrorMsg(`Lỗi lưu lên Firebase: ${err.message}`);
    } finally {
      setSavingFirebase(null);
    }
  };

  const handleOpenHistoryModal = async (layerKey = 'canh_bao') => {
    setSelectedHistoryLayer(layerKey);
    setShowFirebaseModal(true);
    setLoadingHistory(true);
    try {
      const res = await fetchLuquetSatloHistory(layerKey, 15);
      if (res.success) {
        setFirebaseHistoryList(res.data || []);
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------
  // Điểm đã xảy ra sạt lở
  const filteredDxrSatLo = useMemo(() => {
    return dxrSatLoList.filter((it) => {
      if (dxrSatLoProvince && !it.tinh?.toLowerCase().includes(dxrSatLoProvince.toLowerCase())) {
        return false;
      }
      if (dxrSatLoSearch.trim()) {
        const q = dxrSatLoSearch.trim().toLowerCase();
        return (
          (it.xa || '').toLowerCase().includes(q) ||
          (it.huyen || '').toLowerCase().includes(q) ||
          (it.tinh || '').toLowerCase().includes(q) ||
          (it.site_id || '').toLowerCase().includes(q) ||
          (it.nguyen_nhan || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dxrSatLoList, dxrSatLoProvince, dxrSatLoSearch]);

  const paginatedDxrSatLo = useMemo(() => {
    const start = (dxrSatLoPage - 1) * dxrSatLoPageSize;
    return filteredDxrSatLo.slice(start, start + dxrSatLoPageSize);
  }, [filteredDxrSatLo, dxrSatLoPage, dxrSatLoPageSize]);
  const totalDxrSatLoPages = Math.ceil(filteredDxrSatLo.length / dxrSatLoPageSize) || 1;

  // Điểm đã xảy ra lũ quét
  const filteredDxrLuQuet = useMemo(() => {
    return dxrLuQuetList.filter((it) => {
      if (dxrLuQuetProvince && !it.tinh?.toLowerCase().includes(dxrLuQuetProvince.toLowerCase())) {
        return false;
      }
      if (dxrLuQuetSearch.trim()) {
        const q = dxrLuQuetSearch.trim().toLowerCase();
        return (
          (it.xa || '').toLowerCase().includes(q) ||
          (it.huyen || '').toLowerCase().includes(q) ||
          (it.tinh || '').toLowerCase().includes(q) ||
          (it.thon || '').toLowerCase().includes(q) ||
          (it.nguyen_nhan || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dxrLuQuetList, dxrLuQuetProvince, dxrLuQuetSearch]);

  const paginatedDxrLuQuet = useMemo(() => {
    const start = (dxrLuQuetPage - 1) * dxrLuQuetPageSize;
    return filteredDxrLuQuet.slice(start, start + dxrLuQuetPageSize);
  }, [filteredDxrLuQuet, dxrLuQuetPage, dxrLuQuetPageSize]);
  const totalDxrLuQuetPages = Math.ceil(filteredDxrLuQuet.length / dxrLuQuetPageSize) || 1;

  // Trọng điểm sạt lở lũ quét
  const filteredTrongDiem = useMemo(() => {
    return trongDiemList.filter((it) => {
      if (trongDiemProvince && !it.ten_tinh?.toLowerCase().includes(trongDiemProvince.toLowerCase())) {
        return false;
      }
      if (trongDiemSearch.trim()) {
        const q = trongDiemSearch.trim().toLowerCase();
        return (
          (it.ten || '').toLowerCase().includes(q) ||
          (it.diadiem || '').toLowerCase().includes(q) ||
          (it.ten_tinh || '').toLowerCase().includes(q) ||
          (it.ten_xa || '').toLowerCase().includes(q) ||
          (it.ghichu || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [trongDiemList, trongDiemProvince, trongDiemSearch]);

  const paginatedTrongDiem = useMemo(() => {
    const start = (trongDiemPage - 1) * trongDiemPageSize;
    return filteredTrongDiem.slice(start, start + trongDiemPageSize);
  }, [filteredTrongDiem, trongDiemPage, trongDiemPageSize]);
  const totalTrongDiemPages = Math.ceil(filteredTrongDiem.length / trongDiemPageSize) || 1;

  // Cảnh báo xã/huyện
  const filteredCbList = useMemo(() => {
    return cbList.filter((item) => {
      if (cbProvinceFilter && !item.province_name?.toLowerCase().includes(cbProvinceFilter.toLowerCase())) {
        return false;
      }
      if (cbRiskFilter !== 'all') {
        const sl = (item.nguyco_satlo || '').toLowerCase();
        const lq = (item.nguyco_luquet || '').toLowerCase();
        if (cbRiskFilter === 'rat-cao' && !sl.includes('rất cao') && !lq.includes('rất cao')) return false;
        if (cbRiskFilter === 'cao' && !sl.includes('cao') && !lq.includes('cao')) return false;
        if (cbRiskFilter === 'trung-binh' && !sl.includes('trung bình') && !lq.includes('trung bình')) return false;
      }
      if (cbMinRain > 0 && (item.luongmua_tong || 0) < cbMinRain) {
        return false;
      }
      if (cbSearch.trim()) {
        const q = cbSearch.trim().toLowerCase();
        return (
          (item.commune_name || '').toLowerCase().includes(q) ||
          (item.district_name || '').toLowerCase().includes(q) ||
          (item.province_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      let valA = a[cbSortField];
      let valB = b[cbSortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return cbSortDir === 'asc' ? valA - valB : valB - valA;
      }
      valA = String(valA || '');
      valB = String(valB || '');
      return cbSortDir === 'asc' ? valA.localeCompare(valB, 'vi') : valB.localeCompare(valA, 'vi');
    });
  }, [cbList, cbProvinceFilter, cbRiskFilter, cbMinRain, cbSearch, cbSortField, cbSortDir]);

  const paginatedCbList = useMemo(() => {
    const start = (cbPage - 1) * cbPageSize;
    return filteredCbList.slice(start, start + cbPageSize);
  }, [filteredCbList, cbPage, cbPageSize]);
  const totalCbPages = Math.ceil(filteredCbList.length / cbPageSize) || 1;

  // ----------------------------------------------------
  // EXPORT UTILITIES
  // ----------------------------------------------------
  const exportToCSV = (items, filenamePrefix) => {
    if (!items || items.length === 0) return;
    const keys = Object.keys(items[0]);
    const header = keys.map((k) => `"${k}"`).join(',');
    const rows = items.map((item) =>
      keys.map((k) => `"${String(item[k] !== null && item[k] !== undefined ? item[k] : '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToGeoJSON = (items, latKey = 'lat', lonKey = 'lon', filenamePrefix = 'data_geojson') => {
    if (!items || items.length === 0) return;
    const features = items
      .filter((it) => typeof it[latKey] === 'number' && typeof it[lonKey] === 'number')
      .map((it) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [it[lonKey], it[latKey]]
        },
        properties: { ...it }
      }));

    const geojson = {
      type: 'FeatureCollection',
      features: features
    };

    const str = JSON.stringify(geojson, null, 2);
    const blob = new Blob([str], { type: 'application/geo+json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = (items, filenamePrefix) => {
    if (!items || items.length === 0) return;
    const str = JSON.stringify(items, null, 2);
    const blob = new Blob([str], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (items) => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const getCsvString = (items) => {
    if (!items || items.length === 0) return '';
    const keys = Object.keys(items[0]);
    const header = keys.map((k) => `"${k}"`).join(',');
    const rows = items.map((item) =>
      keys.map((k) => `"${String(item[k] !== null && item[k] !== undefined ? item[k] : '').replace(/"/g, '""')}"`).join(',')
    );
    return '\uFEFF' + [header, ...rows].join('\n');
  };

  // Badge render
  const renderRiskBadge = (risk) => {
    const r = (risk || '').toLowerCase();
    if (r.includes('rất cao')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
          <ShieldAlert className="w-3 h-3" />
          Rất cao
        </span>
      );
    }
    if (r.includes('cao')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertTriangle className="w-3 h-3" />
          Cao
        </span>
      );
    }
    if (r.includes('trung bình')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800">
          Trung bình
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-500 bg-slate-100 dark:bg-slate-800">
        {risk || '—'}
      </span>
    );
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-blue-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-0"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Cột Trái: Tiêu đề & Giới thiệu (Chiếm ưu thế không gian, không bị ngắt gãy dòng) */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                NCHMF Live Data Crawler
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-cyan-200/80 font-medium">
                Cục KTTV • Bộ TN&MT
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-3xl font-black tracking-tight font-heading flex items-center gap-3 text-white leading-tight">
              <Waves className="w-8 h-8 text-cyan-400 shrink-0" />
              <span className="break-words">Lũ Quét & Sạt Lở Đất (NCHMF)</span>
            </h1>

            <p className="text-cyan-100/85 text-xs sm:text-sm leading-relaxed max-w-2xl lg:max-w-3xl">
              Trích xuất dữ liệu từ <strong>Hệ thống cảnh báo nguy cơ lũ quét và sạt lở đất</strong> - Cục Khí tượng Thủy văn (Bộ TN&MT). Tích hợp đầy đủ các trường: Dữ liệu radar, Điểm đã xảy ra sạt lở, Điểm đã xảy ra lũ quét và Trọng điểm sạt lở lũ quét.
            </p>
          </div>

          {/* Cột Phải: Khối Action Panel cân đối (Lưới 2x2 nút bấm + Dải trạng thái CSDL) */}
          <div className="shrink-0 w-full lg:w-[460px] flex flex-col gap-2.5">
            {/* Lưới 4 nút bấm cân xứng 2x2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Nút 1: Tự động quét */}
              <button
                onClick={() => setShowAutoSyncModal(true)}
                className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                  autoSyncEnabled
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/50'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md'
                }`}
                title="Cài đặt tự động quét định kỳ và lưu vào CSDL"
              >
                <Timer className={`w-4 h-4 shrink-0 ${autoSyncEnabled ? 'text-white' : 'text-emerald-400'}`} />
                <span className="truncate">
                  {autoSyncEnabled ? (
                    `Tự động: BẬT (${Math.floor(nextSyncCountdown / 60)}m${nextSyncCountdown % 60 < 10 ? '0' : ''}${nextSyncCountdown % 60}s)`
                  ) : (
                    'Tự động quét & lưu'
                  )}
                </span>
              </button>

              {/* Nút 2: Lưu tất cả lên DB */}
              <button
                onClick={handleSaveAllToFirebase}
                disabled={savingFirebase === 'all'}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-lg shadow-orange-500/30 transition-all active:scale-95 disabled:opacity-50"
                title="Lưu dữ liệu các lớp hiện tại lên Firebase Realtime DB"
              >
                <Database className={`w-4 h-4 shrink-0 ${savingFirebase === 'all' ? 'animate-spin' : ''}`} />
                <span className="truncate">{savingFirebase === 'all' ? 'Đang lưu CSDL...' : 'Lưu tất cả lên DB'}</span>
              </button>

              {/* Nút 3: Lịch sử sao lưu */}
              <button
                onClick={() => handleOpenHistoryModal(activeLayerSubTab === 'sat-lo' ? 'sat_lo' : activeLayerSubTab === 'lu-quet' ? 'lu_quet' : activeLayerSubTab === 'trong-diem' ? 'trong_diem' : 'canh_bao')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium backdrop-blur-md transition-all duration-200 active:scale-95"
                title="Xem lịch sử sao lưu trên Firebase Realtime DB"
              >
                <History className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="truncate">Lịch sử sao lưu {timelineData.length > 0 && `(${timelineData.length})`}</span>
              </button>

              {/* Nút 4: Mở trang NCHMF */}
              <a
                href="https://luquetsatlo.nchmf.gov.vn/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium backdrop-blur-md transition-all duration-200 active:scale-95"
                title="Mở website chính thức của Trung tâm KTTV Quốc gia"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate">Mở trang NCHMF</span>
              </a>
            </div>

            {/* Dải trạng thái kết nối Cloud / Firebase Realtime DB */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-cyan-200/90 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Realtime DB: <strong>Sẵn sàng</strong></span>
              </div>
              <span className="text-cyan-300/70 text-[10px] font-mono">
                {timelineData.length > 0 ? `${timelineData.length} bản ghi snapshot` : 'Hỗ trợ đồng bộ 24/7'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Firebase Success Notification Banner */}
      {firebaseSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{firebaseSuccessMsg}</span>
          </div>
          <button onClick={() => setFirebaseSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs">Đóng</button>
        </div>
      )}

      {/* =================================================================== */}
      {/* KHỐI CHỌN TRƯỜNG DỮ LIỆU CÀO (ĐÚNG NHƯ HÌNH CHỤP CỦA NGƯỜI DÙNG)   */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border-2 border-cyan-500/30 dark:border-cyan-500/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-heading">
              <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              Trường lấy dữ liệu theo lớp bản đồ (NCHMF)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chọn các trường dữ liệu cần trích xuất tương tự giao diện bản đồ NCHMF
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
            {Number(checkedRadar) + Number(checkedSatLo) + Number(checkedLuQuet) + Number(checkedTrongDiem)}/4 lớp được chọn
          </span>
        </div>

        {/* 4 CHECKBOXES EXACTLY AS IN THE USER IMAGE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* 1. Dữ liệu radar */}
          <div
            onClick={() => handleToggleRadar(!checkedRadar)}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
              checkedRadar
                ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              id="chk-radar"
              checked={checkedRadar}
              onChange={(e) => handleToggleRadar(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="chk-radar" className="text-sm font-bold text-slate-900 dark:text-slate-100 cursor-pointer block">
                Dữ liệu radar
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ảnh phản hồi vô tuyến CMAX toàn quốc cập nhật 10 phút/lần
              </p>
            </div>
          </div>

          {/* 2. Điểm đã xảy ra sạt lở */}
          <div
            onClick={() => handleToggleSatLo(!checkedSatLo)}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
              checkedSatLo
                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              id="chk-satlo"
              checked={checkedSatLo}
              onChange={(e) => handleToggleSatLo(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="chk-satlo" className="text-sm font-bold text-slate-900 dark:text-slate-100 cursor-pointer block">
                Điểm đã xảy ra sạt lở
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                12.506 điểm thực tế điều tra kèm tọa độ, nguyên nhân
              </p>
            </div>
          </div>

          {/* 3. Điểm đã xảy ra lũ quét */}
          <div
            onClick={() => handleToggleLuQuet(!checkedLuQuet)}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
              checkedLuQuet
                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              id="chk-luquet"
              checked={checkedLuQuet}
              onChange={(e) => handleToggleLuQuet(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="chk-luquet" className="text-sm font-bold text-slate-900 dark:text-slate-100 cursor-pointer block">
                Điểm đã xảy ra lũ quét
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                1.048 điểm lũ quét thực tế kèm sông suối, thiệt hại
              </p>
            </div>
          </div>

          {/* 4. Trọng điểm sạt lở lũ quét */}
          <div
            onClick={() => handleToggleTrongDiem(!checkedTrongDiem)}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
              checkedTrongDiem
                ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              id="chk-trongdiem"
              checked={checkedTrongDiem}
              onChange={(e) => handleToggleTrongDiem(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 mt-0.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="chk-trongdiem" className="text-sm font-bold text-slate-900 dark:text-slate-100 cursor-pointer block">
                Trọng điểm sạt lở lũ quét
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                776 điểm trọng điểm có dân cư nguy cơ cao
              </p>
            </div>
          </div>
        </div>

        {/* Quick layer tabs to view data */}
        <div className="flex items-center gap-2 pt-2 overflow-x-auto">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2 whitespace-nowrap">
            Xem dữ liệu lớp:
          </span>
          {checkedRadar && (
            <button
              onClick={() => {
                setActiveTab('layers');
                setActiveLayerSubTab('radar');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'layers' && activeLayerSubTab === 'radar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Radar Thời Tiết
            </button>
          )}

          {checkedSatLo && (
            <button
              onClick={() => {
                setActiveTab('layers');
                setActiveLayerSubTab('sat-lo');
                loadDxrSatLoData();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'layers' && activeLayerSubTab === 'sat-lo'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Điểm Đã Sạt Lở ({dxrSatLoList.length || '12.506'})
            </button>
          )}

          {checkedLuQuet && (
            <button
              onClick={() => {
                setActiveTab('layers');
                setActiveLayerSubTab('lu-quet');
                loadDxrLuQuetData();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'layers' && activeLayerSubTab === 'lu-quet'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              Điểm Đã Lũ Quét ({dxrLuQuetList.length || '1.048'})
            </button>
          )}

          {checkedTrongDiem && (
            <button
              onClick={() => {
                setActiveTab('layers');
                setActiveLayerSubTab('trong-diem');
                loadTrongDiemData();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'layers' && activeLayerSubTab === 'trong-diem'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Trọng Điểm SLLQ ({trongDiemList.length || '776'})
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

          <button
            onClick={() => setActiveTab('canh-bao')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'canh-bao'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Cảnh báo Realtime ({cbList.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('tram-mua');
              loadTramMuaData();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'tram-mua'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Trạm đo mưa
          </button>

          <button
            onClick={() => {
              setActiveTab('do-am-dat');
              loadDoAmDatData();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'do-am-dat'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Độ ẩm đất
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

          <button
            onClick={() => {
              setActiveTab('thong-ke');
              loadStatisticsTimeline();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'thong-ke'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Thống Kê & Lịch Sử {timelineData.length > 0 ? `(${timelineData.length})` : ''}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline hover:no-underline font-semibold">
            Đóng
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* NỘI DUNG 4 LỚP DỮ LIỆU ĐƯỢC CHỌN (TAB 'layers')                    */}
      {/* =================================================================== */}
      {activeTab === 'layers' && (
        <div className="space-y-6">
          {/* 1. LAYER SUBTAB: RADAR */}
          {activeLayerSubTab === 'radar' && checkedRadar && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-heading">
                    <Radio className="w-5 h-5 text-blue-600" />
                    Dữ liệu Radar thời tiết (CMAX Composite)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Chuỗi ảnh radar phản hồi vô tuyến toàn quốc, cập nhật 10 phút/lần từ Tổng cục KTTV
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsRadarPlaying(!isRadarPlaying)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    {isRadarPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isRadarPlaying ? 'Tạm dừng' : 'Chạy tuần hoàn'}
                  </button>

                  <button
                    onClick={loadRadarData}
                    disabled={loadingRadar}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingRadar ? 'animate-spin' : ''}`} />
                    Cập nhật mới
                  </button>

                  <button
                    onClick={() => handleSaveToFirebase('radar', radarData, { name: 'Dữ liệu radar thời tiết CMAX' })}
                    disabled={!radarData || savingFirebase === 'radar'}
                    className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 text-xs font-semibold flex items-center gap-1.5"
                    title="Lưu dữ liệu radar lên Firebase Realtime Database"
                  >
                    <Database className={`w-3.5 h-3.5 ${savingFirebase === 'radar' ? 'animate-spin' : ''}`} />
                    {savingFirebase === 'radar' ? 'Đang lưu...' : 'Lưu RTDB'}
                  </button>

                  <button
                    onClick={() => handleLoadFromFirebase('radar')}
                    disabled={loadingFirebase === 'radar'}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                    title="Tải dữ liệu radar từ Firebase Realtime Database"
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-orange-500" />
                    Tải từ DB
                  </button>
                </div>
              </div>

              {loadingRadar ? (
                <div className="p-12 text-center text-slate-400">Đang tải chuỗi ảnh radar...</div>
              ) : radarData?.timeline?.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Radar Image Preview */}
                  <div className="lg:col-span-2 bg-slate-950 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[360px] border border-slate-800 overflow-hidden">
                    <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-xs font-mono flex items-center gap-2 border border-white/10">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Khung giờ: {radarData.timeline[selectedRadarIdx]?.time_vn}</span>
                    </div>

                    <img
                      src={radarData.timeline[selectedRadarIdx]?.image_url}
                      alt="Radar composite"
                      className="max-h-[460px] w-auto object-contain rounded-lg shadow-2xl"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1592210454359-9043f067919b?w=600&auto=format&fit=crop&q=60';
                      }}
                    />

                    {/* Timeline bar under image */}
                    <div className="w-full mt-4 bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono shrink-0">12 khung giờ:</span>
                      <div className="flex-1 flex items-center gap-1 overflow-x-auto py-1">
                        {radarData.timeline.map((frame, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedRadarIdx(idx);
                              setIsRadarPlaying(false);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-colors ${
                              selectedRadarIdx === idx
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {frame.time_vn.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Radar Info & Export Options */}
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông số kỹ thuật lớp Radar</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-500">Loại dữ liệu:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">Radar Composite CMAX</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-500">Chu kỳ cập nhật:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">10 phút / lần</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-500">Khung tọa độ (Bounds):</span>
                          <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            [97.0°E, 7.2°N] - [115.0°E, 25.2°N]
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Số khung giờ lưu trữ:</span>
                          <span className="font-semibold">{radarData.timeline.length} ảnh</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <a
                        href={radarData.timeline[selectedRadarIdx]?.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Mở ảnh gốc độ phân giải cao
                      </a>

                      <button
                        onClick={() => exportToJSON(radarData, 'radar_nchmf_metadata')}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <FileCode className="w-3.5 h-3.5 text-purple-500" />
                        Xuất JSON danh sách URL ảnh & Tọa độ
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* 2. LAYER SUBTAB: ĐIỂM ĐÃ XẢY RA SẠT LỞ */}
          {activeLayerSubTab === 'sat-lo' && checkedSatLo && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo xã, huyện, nguyên nhân..."
                      value={dxrSatLoSearch}
                      onChange={(e) => {
                        setDxrSatLoSearch(e.target.value);
                        setDxrSatLoPage(1);
                      }}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none w-64"
                    />
                  </div>

                  <select
                    value={dxrSatLoProvince}
                    onChange={(e) => {
                      setDxrSatLoProvince(e.target.value);
                      setDxrSatLoPage(1);
                    }}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    <option value="">Tất cả tỉnh thành</option>
                    {provinces.map((p) => (
                      <option key={p.provinceId} value={p.provinceName}>
                        {p.provinceName}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={loadDxrSatLoData}
                    disabled={loadingDxrSatLo}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDxrSatLo ? 'animate-spin' : ''}`} />
                    Tải lại
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportToCSV(filteredDxrSatLo, 'diem_da_xay_ra_sat_lo')}
                    disabled={filteredDxrSatLo.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    CSV ({filteredDxrSatLo.length})
                  </button>
                  <button
                    onClick={() => exportToGeoJSON(filteredDxrSatLo, 'lat', 'lon', 'diem_da_xay_ra_sat_lo_geojson')}
                    disabled={filteredDxrSatLo.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Map className="w-3.5 h-3.5 text-blue-500" />
                    GeoJSON
                  </button>
                  <button
                    onClick={() => exportToJSON(filteredDxrSatLo, 'diem_da_xay_ra_sat_lo')}
                    disabled={filteredDxrSatLo.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-purple-500" />
                    JSON
                  </button>
                  <button
                    onClick={() => handleSaveToFirebase('sat_lo', filteredDxrSatLo, { province: dxrSatLoProvince, name: 'Điểm đã xảy ra sạt lở' })}
                    disabled={filteredDxrSatLo.length === 0 || savingFirebase === 'sat_lo'}
                    className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 text-xs font-semibold flex items-center gap-1.5"
                    title="Lưu dữ liệu điểm sạt lở lên Firebase Realtime Database"
                  >
                    <Database className={`w-3.5 h-3.5 ${savingFirebase === 'sat_lo' ? 'animate-spin' : ''}`} />
                    {savingFirebase === 'sat_lo' ? 'Đang lưu...' : 'Lưu RTDB'}
                  </button>
                  <button
                    onClick={() => handleLoadFromFirebase('sat_lo')}
                    disabled={loadingFirebase === 'sat_lo'}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                    title="Tải từ Firebase Realtime Database"
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-orange-500" />
                    Tải từ DB
                  </button>
                  {filteredDxrSatLo.length > 0 && (
                    <DriveUploadButton
                      fileName={`diem_da_xay_ra_sat_lo_${Date.now()}.csv`}
                      content={getCsvString(filteredDxrSatLo)}
                      mimeType="text/csv"
                      className="px-3 py-1.5 text-xs rounded-xl"
                    />
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-sm font-bold flex items-center justify-between">
                  <span>Dữ liệu 12.506 Điểm đã xảy ra sạt lở (ht_satlo_point)</span>
                  <span className="text-xs text-amber-600 font-bold">Hiển thị: {filteredDxrSatLo.length} điểm</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3">Mã vị trí (Site ID)</th>
                        <th className="p-3">Tỉnh / Thành</th>
                        <th className="p-3">Huyện</th>
                        <th className="p-3">Xã / Thôn</th>
                        <th className="p-3 text-center">Tọa độ (X, Y)</th>
                        <th className="p-3">Nguyên nhân</th>
                        <th className="p-3">Thiệt hại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loadingDxrSatLo ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            Đang tải 12.506 điểm sạt lở từ máy chủ...
                          </td>
                        </tr>
                      ) : paginatedDxrSatLo.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            Không có điểm sạt lở nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        paginatedDxrSatLo.map((item, idx) => (
                          <tr key={item.gid || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="p-3 text-center text-slate-400 font-mono">
                              {(dxrSatLoPage - 1) * dxrSatLoPageSize + idx + 1}
                            </td>
                            <td className="p-3 font-mono font-medium text-amber-600 dark:text-amber-400">
                              {item.site_id || item.gid}
                            </td>
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{item.tinh}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{item.huyen}</td>
                            <td className="p-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{item.xa}</div>
                              {item.thon && <div className="text-[11px] text-slate-400">{item.thon}</div>}
                            </td>
                            <td className="p-3 text-center">
                              {item.lat && item.lon ? (
                                <a
                                  href={`https://www.google.com/maps?q=${item.lat},${item.lon}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono text-[11px]"
                                >
                                  {Number(item.lat).toFixed(4)}, {Number(item.lon).toFixed(4)}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={item.nguyen_nhan}>
                              {item.nguyen_nhan || '—'}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={item.thiet_hai}>
                              {item.thiet_hai || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalDxrSatLoPages > 1 && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Trang {dxrSatLoPage} / {totalDxrSatLoPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDxrSatLoPage((p) => Math.max(1, p - 1))}
                        disabled={dxrSatLoPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                      >
                        Trang trước
                      </button>
                      <button
                        onClick={() => setDxrSatLoPage((p) => Math.min(totalDxrSatLoPages, p + 1))}
                        disabled={dxrSatLoPage === totalDxrSatLoPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. LAYER SUBTAB: ĐIỂM ĐÃ XẢY RA LŨ QUÉT */}
          {activeLayerSubTab === 'lu-quet' && checkedLuQuet && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo xã, huyện, nguyên nhân..."
                      value={dxrLuQuetSearch}
                      onChange={(e) => {
                        setDxrLuQuetSearch(e.target.value);
                        setDxrLuQuetPage(1);
                      }}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none w-64"
                    />
                  </div>

                  <select
                    value={dxrLuQuetProvince}
                    onChange={(e) => {
                      setDxrLuQuetProvince(e.target.value);
                      setDxrLuQuetPage(1);
                    }}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    <option value="">Tất cả tỉnh thành</option>
                    {provinces.map((p) => (
                      <option key={p.provinceId} value={p.provinceName}>
                        {p.provinceName}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={loadDxrLuQuetData}
                    disabled={loadingDxrLuQuet}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDxrLuQuet ? 'animate-spin' : ''}`} />
                    Tải lại
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportToCSV(filteredDxrLuQuet, 'diem_da_xay_ra_lu_quet')}
                    disabled={filteredDxrLuQuet.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    CSV ({filteredDxrLuQuet.length})
                  </button>
                  <button
                    onClick={() => exportToGeoJSON(filteredDxrLuQuet, 'lat', 'lon', 'diem_da_xay_ra_lu_quet_geojson')}
                    disabled={filteredDxrLuQuet.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Map className="w-3.5 h-3.5 text-blue-500" />
                    GeoJSON
                  </button>
                  <button
                    onClick={() => exportToJSON(filteredDxrLuQuet, 'diem_da_xay_ra_lu_quet')}
                    disabled={filteredDxrLuQuet.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-purple-500" />
                    JSON
                  </button>
                  <button
                    onClick={() => handleSaveToFirebase('lu_quet', filteredDxrLuQuet, { province: dxrLuQuetProvince, name: 'Điểm đã xảy ra lũ quét' })}
                    disabled={filteredDxrLuQuet.length === 0 || savingFirebase === 'lu_quet'}
                    className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 text-xs font-semibold flex items-center gap-1.5"
                    title="Lưu dữ liệu điểm lũ quét lên Firebase Realtime Database"
                  >
                    <Database className={`w-3.5 h-3.5 ${savingFirebase === 'lu_quet' ? 'animate-spin' : ''}`} />
                    {savingFirebase === 'lu_quet' ? 'Đang lưu...' : 'Lưu RTDB'}
                  </button>
                  <button
                    onClick={() => handleLoadFromFirebase('lu_quet')}
                    disabled={loadingFirebase === 'lu_quet'}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                    title="Tải từ Firebase Realtime Database"
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-orange-500" />
                    Tải từ DB
                  </button>
                  {filteredDxrLuQuet.length > 0 && (
                    <DriveUploadButton
                      fileName={`diem_da_xay_ra_lu_quet_${Date.now()}.csv`}
                      content={getCsvString(filteredDxrLuQuet)}
                      mimeType="text/csv"
                      className="px-3 py-1.5 text-xs rounded-xl"
                    />
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-sm font-bold flex items-center justify-between">
                  <span>Dữ liệu 1.048 Điểm đã xảy ra lũ quét (ht_luquet_point)</span>
                  <span className="text-xs text-rose-600 font-bold">Hiển thị: {filteredDxrLuQuet.length} điểm</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3">Tỉnh / Thành</th>
                        <th className="p-3">Huyện</th>
                        <th className="p-3">Xã / Thôn</th>
                        <th className="p-3 text-center">Tọa độ (X, Y)</th>
                        <th className="p-3 text-center">Thời gian xảy ra</th>
                        <th className="p-3">Nguyên nhân</th>
                        <th className="p-3">Sông / Suối</th>
                        <th className="p-3">Thiệt hại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loadingDxrLuQuet ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            Đang tải dữ liệu điểm lũ quét...
                          </td>
                        </tr>
                      ) : paginatedDxrLuQuet.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            Không có điểm lũ quét nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        paginatedDxrLuQuet.map((item, idx) => (
                          <tr key={item.gid || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="p-3 text-center text-slate-400 font-mono">
                              {(dxrLuQuetPage - 1) * dxrLuQuetPageSize + idx + 1}
                            </td>
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{item.tinh}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{item.huyen}</td>
                            <td className="p-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{item.xa}</div>
                              {item.thon && <div className="text-[11px] text-slate-400">{item.thon}</div>}
                            </td>
                            <td className="p-3 text-center">
                              {item.lat && item.lon ? (
                                <a
                                  href={`https://www.google.com/maps?q=${item.lat},${item.lon}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono text-[11px]"
                                >
                                  {Number(item.lat).toFixed(4)}, {Number(item.lon).toFixed(4)}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3 text-center font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {item.ngay_bat_dau || '—'}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={item.nguyen_nhan}>
                              {item.nguyen_nhan || '—'}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{item.song_suoi || '—'}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={item.thiet_hai}>
                              {item.thiet_hai || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalDxrLuQuetPages > 1 && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Trang {dxrLuQuetPage} / {totalDxrLuQuetPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDxrLuQuetPage((p) => Math.max(1, p - 1))}
                        disabled={dxrLuQuetPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                      >
                        Trang trước
                      </button>
                      <button
                        onClick={() => setDxrLuQuetPage((p) => Math.min(totalDxrLuQuetPages, p + 1))}
                        disabled={dxrLuQuetPage === totalDxrLuQuetPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. LAYER SUBTAB: TRỌNG ĐIỂM SẠT LỞ LŨ QUÉT */}
          {activeLayerSubTab === 'trong-diem' && checkedTrongDiem && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo thôn/bản, xã, tỉnh..."
                      value={trongDiemSearch}
                      onChange={(e) => {
                        setTrongDiemSearch(e.target.value);
                        setTrongDiemPage(1);
                      }}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none w-64"
                    />
                  </div>

                  <select
                    value={trongDiemProvince}
                    onChange={(e) => {
                      setTrongDiemProvince(e.target.value);
                      setTrongDiemPage(1);
                    }}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    <option value="">Tất cả tỉnh thành</option>
                    {provinces.map((p) => (
                      <option key={p.provinceId} value={p.provinceName}>
                        {p.provinceName}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={loadTrongDiemData}
                    disabled={loadingTrongDiem}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingTrongDiem ? 'animate-spin' : ''}`} />
                    Tải lại
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportToCSV(filteredTrongDiem, 'trong_diem_sat_lo_lu_quet')}
                    disabled={filteredTrongDiem.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    CSV ({filteredTrongDiem.length})
                  </button>
                  <button
                    onClick={() => exportToGeoJSON(filteredTrongDiem, 'lat', 'lon', 'trong_diem_sllq_geojson')}
                    disabled={filteredTrongDiem.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Map className="w-3.5 h-3.5 text-blue-500" />
                    GeoJSON
                  </button>
                  <button
                    onClick={() => exportToJSON(filteredTrongDiem, 'trong_diem_sat_lo_lu_quet')}
                    disabled={filteredTrongDiem.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-purple-500" />
                    JSON
                  </button>
                  <button
                    onClick={() => handleSaveToFirebase('trong_diem', filteredTrongDiem, { province: trongDiemProvince, name: 'Trọng điểm sạt lở lũ quét' })}
                    disabled={filteredTrongDiem.length === 0 || savingFirebase === 'trong_diem'}
                    className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 text-xs font-semibold flex items-center gap-1.5"
                    title="Lưu dữ liệu trọng điểm SLLQ lên Firebase Realtime Database"
                  >
                    <Database className={`w-3.5 h-3.5 ${savingFirebase === 'trong_diem' ? 'animate-spin' : ''}`} />
                    {savingFirebase === 'trong_diem' ? 'Đang lưu...' : 'Lưu RTDB'}
                  </button>
                  <button
                    onClick={() => handleLoadFromFirebase('trong_diem')}
                    disabled={loadingFirebase === 'trong_diem'}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                    title="Tải từ Firebase Realtime Database"
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-orange-500" />
                    Tải từ DB
                  </button>
                  {filteredTrongDiem.length > 0 && (
                    <DriveUploadButton
                      fileName={`trong_diem_sllq_${Date.now()}.csv`}
                      content={getCsvString(filteredTrongDiem)}
                      mimeType="text/csv"
                      className="px-3 py-1.5 text-xs rounded-xl"
                    />
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-sm font-bold flex items-center justify-between">
                  <span>Dữ liệu 776 Trọng điểm sạt lở lũ quét (tbl_diemnguyco)</span>
                  <span className="text-xs text-purple-600 font-bold">Hiển thị: {filteredTrongDiem.length} trọng điểm</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3">Tên trọng điểm (Thôn/Bản)</th>
                        <th className="p-3">Địa điểm</th>
                        <th className="p-3">Xã</th>
                        <th className="p-3">Tỉnh</th>
                        <th className="p-3 text-center">Tọa độ (X, Y)</th>
                        <th className="p-3 text-right">Số hộ sạt lở</th>
                        <th className="p-3 text-right">Số hộ lũ quét</th>
                        <th className="p-3 text-center">Nguy cơ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loadingTrongDiem ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            Đang tải danh sách trọng điểm nguy cơ cao...
                          </td>
                        </tr>
                      ) : paginatedTrongDiem.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            Không tìm thấy trọng điểm phù hợp.
                          </td>
                        </tr>
                      ) : (
                        paginatedTrongDiem.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="p-3 text-center text-slate-400 font-mono">
                              {(trongDiemPage - 1) * trongDiemPageSize + idx + 1}
                            </td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                              {item.ten || '—'}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{item.diadiem || '—'}</td>
                            <td className="p-3 text-slate-700 dark:text-slate-200">{item.ten_xa || '—'}</td>
                            <td className="p-3 font-medium text-slate-800 dark:text-slate-100">{item.ten_tinh || '—'}</td>
                            <td className="p-3 text-center">
                              {item.lat && item.lon ? (
                                <a
                                  href={`https://www.google.com/maps?q=${item.lat},${item.lon}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono text-[11px]"
                                >
                                  {Number(item.lat).toFixed(4)}, {Number(item.lon).toFixed(4)}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-amber-600">
                              {item.soho_satlodat > 0 ? `${item.soho_satlodat} hộ` : '—'}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-rose-600">
                              {item.soho_luquet > 0 ? `${item.soho_luquet} hộ` : '—'}
                            </td>
                            <td className="p-3 text-center">
                              {item.soho_nguyco_ratcao > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                  Rất cao ({item.soho_nguyco_ratcao} hộ)
                                </span>
                              ) : item.soho_nguyco_cao > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  Cao ({item.soho_nguyco_cao} hộ)
                                </span>
                              ) : (
                                <span className="text-slate-400">Đã khảo sát</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalTrongDiemPages > 1 && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Trang {trongDiemPage} / {totalTrongDiemPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTrongDiemPage((p) => Math.max(1, p - 1))}
                        disabled={trongDiemPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                      >
                        Trang trước
                      </button>
                      <button
                        onClick={() => setTrongDiemPage((p) => Math.min(totalTrongDiemPages, p + 1))}
                        disabled={trongDiemPage === totalTrongDiemPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB CẢNH BÁO REALTIME THEO XÃ / HUYỆN                              */}
      {/* =================================================================== */}
      {activeTab === 'canh-bao' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <input
                    type="date"
                    value={cbDate}
                    onChange={(e) => setCbDate(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-100 outline-none font-medium text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <select
                    value={cbHour}
                    onChange={(e) => setCbHour(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-100 outline-none font-medium text-xs cursor-pointer"
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      const val = `${String(i).padStart(2, '0')}:00:00`;
                      return (
                        <option key={val} value={val} className="dark:bg-slate-800">
                          {String(i).padStart(2, '0')}:00
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500">Dự báo:</span>
                  <select
                    value={cbSogio}
                    onChange={(e) => setCbSogio(Number(e.target.value))}
                    className="bg-transparent text-slate-800 dark:text-slate-100 outline-none font-semibold text-xs cursor-pointer"
                  >
                    <option value={1} className="dark:bg-slate-800">1 giờ</option>
                    <option value={3} className="dark:bg-slate-800">3 giờ</option>
                    <option value={6} className="dark:bg-slate-800">6 giờ</option>
                  </select>
                </div>

                <button
                  onClick={() => loadCanhBaoData(false)}
                  disabled={loadingCb}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCb ? 'animate-spin' : ''}`} />
                  {loadingCb ? 'Đang cào...' : 'Lấy dữ liệu'}
                </button>

                <button
                  onClick={() => loadCanhBaoData(true)}
                  disabled={loadingCb}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Cập nhật Realtime
                </button>
              </div>

              {cbActualDate && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                  Thời điểm: <strong className="text-slate-800 dark:text-slate-200">{cbActualDate}</strong>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm xã, huyện, tỉnh..."
                    value={cbSearch}
                    onChange={(e) => {
                      setCbSearch(e.target.value);
                      setCbPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none w-48 focus:w-60 transition-all"
                  />
                </div>

                <select
                  value={cbProvinceFilter}
                  onChange={(e) => {
                    setCbProvinceFilter(e.target.value);
                    setCbPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value="">Tất cả tỉnh thành ({provinces.length})</option>
                  {provinces.map((p) => (
                    <option key={p.provinceId} value={p.provinceName}>
                      {p.provinceName}
                    </option>
                  ))}
                </select>

                <select
                  value={cbRiskFilter}
                  onChange={(e) => {
                    setCbRiskFilter(e.target.value);
                    setCbPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value="all">Mọi cấp nguy cơ</option>
                  <option value="rat-cao">Nguy cơ Rất cao</option>
                  <option value="cao">Nguy cơ Cao</option>
                  <option value="trung-binh">Nguy cơ Trung bình</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToCSV(filteredCbList, `canhbao_sllq_${removeVietnameseTones(cbActualDate)}`)}
                  disabled={filteredCbList.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Excel (CSV)
                </button>
                <button
                  onClick={() => exportToGeoJSON(filteredCbList, 'lat', 'lon', `canhbao_sllq_geojson_${removeVietnameseTones(cbActualDate)}`)}
                  disabled={filteredCbList.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Map className="w-3.5 h-3.5 text-blue-500" />
                  GeoJSON
                </button>
                <button
                  onClick={() => exportToJSON(filteredCbList, `canhbao_sllq_${removeVietnameseTones(cbActualDate)}`)}
                  disabled={filteredCbList.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <FileCode className="w-3.5 h-3.5 text-purple-500" />
                  JSON
                </button>
                <button
                  onClick={() => handleSaveToFirebase('canh_bao', filteredCbList, { actualDate: cbActualDate, name: 'Cảnh báo nguy cơ lũ quét sạt lở' })}
                  disabled={filteredCbList.length === 0 || savingFirebase === 'canh_bao'}
                  className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 text-xs font-semibold flex items-center gap-1.5"
                  title="Lưu danh sách cảnh báo lên Firebase Realtime Database"
                >
                  <Database className={`w-3.5 h-3.5 ${savingFirebase === 'canh_bao' ? 'animate-spin' : ''}`} />
                  {savingFirebase === 'canh_bao' ? 'Đang lưu...' : 'Lưu RTDB'}
                </button>
                <button
                  onClick={() => handleLoadFromFirebase('canh_bao')}
                  disabled={loadingFirebase === 'canh_bao'}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                  title="Tải từ Firebase Realtime Database"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-orange-500" />
                  Tải từ DB
                </button>
                <button
                  onClick={() => copyToClipboard(filteredCbList)}
                  disabled={filteredCbList.length === 0}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs"
                >
                  {copiedText ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-sm font-bold flex items-center justify-between">
              <span>Danh sách xã cảnh báo ({filteredCbList.length})</span>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Dòng/trang:</span>
                <select
                  value={cbPageSize}
                  onChange={(e) => {
                    setCbPageSize(Number(e.target.value));
                    setCbPage(1);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Xã / Phường</th>
                    <th className="p-3">Huyện / Quận</th>
                    <th className="p-3">Tỉnh / TP</th>
                    <th className="p-3 text-center">Nguy cơ Sạt lở</th>
                    <th className="p-3 text-center">Nguy cơ Lũ quét</th>
                    <th className="p-3 text-right">Mưa thực đo</th>
                    <th className="p-3 text-right">Tổng mưa</th>
                    <th className="p-3 text-center">Tọa độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedCbList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        {loadingCb ? 'Đang tải dữ liệu...' : 'Không có dữ liệu phù hợp.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedCbList.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {(cbPage - 1) * cbPageSize + idx + 1}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{row.commune_name}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{row.district_name}</td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{row.province_name}</td>
                        <td className="p-3 text-center">{renderRiskBadge(row.nguyco_satlo)}</td>
                        <td className="p-3 text-center">{renderRiskBadge(row.nguyco_luquet)}</td>
                        <td className="p-3 text-right font-mono">{row.luongmua_thucdo} mm</td>
                        <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {row.luongmua_tong} mm
                        </td>
                        <td className="p-3 text-center">
                          {row.lat && row.lon ? (
                            <a
                              href={`https://www.google.com/maps?q=${row.lat},${row.lon}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono text-[11px]"
                            >
                              {Number(row.lat).toFixed(4)}, {Number(row.lon).toFixed(4)}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalCbPages > 1 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Trang {cbPage} / {totalCbPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCbPage((p) => Math.max(1, p - 1))}
                    disabled={cbPage === 1}
                    className="px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-800 disabled:opacity-40"
                  >
                    Trang trước
                  </button>
                  <button
                    onClick={() => setCbPage((p) => Math.min(totalCbPages, p + 1))}
                    disabled={cbPage === totalCbPages}
                    className="px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-800 disabled:opacity-40"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB TRẠM ĐO MƯA                                                     */}
      {/* =================================================================== */}
      {activeTab === 'tram-mua' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên trạm..."
                  value={tmSearch}
                  onChange={(e) => {
                    setTmSearch(e.target.value);
                    setTmPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs outline-none w-64"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tmOnlyRain}
                  onChange={(e) => {
                    setTmOnlyRain(e.target.checked);
                    setTmPage(1);
                  }}
                  className="rounded text-cyan-600"
                />
                <span>Chỉ trạm có mưa (&gt; 0 mm)</span>
              </label>

              <button
                onClick={loadTramMuaData}
                disabled={loadingTramMua}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 text-white text-xs font-medium"
              >
                Tải lại
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToCSV(tramMuaList, 'tram_do_mua_nchmf')}
                disabled={tramMuaList.length === 0}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold"
              >
                CSV ({tramMuaList.length})
              </button>
              <button
                onClick={() => exportToGeoJSON(tramMuaList, 'lat', 'lon', 'tram_mua_geojson')}
                disabled={tramMuaList.length === 0}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold"
              >
                GeoJSON
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b text-sm font-bold flex items-center justify-between">
              <span>Mạng lưới 8.400+ trạm đo mưa tự động</span>
              <span className="text-xs text-slate-500">Hiển thị: {tramMuaList.length} trạm</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Mã trạm</th>
                    <th className="p-3">Tên trạm đo</th>
                    <th className="p-3 text-right">Mưa 1h</th>
                    <th className="p-3 text-right">Mưa 3h</th>
                    <th className="p-3 text-right">Mưa 6h</th>
                    <th className="p-3 text-right">Mưa 12h</th>
                    <th className="p-3 text-center">Tọa độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tramMuaList.slice((tmPage - 1) * tmPageSize, tmPage * tmPageSize).map((item, idx) => (
                    <tr key={item.station_id || idx} className="hover:bg-slate-50/80">
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {(tmPage - 1) * tmPageSize + idx + 1}
                      </td>
                      <td className="p-3 font-mono text-slate-500">{item.station_no || item.station_id}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{item.ten}</td>
                      <td className="p-3 text-right font-mono">{item.luongmua_1h} mm</td>
                      <td className="p-3 text-right font-mono">{item.luongmua_3h} mm</td>
                      <td className="p-3 text-right font-mono">{item.luongmua_6h} mm</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">{item.luongmua_12h} mm</td>
                      <td className="p-3 text-center">
                        {item.lat && item.lon ? (
                          <a
                            href={`https://www.google.com/maps?q=${item.lat},${item.lon}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-600 hover:underline font-mono"
                          >
                            {Number(item.lat).toFixed(4)}, {Number(item.lon).toFixed(4)}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB ĐỘ ẨM ĐẤT                                                       */}
      {/* =================================================================== */}
      {activeTab === 'do-am-dat' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tỉnh, huyện, xã..."
                  value={dadSearch}
                  onChange={(e) => {
                    setDadSearch(e.target.value);
                    setDadPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs outline-none w-64"
                />
              </div>

              <button
                onClick={loadDoAmDatData}
                disabled={loadingDoAmDat}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 text-white text-xs font-medium"
              >
                Tải lại
              </button>
            </div>

            <button
              onClick={() => exportToCSV(doAmDatList, 'do_am_dat_nchmf')}
              disabled={doAmDatList.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold"
            >
              CSV ({doAmDatList.length})
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b text-sm font-bold flex items-center justify-between">
              <span>Cảnh báo độ ẩm đất bão hòa</span>
              <span className="text-xs text-slate-500">Tổng cộng: {doAmDatList.length} bản ghi</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Tỉnh / Thành</th>
                    <th className="p-3">Huyện / Quận</th>
                    <th className="p-3">Xã / Phường</th>
                    <th className="p-3 text-center">Tỷ lệ độ ẩm</th>
                    <th className="p-3 text-center">Giờ cập nhật</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {doAmDatList.slice((dadPage - 1) * dadPageSize, dadPage * dadPageSize).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {(dadPage - 1) * dadPageSize + idx + 1}
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{item.province_name || '—'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{item.district_name || '—'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{item.commune_name || '—'}</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded font-mono font-bold bg-blue-100 text-blue-700 text-xs">
                          {item.do_am}%
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">{item.gio_capnhat || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB THỐNG KÊ & PHÂN TÍCH LỊCH SỬ (ANALYTICS & SNAPSHOTS)           */}
      {/* =================================================================== */}
      {activeTab === 'thong-ke' && (
        <div className="space-y-6 animate-fade-in">
          {/* 1. Header Toolbar & KPIs */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  <BarChart3 className="w-4 h-4" />
                  <span>CSDL Lũ Quét & Sạt Lở (Realtime Database)</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 font-heading">
                  Thống Kê Dữ Liệu & Chuỗi Lịch Sử
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Theo dõi biến động nguy cơ thiên tai theo thời gian thực và tổng hợp dữ liệu các đợt quét tự động.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => performAutoSync('manual_button')}
                  disabled={isSyncingNow}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  {isSyncingNow ? 'Đang quét NCHMF...' : 'Quét & Lưu ngay'}
                </button>

                <button
                  onClick={() => setShowAutoSyncModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Timer className="w-3.5 h-3.5 text-emerald-500" />
                  Cài đặt tự động quét
                </button>

                <button
                  onClick={exportStatisticsToCSV}
                  disabled={timelineData.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  Xuất CSV Thống Kê
                </button>
              </div>
            </div>

            {/* 4 Thẻ KPI Chỉ Số */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Tổng đợt quét đã lưu</span>
                  <Database className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {kpiMetrics.totalSnapshots} <span className="text-xs font-normal text-slate-400">đợt</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {lastAutoSyncTime ? `Lần quét gần nhất: ${lastAutoSyncTime}` : 'Đang cập nhật từ Firebase RTDB'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Tổng lượt xã cảnh báo</span>
                  <Waves className="w-4 h-4 text-cyan-500" />
                </div>
                <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
                  {kpiMetrics.totalCommunesSum.toLocaleString()} <span className="text-xs font-normal text-slate-400">lượt</span>
                </div>
                <div className="text-[11px] flex items-center gap-2 text-slate-500 font-medium">
                  <span className="text-rose-500">Rất cao: {kpiMetrics.ratCaoCount}</span>
                  <span>•</span>
                  <span className="text-amber-500">Cao: {kpiMetrics.caoCount}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Đỉnh lượng mưa ghi nhận</span>
                  <CloudRain className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {kpiMetrics.allTimeMaxRain} <span className="text-xs font-normal text-slate-400">mm</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Mưa tích lũy lớn nhất qua các lần quét
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Tỉnh rủi ro nhiều nhất</span>
                  <ShieldAlert className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-lg font-black text-purple-600 dark:text-purple-400 truncate">
                  {kpiMetrics.topVulnerableProvince}
                </div>
                <div className="text-[11px] text-slate-400">
                  Địa bàn xuất hiện cảnh báo nhiều nhất
                </div>
              </div>
            </div>
          </div>

          {/* 2. Thanh Công Cụ Bộ Lọc Thời Gian Ngày & Giờ (Time & Date Filter Toolbar) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 font-heading">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Filter className="w-3.5 h-3.5" />
                </div>
                <span>Bộ lọc thời gian:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-semibold border border-emerald-200/60 dark:border-emerald-800/40">
                  Đang lọc: {filteredTimelineData.length} / {timelineData.length} đợt quét
                </span>
              </div>

              {(filterPreset !== 'all' || filterHourPreset !== 'all' || filterCustomDate) && (
                <button
                  onClick={() => {
                    setFilterPreset('all');
                    setFilterCustomDate('');
                    setFilterHourPreset('all');
                    setFilterStartHour(0);
                    setFilterEndHour(23);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              )}
            </div>

            {/* Hàng 1: Lọc theo Ngày */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold min-w-[75px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Ngày:
              </span>

              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'today', label: 'Hôm nay' },
                { id: '24h', label: '24 giờ qua' },
                { id: '3days', label: '3 ngày qua' },
                { id: '7days', label: '7 ngày qua' },
                { id: 'custom', label: 'Chọn ngày...' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setFilterPreset(item.id);
                    if (item.id !== 'custom') setFilterCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    filterPreset === item.id
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              {filterPreset === 'custom' && (
                <div className="flex items-center gap-2">
                  {availableDates.length > 0 ? (
                    <select
                      value={filterCustomDate}
                      onChange={(e) => setFilterCustomDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border-2 border-indigo-500 text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
                    >
                      <option value="">-- Chọn ngày có dữ liệu --</option>
                      {availableDates.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={filterCustomDate}
                      onChange={(e) => setFilterCustomDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border-2 border-indigo-500 text-slate-800 dark:text-slate-100 font-medium"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Hàng 2: Lọc theo Khung Giờ */}
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 font-semibold min-w-[75px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-500" /> Khung giờ:
              </span>

              {[
                { id: 'all', label: 'Cả ngày (00h - 24h)' },
                { id: 'morning', label: 'Sáng (00h - 12h)' },
                { id: 'afternoon', label: 'Chiều (12h - 18h)' },
                { id: 'evening', label: 'Tối & Đêm (18h - 24h)' },
                { id: 'custom', label: 'Tùy chỉnh giờ...' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilterHourPreset(item.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    filterHourPreset === item.id
                      ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20 font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              {filterHourPreset === 'custom' && (
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border-2 border-cyan-500 text-xs shadow-sm">
                  <span className="text-slate-500">Từ</span>
                  <select
                    value={filterStartHour}
                    onChange={(e) => setFilterStartHour(Number(e.target.value))}
                    className="bg-transparent font-bold text-cyan-600 dark:text-cyan-400 focus:outline-none"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i} className="dark:bg-slate-800 text-slate-800 dark:text-slate-100">{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <span className="text-slate-500">đến</span>
                  <select
                    value={filterEndHour}
                    onChange={(e) => setFilterEndHour(Number(e.target.value))}
                    className="bg-transparent font-bold text-cyan-600 dark:text-cyan-400 focus:outline-none"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i} className="dark:bg-slate-800 text-slate-800 dark:text-slate-100">{String(i).padStart(2, '0')}:59</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 3. Biểu đồ Xu Hướng Thời Gian (Interactive Timeline Chart) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-heading">
                  Biểu đồ Xu Hướng Nguy Cơ Theo Thời Gian
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-rose-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Rất cao
                </span>
                <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Cao
                </span>
                <span className="flex items-center gap-1.5 text-yellow-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400"></span> Trung bình
                </span>
              </div>
            </div>

            {loadingTimeline ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                Đang tải dữ liệu thống kê từ Firebase Realtime DB...
              </div>
            ) : filteredTimelineData.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400 space-y-2">
                <BarChart3 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="font-medium text-slate-600 dark:text-slate-400">
                  {timelineData.length === 0
                    ? 'Chưa có dữ liệu lịch sử để vẽ biểu đồ thống kê.'
                    : 'Không tìm thấy đợt quét nào trong khoảng thời gian đã chọn.'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {timelineData.length === 0 ? (
                    <>Nhấn nút <strong>"Quét & Lưu ngay"</strong> ở trên hoặc bật <strong>Tự động quét</strong> để bắt đầu ghi nhận chuỗi dữ liệu.</>
                  ) : (
                    <button
                      onClick={() => {
                        setFilterPreset('all');
                        setFilterCustomDate('');
                        setFilterHourPreset('all');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 underline font-semibold mt-1"
                    >
                      Bấm vào đây để đặt lại bộ lọc
                    </button>
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* SVG/CSS Bar Chart */}
                <div className="h-64 flex items-end gap-2 sm:gap-3 px-2 overflow-x-auto pb-6 pt-4 border-b border-slate-100 dark:border-slate-800">
                  {(() => {
                    const maxVal = Math.max(...filteredTimelineData.map((d) => d.totalCommunes || 1), 10);
                    const showFullDate = filteredTimelineData.some((item, i, arr) => {
                      if (i === 0) return false;
                      const prevDate = getSnapshotDate(arr[i - 1]).getDate();
                      const curDate = getSnapshotDate(item).getDate();
                      return prevDate !== curDate;
                    });

                    return filteredTimelineData.map((item, idx) => {
                      const total = item.totalCommunes || 0;
                      const hPercent = Math.max(Math.round((total / maxVal) * 100), 5);
                      const rcPercent = total > 0 ? (item.ratCao / total) * 100 : 0;
                      const cPercent = total > 0 ? (item.cao / total) * 100 : 0;
                      const tbPercent = total > 0 ? (item.trungBinh / total) * 100 : 0;
                      const d = getSnapshotDate(item);
                      const pad = (n) => String(n).padStart(2, '0');
                      const timeLabel = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      const dateLabel = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

                      return (
                        <div
                          key={item.snapshotId || idx}
                          onClick={() => handleViewSnapshotDetail(item.snapshotId)}
                          className="flex-1 min-w-[42px] max-w-[60px] flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        >
                          {/* Tooltip Hover */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col z-20 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] shadow-xl whitespace-nowrap min-w-[170px] pointer-events-none animate-fade-in">
                            <span className="font-bold text-cyan-300">{item.actualDate || item.displayTime}</span>
                            <span className="font-mono mt-1 text-slate-200">Tổng cộng: <strong>{total}</strong> xã</span>
                            <span className="text-rose-400 font-medium">Rất cao: {item.ratCao || 0}</span>
                            <span className="text-amber-400 font-medium">Cao: {item.cao || 0}</span>
                            <span className="text-yellow-400 font-medium">Trung bình: {item.trungBinh || 0}</span>
                            <span className="text-blue-300 font-medium">Max mưa: {item.maxRain || 0} mm</span>
                            <span className="text-slate-400 text-[10px] mt-1 italic">Bấm để xem chi tiết đợt này</span>
                          </div>

                          {/* Giá trị trên đỉnh cột */}
                          <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 mb-1 group-hover:text-emerald-500">
                            {total}
                          </span>

                          {/* Thân cột phân lớp màu */}
                          <div
                            style={{ height: `${hPercent}%` }}
                            className="w-full rounded-t-lg overflow-hidden flex flex-col-reverse transition-all group-hover:scale-105 shadow-sm"
                          >
                            <div style={{ height: `${tbPercent}%` }} className="bg-yellow-400 w-full" title="Trung bình"></div>
                            <div style={{ height: `${cPercent}%` }} className="bg-amber-500 w-full" title="Cao"></div>
                            <div style={{ height: `${rcPercent}%` }} className="bg-rose-500 w-full" title="Rất cao"></div>
                          </div>

                          {/* Nhãn mốc giờ bên dưới */}
                          <div className="mt-2 text-center w-full">
                            <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 block leading-tight">
                              {timeLabel}
                            </span>
                            {showFullDate && (
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block">
                                {dateLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>* Bấm vào từng cột thời gian để mở danh sách chi tiết các xã tương ứng.</span>
                  <span>Đang hiển thị {filteredTimelineData.length} / {timelineData.length} snapshot</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Bảng Xếp Hạng Tỉnh Thành Chịu Rủi Ro & Lịch Sử Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột trái (1/3): Bảng xếp hạng tỉnh */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-purple-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-heading">
                    Top Tỉnh Thành Nguy Cơ
                  </h3>
                </div>
                <span className="text-xs text-slate-400">Lũy kế lịch sử</span>
              </div>

              {provinceRanking.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Chưa có dữ liệu thống kê theo tỉnh.
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {provinceRanking.slice(0, 10).map((p, idx) => (
                    <div key={p.province} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            idx === 0 ? 'bg-rose-500 text-white' : idx === 1 ? 'bg-amber-500 text-white' : idx === 2 ? 'bg-yellow-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{p.province}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-cyan-600 dark:text-cyan-400">{p.totalCommunes} lượt</span>
                          <span className="text-[10px] text-slate-400">(Max: {p.maxRainRecorded}mm)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${p.percentage}%` }}
                          className={`h-full rounded-full ${
                            idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-amber-500' : 'bg-cyan-500'
                          }`}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cột phải (2/3): Danh Sách Các Đợt Quét (Snapshots Explorer) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-heading">
                    Lịch Sử Các Đợt Quét Đã Lưu
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  Đang hiển thị {filteredTimelineData.length} / {timelineData.length} bản ghi
                </span>
              </div>

              {filteredTimelineData.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  {timelineData.length === 0
                    ? 'Chưa có snapshot nào được lưu trong CSDL.'
                    : 'Không có snapshot nào thỏa mãn bộ lọc thời gian hiện tại.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="p-2.5">Thời gian NCHMF</th>
                        <th className="p-2.5 text-center">Tổng xã</th>
                        <th className="p-2.5 text-center">Rất cao</th>
                        <th className="p-2.5 text-center">Cao</th>
                        <th className="p-2.5 text-center">Lượng mưa max</th>
                        <th className="p-2.5 text-center">Nguồn quét</th>
                        <th className="p-2.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[...filteredTimelineData].reverse().slice(0, 20).map((snap) => (
                        <tr key={snap.snapshotId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                            <div>{snap.actualDate || snap.displayTime}</div>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {snap.snapshotId}</span>
                          </td>
                          <td className="p-2.5 text-center font-bold font-mono text-cyan-600 dark:text-cyan-400">
                            {snap.totalCommunes}
                          </td>
                          <td className="p-2.5 text-center">
                            {snap.ratCao > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                                {snap.ratCao}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {snap.cao > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                                {snap.cao}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-mono text-blue-600 dark:text-blue-400 font-semibold">
                            {snap.maxRain ? `${snap.maxRain} mm` : '—'}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {snap.source === 'server_worker' ? 'Server Cron' : 'Trình duyệt'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleViewSnapshotDetail(snap.snapshotId)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-[11px] font-semibold transition-colors"
                              >
                                Xem chi tiết
                              </button>
                              <button
                                onClick={() => handleDeleteSnapshotConfirm(snap.snapshotId)}
                                className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Xóa đợt quét này khỏi CSDL"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL CÀI ĐẶT TỰ ĐỘNG QUÉT (AUTO-SYNC CONFIG)                        */}
      {/* =================================================================== */}
      {showAutoSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-heading">
                    Cài Đặt Tự Động Quét NCHMF
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tự động cào và lưu trữ vào Firebase Realtime Database
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAutoSyncModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Công tắc Bật/Tắt */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">
                  Trạng thái tự động quét
                </span>
                <span className="text-xs text-slate-500">
                  {autoSyncEnabled ? 'Đang bật quét ngầm trong tab trình duyệt' : 'Đang tạm dừng quét tự động'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Chọn chu kỳ quét */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Chu kỳ quét định kỳ:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 10, label: '10 phút', desc: 'Khớp radar' },
                  { value: 15, label: '15 phút', desc: 'Đề xuất' },
                  { value: 30, label: '30 phút', desc: 'Tiết kiệm' },
                  { value: 60, label: '1 giờ', desc: 'Tối thiểu' }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => handleChangeInterval(item.value)}
                    className={`p-3 rounded-2xl text-center border-2 transition-all ${
                      autoSyncInterval === item.value
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Thông tin đếm ngược */}
            {autoSyncEnabled && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">Lần quét kế tiếp sau:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {Math.floor(nextSyncCountdown / 60)}m {nextSyncCountdown % 60 < 10 ? '0' : ''}{nextSyncCountdown % 60}s
                </span>
              </div>
            )}

            {/* Chú thích quan trọng về việc tắt trình duyệt */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1 text-xs">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Khi bạn tắt trình duyệt:</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                • <strong>Chế độ web này:</strong> Chỉ hoạt động khi bạn <u>giữ mở tab trình duyệt</u>. Khi bạn đóng tab hoặc tắt trình duyệt, JavaScript sẽ dừng (không tự cào tiếp cho đến khi bạn mở lại web).
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 pt-1.5 border-t border-amber-200/50 dark:border-amber-800/40">
                • <strong>Muốn cào tự động 24/7 khi tắt trình duyệt / tắt máy:</strong> Hãy cho chạy lệnh daemon nền trên máy chủ hoặc terminal máy tính:
                <br />
                <code className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 font-mono text-[10px]">
                  npm run sync:watch
                </code>
              </p>
            </div>

            {/* Nút hành động */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => performAutoSync('modal_sync_now')}
                disabled={isSyncingNow}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                {isSyncingNow ? 'Đang quét...' : 'Quét & Lưu ngay lập tức'}
              </button>

              <button
                onClick={() => setShowAutoSyncModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL XEM CHI TIẾT SNAPSHOT LỊCH SỬ                                 */}
      {/* =================================================================== */}
      {showSnapshotDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 text-cyan-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                    <span>Chi Tiết Đợt Quét Lịch Sử</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 font-bold">
                      {selectedSnapshotDetail?.snapshotId}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ghi nhận lúc: {selectedSnapshotDetail?.actualDate || selectedSnapshotDetail?.displayTime} • Tổng cộng {selectedSnapshotDetail?.totalCommunes || 0} xã có cảnh báo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSnapshotDetailModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>

            {loadingSnapshotDetail ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
                Đang tải chi tiết danh sách xã từ Firebase...
              </div>
            ) : !selectedSnapshotDetail ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Không có dữ liệu cho snapshot này.
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Thanh tóm tắt nhanh */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-xs">
                    <span className="text-slate-400 block text-[10px]">Nguy cơ Rất cao</span>
                    <span className="font-bold font-mono text-rose-500 text-sm">{selectedSnapshotDetail.ratCao || 0} xã</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-xs">
                    <span className="text-slate-400 block text-[10px]">Nguy cơ Cao</span>
                    <span className="font-bold font-mono text-amber-500 text-sm">{selectedSnapshotDetail.cao || 0} xã</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-xs">
                    <span className="text-slate-400 block text-[10px]">Lượng mưa Max</span>
                    <span className="font-bold font-mono text-blue-500 text-sm">{selectedSnapshotDetail.maxRain || 0} mm</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-xs">
                    <span className="text-slate-400 block text-[10px]">Radar Frame</span>
                    <span className="font-bold font-mono text-slate-700 dark:text-slate-300 text-sm truncate block">{selectedSnapshotDetail.radarCurrentFrame || 'CMAX'}</span>
                  </div>
                </div>

                {/* Ô tìm kiếm xã */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Lọc xã, huyện, tỉnh..."
                      value={snapshotSearch}
                      onChange={(e) => setSnapshotSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs outline-none"
                    />
                  </div>
                  <button
                    onClick={() => exportToCSV(selectedSnapshotDetail.data || [], `snapshot_${selectedSnapshotDetail.snapshotId}`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Xuất CSV đợt này
                  </button>
                </div>

                {/* Bảng chi tiết danh sách xã */}
                <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5 w-12 text-center">STT</th>
                        <th className="p-2.5">Tỉnh / Thành</th>
                        <th className="p-2.5">Huyện / Quận</th>
                        <th className="p-2.5">Xã / Phường</th>
                        <th className="p-2.5 text-center">Nguy cơ sạt lở</th>
                        <th className="p-2.5 text-center">Nguy cơ lũ quét</th>
                        <th className="p-2.5 text-center">Mưa tổng (mm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(selectedSnapshotDetail.data || [])
                        .filter((it) => {
                          if (!snapshotSearch) return true;
                          const q = snapshotSearch.toLowerCase();
                          return (
                            (it.province_name || '').toLowerCase().includes(q) ||
                            (it.district_name || '').toLowerCase().includes(q) ||
                            (it.commune_name || '').toLowerCase().includes(q)
                          );
                        })
                        .map((commune, cIdx) => (
                          <tr key={cIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="p-2.5 text-center text-slate-400 font-mono">{cIdx + 1}</td>
                            <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{commune.province_name}</td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-300">{commune.district_name}</td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-300">{commune.commune_name}</td>
                            <td className="p-2.5 text-center">{renderRiskBadge(commune.nguyco_satlo)}</td>
                            <td className="p-2.5 text-center">{renderRiskBadge(commune.nguyco_luquet)}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                              {commune.luongmua_tong || commune.luongmua_thucdo || 0}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  if (selectedSnapshotDetail?.data) {
                    setCbList(selectedSnapshotDetail.data);
                    setActiveTab('canh-bao');
                    setShowSnapshotDetailModal(false);
                    setFirebaseSuccessMsg(`Đã khôi phục dữ liệu ${selectedSnapshotDetail.totalCommunes} xã của snapshot "${selectedSnapshotDetail.snapshotId}" lên giao diện Cảnh báo!`);
                    setTimeout(() => setFirebaseSuccessMsg(null), 5000);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Khôi phục lên giao diện chính
              </button>

              <button
                onClick={() => setShowSnapshotDetailModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lịch Sử Firebase Realtime Database */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-heading">
                    Lịch sử lưu Firebase Realtime Database
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dự án: <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">anh-cao-keu</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Tabs chọn Layer để xem lịch sử */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'canh_bao', label: 'Cảnh báo Realtime' },
                { id: 'radar', label: 'Dữ liệu radar' },
                { id: 'sat_lo', label: 'Điểm sạt lở' },
                { id: 'lu_quet', label: 'Điểm lũ quét' },
                { id: 'trong_diem', label: 'Trọng điểm SLLQ' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleOpenHistoryModal(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                    selectedHistoryLayer === tab.id
                      ? 'bg-orange-500 text-white font-bold shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Danh sách bản ghi */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                  Đang tải danh sách từ Firebase Realtime DB...
                </div>
              ) : firebaseHistoryList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <Database className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p>Chưa có bản lưu lịch sử nào cho lớp "{selectedHistoryLayer}" trên Firebase.</p>
                  <p className="text-[11px] text-slate-400">Hãy bấm nút "Lưu RTDB" trong bảng dữ liệu để tạo bản lưu snapshot.</p>
                </div>
              ) : (
                firebaseHistoryList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs hover:border-orange-300 dark:hover:border-orange-800 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span>{item.clientTime || item.savedAt}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                          {item.count} bản ghi
                        </span>
                      </div>
                      {item.metadata?.name && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.metadata.name}</p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (selectedHistoryLayer === 'sat_lo' && Array.isArray(item.data)) {
                          setDxrSatLoList(item.data);
                          setCheckedSatLo(true);
                          setActiveLayerSubTab('sat-lo');
                        } else if (selectedHistoryLayer === 'lu_quet' && Array.isArray(item.data)) {
                          setDxrLuQuetList(item.data);
                          setCheckedLuQuet(true);
                          setActiveLayerSubTab('lu-quet');
                        } else if (selectedHistoryLayer === 'trong_diem' && Array.isArray(item.data)) {
                          setTrongDiemList(item.data);
                          setCheckedTrongDiem(true);
                          setActiveLayerSubTab('trong-diem');
                        } else if (selectedHistoryLayer === 'radar' && item.data) {
                          setRadarData(item.data);
                          setCheckedRadar(true);
                          setActiveLayerSubTab('radar');
                        } else if (selectedHistoryLayer === 'canh_bao' && Array.isArray(item.data)) {
                          setCbList(item.data);
                          setActiveTab('canh-bao');
                        }
                        setShowFirebaseModal(false);
                        setFirebaseSuccessMsg(`Đã khôi phục dữ liệu snapshot (${selectedHistoryLayer}) lúc ${item.clientTime || item.savedAt}!`);
                        setTimeout(() => setFirebaseSuccessMsg(null), 5000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      Khôi phục
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
