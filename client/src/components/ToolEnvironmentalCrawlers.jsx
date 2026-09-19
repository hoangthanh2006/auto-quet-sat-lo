import { useState, useMemo } from 'react';
import {
  Waves,
  Droplets,
  Mountain,
  Download,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Database,
  Info,
  ChevronRight,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import {
  crawlLakeWaterData,
  crawlRiverWaterData,
  crawlLandslideData,
  downloadCsv
} from '../services/environmentalService';
import DriveUploadButton from './DriveUploadButton';

const LAKE_COLUMNS_MAP = {
  date: 'Ngày',
  lakeName: 'Tên Hồ',
  lakeCode: 'Mã Hồ',
  basinName: 'Lưu Vực',
  provinceName: 'Tỉnh/Thành',
  waterLevel_m: 'Mực nước (m)',
  currentStorage_m3: 'Dung tích (m3)',
  designStorage_m3: 'Dung tích thiết kế (m3)',
  storagePercent: 'Tỷ lệ dung tích (%)',
  inflow_qDen: 'Lưu lượng đến QDen (m3/s)',
  outflow_qXa: 'Lưu lượng xả QXa (m3/s)',
  updatedAt: 'Cập nhật (GMT+7)',
};

const RIVER_COLUMNS_MAP = {
  stationId: 'Mã trạm',
  stationName: 'Tên Trạm',
  river: 'Tên Sông',
  province: 'Tỉnh/Thành',
  timeLabel: 'Thời gian đo (GMT+7)',
  waterLevel_cm: 'Mực nước (cm)',
  alertName: 'Cấp Cảnh Báo',
  gapCm: 'Chênh lệch (cm)',
  bd1_m: 'BĐ1 (m)',
  bd2_m: 'BĐ2 (m)',
  bd3_m: 'BĐ3 (m)',
  historyFlood_m: 'Mực nước lũ lịch sử (m)',
  historyFloodYear: 'Năm lũ lịch sử',
};

const LANDSLIDE_COLUMNS_MAP = {
  time: 'Thời gian dự báo',
  communeName: 'Xã / Phường',
  provinceName: 'Tỉnh / Thành',
  nguycosatlo: 'Nguy cơ sạt lở',
  nguycoluquet: 'Nguy cơ lũ quét',
  severityScore: 'Mức độ nghiêm trọng (1-3)',
};

export default function ToolEnvironmentalCrawlers() {
  const [activeTab, setActiveTab] = useState('lake'); // 'lake' | 'river' | 'landslide'

  // --- STATE TAB 1: NƯỚC HỒ CHỨA ---
  const [lakeStartDate, setLakeStartDate] = useState('2025-10-07');
  const [lakeEndDate, setLakeEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [lakeData, setLakeData] = useState([]);
  const [lakeLoading, setLakeLoading] = useState(false);
  const [lakeError, setLakeError] = useState(null);
  const [lakeSearch, setLakeSearch] = useState('');
  const [lakeBasinFilter, setLakeBasinFilter] = useState('');

  // --- STATE TAB 2: MỰC NƯỚC SÔNG ---
  const [riverDays, setRiverDays] = useState('7');
  const [riverData, setRiverData] = useState([]);
  const [riverStations, setRiverStations] = useState([]);
  const [riverLoading, setRiverLoading] = useState(false);
  const [riverError, setRiverError] = useState(null);
  const [riverSearch, setRiverSearch] = useState('');
  const [riverAlertFilter, setRiverAlertFilter] = useState('');

  // --- STATE TAB 3: SẠT LỞ LŨ QUÉT ---
  const [landslideMode, setLandslideMode] = useState('refresh'); // 'refresh' | 'historical'
  const [landslideStart, setLandslideStart] = useState('2025-11-06 00:00');
  const [landslideEnd, setLandslideEnd] = useState(new Date().toISOString().substring(0, 16).replace('T', ' '));
  const [landslideData, setLandslideData] = useState([]);
  const [landslideStats, setLandslideStats] = useState(null);
  const [landslideLoading, setLandslideLoading] = useState(false);
  const [landslideError, setLandslideError] = useState(null);
  const [landslideSearch, setLandslideSearch] = useState('');
  const [landslideSeverityFilter, setLandslideSeverityFilter] = useState('');

  // 1. CRAWL NƯỚC HỒ
  const handleCrawlLake = async () => {
    try {
      setLakeLoading(true);
      setLakeError(null);
      const res = await crawlLakeWaterData(lakeStartDate, lakeEndDate);
      if (res.success) {
        setLakeData(res.data || []);
      } else {
        setLakeError(res.error || 'Lỗi không xác định khi lấy dữ liệu hồ chứa');
      }
    } catch (err) {
      setLakeError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLakeLoading(false);
    }
  };

  // 2. CRAWL MỰC NƯỚC SÔNG
  const handleCrawlRiver = async () => {
    try {
      setRiverLoading(true);
      setRiverError(null);
      const res = await crawlRiverWaterData(riverDays);
      if (res.success) {
        setRiverData(res.data || []);
        setRiverStations(res.stations || []);
      } else {
        setRiverError(res.error || 'Lỗi khi thu thập dữ liệu mực nước sông');
      }
    } catch (err) {
      setRiverError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setRiverLoading(false);
    }
  };

  // 3. CRAWL SẠT LỞ LŨ QUÉT
  const handleCrawlLandslide = async () => {
    try {
      setLandslideLoading(true);
      setLandslideError(null);
      const res = await crawlLandslideData({
        mode: landslideMode,
        start: landslideStart,
        end: landslideEnd,
      });
      if (res.success) {
        setLandslideData(res.data || []);
        setLandslideStats(res.stats || null);
      } else {
        setLandslideError(res.error || 'Lỗi khi thu thập dữ liệu cảnh báo sạt lở');
      }
    } catch (err) {
      setLandslideError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLandslideLoading(false);
    }
  };

  // --- TÍNH TOÁN LỌC DỮ LIỆU ---
  const filteredLakes = useMemo(() => {
    return lakeData.filter((item) => {
      const matchSearch =
        !lakeSearch ||
        item.lakeName?.toLowerCase().includes(lakeSearch.toLowerCase()) ||
        item.provinceName?.toLowerCase().includes(lakeSearch.toLowerCase());
      const matchBasin = !lakeBasinFilter || item.basinName === lakeBasinFilter;
      return matchSearch && matchBasin;
    });
  }, [lakeData, lakeSearch, lakeBasinFilter]);

  const uniqueBasins = useMemo(() => {
    return Array.from(new Set(lakeData.map((d) => d.basinName).filter(Boolean)));
  }, [lakeData]);

  const filteredRivers = useMemo(() => {
    return riverData.filter((item) => {
      const matchSearch =
        !riverSearch ||
        item.stationName?.toLowerCase().includes(riverSearch.toLowerCase()) ||
        item.river?.toLowerCase().includes(riverSearch.toLowerCase()) ||
        item.province?.toLowerCase().includes(riverSearch.toLowerCase());
      const matchAlert = !riverAlertFilter || String(item.alertValue) === riverAlertFilter;
      return matchSearch && matchAlert;
    });
  }, [riverData, riverSearch, riverAlertFilter]);

  const filteredLandslides = useMemo(() => {
    return landslideData.filter((item) => {
      const matchSearch =
        !landslideSearch ||
        item.communeName?.toLowerCase().includes(landslideSearch.toLowerCase()) ||
        item.provinceName?.toLowerCase().includes(landslideSearch.toLowerCase());
      const matchSeverity = !landslideSeverityFilter || String(item.severityScore) === landslideSeverityFilter;
      return matchSearch && matchSeverity;
    });
  }, [landslideData, landslideSearch, landslideSeverityFilter]);

  return (
    <div className="space-y-6">
      {/* HEADER BÀN GIAO TIÊU CHUẨN */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold mb-3 border border-white/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>VnExpress Spotlight Environmental Hub Handover</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading">
              Bộ Thu Thập Dữ Liệu Môi Trường & Thiên Tai
            </h1>
            <p className="text-emerald-50 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              Tích hợp đầy đủ các crawlers quốc gia từ tài liệu bàn giao <code className="bg-white/20 px-1.5 py-0.5 rounded text-white font-mono text-[11px]">crawlers.ipynb</code>: 
              Mực nước hồ chứa (Thủy Lợi), Mực nước sông & Cảnh báo lũ (VNDMS), và Cảnh báo sạt lở lũ quét (NCHMF).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/40 border border-emerald-300/40 rounded-full text-xs font-semibold text-emerald-100 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Tự động thu thập mỗi giờ (Hourly Worker): Đang chạy 24/7
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 border border-white/20 rounded-full text-[11px] font-medium text-white/90">
                <Database className="w-3 h-3 text-emerald-300" /> Đồng bộ trực tiếp Firebase RTDB
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="https://colab.research.google.com/github/lqtue/environmental-data-hub/blob/main/notebooks/crawlers.ipynb"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Mở Google Colab Gốc</span>
            </a>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/20">
          <button
            onClick={() => setActiveTab('lake')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'lake'
                ? 'bg-white text-emerald-800 shadow-md scale-102'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>1. Nước Hồ Chứa (Thủy Lợi)</span>
          </button>
          <button
            onClick={() => setActiveTab('river')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'river'
                ? 'bg-white text-emerald-800 shadow-md scale-102'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Waves className="w-4 h-4" />
            <span>2. Mực Nước Sông (VNDMS)</span>
          </button>
          <button
            onClick={() => setActiveTab('landslide')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'landslide'
                ? 'bg-white text-emerald-800 shadow-md scale-102'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Mountain className="w-4 h-4" />
            <span>3. Sạt Lở & Lũ Quét (NCHMF)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: NƯỚC HỒ CHỨA (THỦY LỢI VIỆT NAM)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'lake' && (
        <div className="space-y-6">
          {/* Cấu hình Crawl Hồ */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Thu thập Mực nước & Dung tích Hồ chứa (Tổng cục Thủy lợi)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nguồn: <code className="text-emerald-600 dark:text-emerald-400 font-mono">http://e15.thuyloivietnam.vn/CanhBaoSoLieu/ATCBDTHo</code> (22 hồ trọng điểm)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Ngày bắt đầu (Start Date)
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="date"
                    value={lakeStartDate}
                    onChange={(e) => setLakeStartDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Ngày kết thúc (End Date)
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="date"
                    value={lakeEndDate}
                    onChange={(e) => setLakeEndDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="sm:col-span-4 flex items-end">
                <button
                  onClick={handleCrawlLake}
                  disabled={lakeLoading}
                  className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${lakeLoading ? 'animate-spin' : ''}`} />
                  <span>{lakeLoading ? 'Đang tải dữ liệu...' : 'Chạy Crawler Nước Hồ (lake.csv)'}</span>
                </button>
              </div>
            </div>

            {lakeError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{lakeError}</span>
              </div>
            )}
          </div>

          {/* KPI & BẢNG KẾT QUẢ NƯỚC HỒ */}
          {lakeData.length > 0 && (
            <div className="space-y-4">
              {/* Thống kê nhanh */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Tổng số bản ghi</span>
                  <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 font-heading">{lakeData.length}</div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Hồ đầy &gt; 90%</span>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 font-heading">
                    {lakeData.filter((d) => (d.storagePercent || 0) >= 90).length}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase">Hồ đang xả lũ (QXa &gt; 0)</span>
                  <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 font-heading">
                    {lakeData.filter((d) => (d.outflow_qXa || 0) > 0).length}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase">Số lưu vực bao phủ</span>
                  <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-1 font-heading">{uniqueBasins.length}</div>
                </div>
              </div>

              {/* Toolbar Lọc & Xuất File */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên hồ hoặc tỉnh..."
                      value={lakeSearch}
                      onChange={(e) => setLakeSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <select
                    value={lakeBasinFilter}
                    onChange={(e) => setLakeBasinFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="">Tất cả lưu vực ({uniqueBasins.length})</option>
                    {uniqueBasins.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadCsv(filteredLakes, `lake_${lakeStartDate}_to_${lakeEndDate}.csv`, LAKE_COLUMNS_MAP)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất CSV (lake.csv)</span>
                  </button>

                  <DriveUploadButton
                    data={filteredLakes}
                    fileName={`lake_water_${lakeStartDate}_to_${lakeEndDate}`}
                    fileType="json"
                    buttonText="Lưu Drive"
                  />
                </div>
              </div>

              {/* Bảng dữ liệu hồ chứa */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Ngày</th>
                        <th className="py-2.5 px-3">Tên Hồ</th>
                        <th className="py-2.5 px-3">Lưu Vực</th>
                        <th className="py-2.5 px-3">Tỉnh</th>
                        <th className="py-2.5 px-3 text-right">Mực nước (m)</th>
                        <th className="py-2.5 px-3 text-right">Dung tích (m³)</th>
                        <th className="py-2.5 px-3">Tỷ lệ % Dung tích</th>
                        <th className="py-2.5 px-3 text-right">Q Đến (m³/s)</th>
                        <th className="py-2.5 px-3 text-right">Q Xả (m³/s)</th>
                        <th className="py-2.5 px-3">Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                      {filteredLakes.map((row, idx) => {
                        const pct = row.storagePercent || 0;
                        let barColor = 'bg-emerald-500';
                        if (pct > 90) barColor = 'bg-rose-500';
                        else if (pct > 75) barColor = 'bg-amber-500';
                        else if (pct > 50) barColor = 'bg-cyan-500';

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                            <td className="py-2 px-3 text-slate-500">{row.date}</td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-800 dark:text-slate-100">{row.lakeName}</td>
                            <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">{row.basinName}</td>
                            <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">{row.provinceName}</td>
                            <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-200">{row.waterLevel_m != null ? row.waterLevel_m.toFixed(2) : '-'}</td>
                            <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-200">{row.currentStorage_m3 != null ? row.currentStorage_m3.toLocaleString() : '-'}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{pct.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right text-cyan-600 dark:text-cyan-400 font-semibold">{row.inflow_qDen != null ? row.inflow_qDen.toFixed(1) : '-'}</td>
                            <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400">{row.outflow_qXa != null ? row.outflow_qXa.toFixed(1) : '-'}</td>
                            <td className="py-2 px-3 text-[10px] text-slate-400 font-sans">{row.updatedAt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MỰC NƯỚC SÔNG (VNDMS)                                               */}
      {/* ========================================================================= */}
      {activeTab === 'river' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
                  <Waves className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Thu thập Mực nước Sông & Cảnh báo Lũ (VNDMS)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nguồn: <code className="text-blue-600 dark:text-blue-400 font-mono">https://vndms.dmptc.gov.vn/water_level</code> (Tự động phân loại 5 cấp BĐ1, BĐ2, BĐ3, Lũ lịch sử)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Khoảng thời gian lịch sử cần lấy (Days History)
                </label>
                <div className="flex gap-2">
                  {[
                    { id: '3', label: '3 ngày gần nhất' },
                    { id: '7', label: '7 ngày (Chuẩn Handover)' },
                    { id: '14', label: '14 ngày (2 tuần)' },
                    { id: '30', label: '30 ngày (1 tháng)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRiverDays(opt.id)}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        riverDays === opt.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-4 flex items-end">
                <button
                  onClick={handleCrawlRiver}
                  disabled={riverLoading}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${riverLoading ? 'animate-spin' : ''}`} />
                  <span>{riverLoading ? 'Đang quét trạm...' : 'Chạy Crawler Sông (river_long.csv)'}</span>
                </button>
              </div>
            </div>

            {riverError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{riverError}</span>
              </div>
            )}
          </div>

          {/* KPI & TRẠM QUAN TRẮC SÔNG */}
          {riverStations.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Trạm quan trắc</span>
                  <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 font-heading">{riverStations.length}</div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-rose-600 uppercase">Trên BĐ3 & Lũ lịch sử</span>
                  <div className="text-xl font-black text-rose-600 mt-1 font-heading">
                    {riverStations.filter((s) => s.alertValue >= 3).length}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-amber-600 uppercase">Trên BĐ1 - BĐ2</span>
                  <div className="text-xl font-black text-amber-600 mt-1 font-heading">
                    {riverStations.filter((s) => s.alertValue === 1 || s.alertValue === 2).length}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase">Bình thường</span>
                  <div className="text-xl font-black text-emerald-600 mt-1 font-heading">
                    {riverStations.filter((s) => s.alertValue === 0).length}
                  </div>
                </div>
              </div>

              {/* Cards danh sách trạm và trạng thái hiện tại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {riverStations.map((st) => {
                  let badgeBg = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                  if (st.alertValue === 4) badgeBg = 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 animate-pulse';
                  else if (st.alertValue === 3) badgeBg = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300';
                  else if (st.alertValue === 2) badgeBg = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300';
                  else if (st.alertValue === 1) badgeBg = 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300';

                  return (
                    <div key={st.stationId} className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{st.name}</div>
                          <div className="text-[11px] text-slate-500">{st.river} · {st.province}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${badgeBg}`}>
                          {st.alertName}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                        <span className="text-slate-500">Mực nước:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                          {st.currentWaterLevel_cm != null ? `${st.currentWaterLevel_cm.toLocaleString()} cm` : 'N/A'}
                        </span>
                      </div>

                      {st.gapCm != null && (
                        <div className="text-[10px] text-right font-medium text-slate-500">
                          Chênh lệch: <span className={st.gapCm > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'}>{st.gapCm > 0 ? `+${st.gapCm}` : st.gapCm} cm</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bảng chi tiết chuỗi thời gian */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm theo trạm, sông hoặc tỉnh..."
                        value={riverSearch}
                        onChange={(e) => setRiverSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                      />
                    </div>

                    <select
                      value={riverAlertFilter}
                      onChange={(e) => setRiverAlertFilter(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                    >
                      <option value="">Tất cả cấp báo động</option>
                      <option value="4">Trên Lũ Lịch Sử</option>
                      <option value="3">Trên Báo Động 3</option>
                      <option value="2">Trên Báo Động 2</option>
                      <option value="1">Trên Báo Động 1</option>
                      <option value="0">Bình thường</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadCsv(filteredRivers, `river_long_${riverDays}days.csv`, RIVER_COLUMNS_MAP)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Xuất CSV (river_long.csv)</span>
                    </button>

                    <DriveUploadButton
                      data={filteredRivers}
                      fileName={`river_levels_${riverDays}days`}
                      fileType="json"
                      buttonText="Lưu Drive"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[450px] border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3">Trạm</th>
                        <th className="py-2.5 px-3">Sông</th>
                        <th className="py-2.5 px-3">Tỉnh</th>
                        <th className="py-2.5 px-3 text-right">Mực nước (cm)</th>
                        <th className="py-2.5 px-3">Cấp Báo Động</th>
                        <th className="py-2.5 px-3 text-right">Chênh lệch (cm)</th>
                        <th className="py-2.5 px-3 text-right">BĐ1 / BĐ2 / BĐ3 (m)</th>
                        <th className="py-2.5 px-3 text-right">Lũ Lịch Sử (m)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                      {filteredRivers.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                          <td className="py-2 px-3 text-slate-500 font-sans">{r.timeLabel}</td>
                          <td className="py-2 px-3 font-sans font-bold text-slate-800 dark:text-slate-100">{r.stationName}</td>
                          <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">{r.river}</td>
                          <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">{r.province}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                            {r.waterLevel_cm != null ? r.waterLevel_cm.toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              r.alertValue >= 3 ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' :
                              r.alertValue >= 1 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              {r.alertName}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {r.gapCm != null ? (
                              <span className={r.gapCm > 0 ? 'text-rose-600' : 'text-slate-500'}>
                                {r.gapCm > 0 ? `+${r.gapCm}` : r.gapCm}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                            {r.bd1_m ?? '-'}/{r.bd2_m ?? '-'}/{r.bd3_m ?? '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-purple-600 dark:text-purple-400 font-semibold text-[11px]">
                            {r.historyFlood_m ? `${r.historyFlood_m}m (${r.historyFloodYear || 'LS'})` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SẠT LỞ & LŨ QUÉT (NCHMF)                                           */}
      {/* ========================================================================= */}
      {activeTab === 'landslide' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400">
                  <Mountain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Thu thập Cảnh báo Sạt lở & Lũ quét Cấp Xã (NCHMF)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nguồn: <code className="text-rose-600 dark:text-rose-400 font-mono">https://luquetsatlo.nchmf.gov.vn/LayerMapBox/getDSCanhbaoSLLQ</code>
                  </p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => setLandslideMode('refresh')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    landslideMode === 'refresh'
                      ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Thời gian thực (Refresh)
                </button>
                <button
                  onClick={() => setLandslideMode('historical')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    landslideMode === 'historical'
                      ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Chuỗi Lịch sử (Historical)
                </button>
              </div>
            </div>

            {landslideMode === 'historical' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Bắt đầu (Start YYYY-MM-DD HH:mm)
                  </label>
                  <input
                    type="text"
                    value={landslideStart}
                    onChange={(e) => setLandslideStart(e.target.value)}
                    placeholder="VD: 2025-11-06 00:00"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Kết thúc (End YYYY-MM-DD HH:mm)
                  </label>
                  <input
                    type="text"
                    value={landslideEnd}
                    onChange={(e) => setLandslideEnd(e.target.value)}
                    placeholder="VD: 2025-11-10 00:00"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleCrawlLandslide}
              disabled={landslideLoading}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${landslideLoading ? 'animate-spin' : ''}`} />
              <span>{landslideLoading ? 'Đang trích xuất dữ liệu...' : `Chạy Crawler Sạt Lở (landslide.csv - Chế độ ${landslideMode})`}</span>
            </button>

            {landslideError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{landslideError}</span>
              </div>
            )}
          </div>

          {/* KPI & BẢNG KẾT QUẢ SẠT LỞ */}
          {landslideData.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Tổng số xã có nguy cơ</span>
                  <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 font-heading">{landslideData.length}</div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-rose-600 uppercase">Nguy cơ Rất Cao</span>
                  <div className="text-xl font-black text-rose-600 mt-1 font-heading">
                    {landslideData.filter((d) => d.severityScore === 3).length}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-amber-600 uppercase">Nguy cơ Cao</span>
                  <div className="text-xl font-black text-amber-600 mt-1 font-heading">
                    {landslideData.filter((d) => d.severityScore === 2).length}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[11px] font-semibold text-cyan-600 uppercase">Nguy cơ Trung Bình</span>
                  <div className="text-xl font-black text-cyan-600 mt-1 font-heading">
                    {landslideData.filter((d) => d.severityScore === 1).length}
                  </div>
                </div>
              </div>

              {/* Toolbar & Export */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo xã/phường hoặc tỉnh..."
                      value={landslideSearch}
                      onChange={(e) => setLandslideSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <select
                    value={landslideSeverityFilter}
                    onChange={(e) => setLandslideSeverityFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="">Tất cả mức độ</option>
                    <option value="3">Rất cao</option>
                    <option value="2">Cao</option>
                    <option value="1">Trung bình</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadCsv(filteredLandslides, `landslide_${landslideMode}.csv`, LANDSLIDE_COLUMNS_MAP)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất CSV (landslide.csv)</span>
                  </button>

                  <DriveUploadButton
                    data={filteredLandslides}
                    fileName={`landslide_warnings_${landslideMode}`}
                    fileType="json"
                    buttonText="Lưu Drive"
                  />
                </div>
              </div>

              {/* Bảng dữ liệu sạt lở */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3">Xã / Phường</th>
                        <th className="py-2.5 px-3">Tỉnh / Thành</th>
                        <th className="py-2.5 px-3">Nguy cơ Sạt Lở</th>
                        <th className="py-2.5 px-3">Nguy cơ Lũ Quét</th>
                        <th className="py-2.5 px-3 text-center">Mức độ nghiêm trọng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                      {filteredLandslides.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                          <td className="py-2 px-3 text-slate-500 font-sans text-[11px]">{row.time}</td>
                          <td className="py-2 px-3 font-sans font-bold text-slate-800 dark:text-slate-100">{row.communeName}</td>
                          <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">{row.provinceName}</td>
                          <td className="py-2 px-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.nguycosatlo === 'Rất cao' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                              row.nguycosatlo === 'Cao' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {row.nguycosatlo || 'Không'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.nguycoluquet === 'Rất cao' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                              row.nguycoluquet === 'Cao' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {row.nguycoluquet || 'Không'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              row.severityScore === 3 ? 'bg-rose-500 text-white' :
                              row.severityScore === 2 ? 'bg-amber-500 text-white' :
                              'bg-cyan-500 text-white'
                            }`}>
                              {row.severityScore === 3 ? 'Rất cao (3)' : row.severityScore === 2 ? 'Cao (2)' : 'Trung bình (1)'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
