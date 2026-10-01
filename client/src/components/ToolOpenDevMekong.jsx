import { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Search,
  Filter,
  RefreshCw,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Globe,
  Building2,
  Calendar,
  Tag,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Grid,
  List,
  Layers,
  X,
  FileCode,
  ShieldCheck,
  MapPin,
  Sparkles
} from 'lucide-react';
import { fetchOpenDevDatasets, rescanOpenDevDatasets } from '../services/api';

const FORMAT_COLOR_MAP = {
  PDF: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/40',
  CSV: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
  GEOJSON: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/40',
  WMS: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
  XLSX: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/40',
  XLS: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/40',
  SHP: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
  ZIP: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
  KML: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40',
  HTML: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  DB_TABLE: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/40',
  DEFAULT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
};

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return 'N/A';
  const b = parseInt(bytes, 10);
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

export default function ToolOpenDevMekong() {
  const [dataPayload, setDataPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanMessage, setScanMessage] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTaxonomy, setSelectedTaxonomy] = useState('ALL');
  const [selectedFormat, setSelectedFormat] = useState('ALL');
  const [selectedLicense, setSelectedLicense] = useState('ALL');
  const [selectedLang, setSelectedLang] = useState('ALL');
  const [sortBy, setSortBy] = useState('modified-desc'); // modified-desc | modified-asc | title-asc | title-desc | res-desc

  // View state
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedDataset, setSelectedDataset] = useState(null);

  // Lưu ý quan trọng: Khi chọn trang từ menu (component mount) -> Quét site để cập nhật data mới
  useEffect(() => {
    let isMounted = true;

    async function initialScan() {
      try {
        setLoading(true);
        setScanning(true);
        setError(null);
        setScanMessage('Đang kết nối Open Development Mekong và quét kiểm tra phiên bản dữ liệu mới nhất...');

        // Gọi API cào / đồng bộ dữ liệu (tự động fallback nếu backend chưa deploy)
        const res = await fetchOpenDevDatasets(false, (prog) => {
          if (isMounted) {
            setScanMessage(`Đang cào dữ liệu từ Open Development Mekong: trang ${prog.page}/${prog.totalPages} (${prog.current}/${prog.total})...`);
          }
        });

        if (isMounted) {
          if (res.success && res.data) {
            setDataPayload(res.data);
            setScanMessage(res.message || 'Đã đồng bộ dữ liệu mới nhất thành công.');
          } else {
            throw new Error(res.error || 'Không nhận được dữ liệu hợp lệ');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error in initialScan:', err);
          setError(err.message || 'Lỗi khi quét dữ liệu từ Open Development Mekong');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setScanning(false);
        }
      }
    }

    initialScan();

    return () => {
      isMounted = false;
    };
  }, []);

  // Hàm quét cưỡng bức toàn bộ site theo yêu cầu người dùng
  const handleForceRescan = async () => {
    try {
      setScanning(true);
      setError(null);
      setScanMessage('Đang cào lại toàn bộ các trang dữ liệu từ Open Development Mekong...');

      const res = await rescanOpenDevDatasets((prog) => {
        setScanMessage(`Đang quét lại: trang ${prog.page}/${prog.totalPages} (${prog.current}/${prog.total} bộ dữ liệu)...`);
      });

      if (res.success && res.data) {
        setDataPayload(res.data);
        setScanMessage(res.message || 'Đã quét và làm mới toàn bộ dữ liệu thành công!');
        setCurrentPage(1);
      } else {
        throw new Error(res.error || 'Quét lại thất bại');
      }
    } catch (err) {
      console.error('Force rescan error:', err);
      setError(err.message || 'Lỗi khi quét lại dữ liệu');
    } finally {
      setScanning(false);
    }
  };

  const datasets = dataPayload?.datasets || [];
  const statistics = dataPayload?.statistics || {};

  // Danh sách các tùy chọn lọc
  const taxonomyOptions = useMemo(() => {
    if (!statistics.taxonomies) return [];
    return Object.entries(statistics.taxonomies)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: `${k} (${v})`, value: k }));
  }, [statistics.taxonomies]);

  const formatOptions = useMemo(() => {
    if (!statistics.formats) return [];
    return Object.entries(statistics.formats)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: `${k} (${v})`, value: k }));
  }, [statistics.formats]);

  const licenseOptions = useMemo(() => {
    if (!statistics.licenses) return [];
    return Object.entries(statistics.licenses)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: `${k} (${v})`, value: k }));
  }, [statistics.licenses]);

  // Bộ lọc dữ liệu
  const filteredDatasets = useMemo(() => {
    let result = [...datasets];

    // Tìm kiếm từ khóa
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((d) => {
        return (
          d.title?.toLowerCase().includes(q) ||
          d.title_en?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q) ||
          d.author?.toLowerCase().includes(q) ||
          d.tags?.some((t) => t.toLowerCase().includes(q)) ||
          d.taxonomy?.some((tax) => tax.toLowerCase().includes(q))
        );
      });
    }

    // Lọc theo Chuyên đề
    if (selectedTaxonomy !== 'ALL') {
      result = result.filter((d) => d.taxonomy && d.taxonomy.includes(selectedTaxonomy));
    }

    // Lọc theo Định dạng
    if (selectedFormat !== 'ALL') {
      result = result.filter((d) =>
        d.resources?.some((r) => r.format?.toUpperCase() === selectedFormat.toUpperCase())
      );
    }

    // Lọc theo Giấy phép
    if (selectedLicense !== 'ALL') {
      result = result.filter((d) => (d.license_title || d.license_id) === selectedLicense);
    }

    // Lọc theo Ngôn ngữ
    if (selectedLang !== 'ALL') {
      result = result.filter((d) => d.languages && d.languages.includes(selectedLang));
    }

    // Sắp xếp
    result.sort((a, b) => {
      if (sortBy === 'modified-desc') {
        return new Date(b.modified || 0) - new Date(a.modified || 0);
      }
      if (sortBy === 'modified-asc') {
        return new Date(a.modified || 0) - new Date(b.modified || 0);
      }
      if (sortBy === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '', 'vi');
      }
      if (sortBy === 'title-desc') {
        return (b.title || '').localeCompare(a.title || '', 'vi');
      }
      if (sortBy === 'res-desc') {
        return (b.resourcesCount || 0) - (a.resourcesCount || 0);
      }
      return 0;
    });

    return result;
  }, [datasets, searchTerm, selectedTaxonomy, selectedFormat, selectedLicense, selectedLang, sortBy]);

  // Phân trang
  const totalPages = Math.ceil(filteredDatasets.length / pageSize) || 1;
  const currentDatasets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDatasets.slice(start, start + pageSize);
  }, [filteredDatasets, currentPage, pageSize]);

  // Đổi trang
  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  // Xuất file CSV toàn bộ danh mục
  const handleExportCSV = () => {
    if (!filteredDatasets.length) return;
    const headers = [
      'STT',
      'ID',
      'Tiêu đề (Tiếng Việt)',
      'Tiêu đề (Tiếng Anh)',
      'Loại hình',
      'Năm xuất bản',
      'Tác giả/Cơ quan',
      'Chuyên đề (Taxonomy)',
      'Giấy phép',
      'Ngày cập nhật',
      'Số lượng file',
      'Định dạng đính kèm',
      'Link chi tiết web',
      'Link tải các tài nguyên'
    ];

    const rows = filteredDatasets.map((d, idx) => [
      idx + 1,
      `"${d.id || ''}"`,
      `"${(d.title || '').replace(/"/g, '""')}"`,
      `"${(d.title_en || '').replace(/"/g, '""')}"`,
      `"${d.type || ''}"`,
      `"${d.published_year || ''}"`,
      `"${(d.author || '').replace(/"/g, '""')}"`,
      `"${(d.taxonomy || []).join('; ').replace(/"/g, '""')}"`,
      `"${(d.license_title || '').replace(/"/g, '""')}"`,
      `"${d.modified || ''}"`,
      d.resourcesCount || 0,
      `"${Array.from(new Set((d.resources || []).map((r) => r.format))).join(', ')}"`,
      `"${d.detailUrl || ''}"`,
      `"${(d.resources || []).map((r) => `${r.format}: ${r.url}`).join(' | ')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `opendev_vietnam_datasets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Xuất JSON
  const handleExportJSON = () => {
    if (!filteredDatasets.length) return;
    const blob = new Blob([JSON.stringify(filteredDatasets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `opendev_vietnam_datasets_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ── Header & Banner Tự Động Quét ── */}
      <div className="bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-indigo-950/40 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide">
              <Globe className="w-3.5 h-3.5" />
              <span>CKAN Action API v3 · Open Development Mekong</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl text-white shadow-lg shadow-emerald-500/25">
                <Database className="w-6 h-6" />
              </div>
              <span>Open Development Vietnam</span>
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Trình cào & đồng bộ toàn diện dữ liệu mở{' '}
              <a
                href="https://data.opendevelopmentmekong.net/vi/organization/vietnam-organization"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold inline-flex items-center gap-1"
              >
                vietnam-organization <ExternalLink className="w-3 h-3" />
              </a>
              : Bao gồm toàn bộ báo cáo, hồ sơ đất đai, lâm nghiệp, bản đồ GIS, GeoJSON, Shapefile và dữ liệu CSV môi trường.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleForceRescan}
              disabled={scanning}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer ${
                scanning
                  ? 'bg-slate-700 opacity-60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-emerald-500/20'
              }`}
              title="Quét lại ngay toàn bộ trang từ Open Development Mekong"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Đang quét site...' : 'Quét lại ngay (Rescan)'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!filteredDatasets.length}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Xuất danh sách ra file CSV / Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Xuất CSV ({filteredDatasets.length})</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={!filteredDatasets.length}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Xuất file JSON chuẩn"
            >
              <FileCode className="w-4 h-4 text-indigo-500" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Live scanning status alert */}
        <div className="mt-5 pt-4 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {scanMessage || 'Đang quét và kiểm tra dữ liệu mới từ site...'}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Lần quét gần nhất:{' '}
                  <strong className="text-slate-800 dark:text-slate-100">
                    {formatDate(dataPayload?.lastScannedAt)}
                  </strong>
                </span>
                {dataPayload?.scanDurationMs && (
                  <span className="text-[11px] text-slate-400">
                    (Hoàn thành trong {((dataPayload.scanDurationMs || 0) / 1000).toFixed(1)}s)
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-[11px]">
            <span>Mỗi lần chọn mục menu: Tự động quét cập nhật dữ liệu mới</span>
            <a
              href="https://data.opendevelopmentmekong.net/vi/feeds/organization/vietnam-organization.atom"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-500 transition-colors"
            >
              RSS/Atom Feed
            </a>
          </div>
        </div>
      </div>

      {/* ── Thông báo lỗi nếu có ── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold">Lỗi trong quá trình quét dữ liệu:</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── KPI & Thống Kê Nhanh ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng Bộ Dữ Liệu</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (dataPayload?.totalDatasets || 0)}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">100% cào toàn bộ danh mục VN</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tài Nguyên Đính Kèm</span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (dataPayload?.totalResources || 0)}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Tệp file, bản đồ WMS & API</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Định Dạng Tệp Phổ Biến</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              ['PDF', 'CSV', 'GEOJSON', 'WMS', 'XLSX'].map((fmt) => (
                <span
                  key={fmt}
                  onClick={() => setSelectedFormat(selectedFormat === fmt ? 'ALL' : fmt)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all border ${
                    selectedFormat === fmt
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : (FORMAT_COLOR_MAP[fmt] || FORMAT_COLOR_MAP.DEFAULT)
                  }`}
                  title={`Lọc theo ${fmt}`}
                >
                  {fmt}: {statistics.formats?.[fmt] || 0}
                </span>
              ))
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Bấm vào nhãn để lọc nhanh</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cập Nhật Mới Nhất</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={dataPayload?.latestDatasetModified}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatDate(dataPayload?.latestDatasetModified)}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Tự động đồng bộ
          </p>
        </div>
      </div>

      {/* ── Bộ Lọc & Tìm Kiếm Đa Chiều ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input Tìm kiếm */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm kiếm theo tiêu đề, mô tả tóm tắt, tag, tác giả (ví dụ: lâm nghiệp, đất đai, dân tộc, sạt lở)..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Chọn view mode & Sắp xếp */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Xem dạng Thẻ (Cards)"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Xem dạng Bảng (Table)"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100 font-medium"
            >
              <option value="modified-desc">Mới cập nhật nhất</option>
              <option value="modified-asc">Cũ nhất trước</option>
              <option value="title-asc">Tên từ A → Z</option>
              <option value="title-desc">Tên từ Z → A</option>
              <option value="res-desc">Nhiều tệp đính kèm nhất</option>
            </select>
          </div>
        </div>

        {/* Các Dropdown lọc Chuyên đề, Định dạng, Giấy phép */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-500" /> Chuyên đề (Taxonomy)
            </label>
            <select
              value={selectedTaxonomy}
              onChange={(e) => {
                setSelectedTaxonomy(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
            >
              <option value="ALL">Tất cả chuyên đề ({datasets.length})</option>
              {taxonomyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-cyan-500" /> Định dạng file (Format)
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => {
                setSelectedFormat(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
            >
              <option value="ALL">Tất cả định dạng</option>
              {formatOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-500" /> Giấy phép (License)
            </label>
            <select
              value={selectedLicense}
              onChange={(e) => {
                setSelectedLicense(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
            >
              <option value="ALL">Tất cả giấy phép</option>
              {licenseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3 text-amber-500" /> Ngôn ngữ
            </label>
            <select
              value={selectedLang}
              onChange={(e) => {
                setSelectedLang(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
            >
              <option value="ALL">Tất cả ngôn ngữ</option>
              <option value="vi">Tiếng Việt (vi)</option>
              <option value="en">Tiếng Anh (en)</option>
            </select>
          </div>
        </div>

        {/* Active Filter Indicators & Reset */}
        {(searchTerm || selectedTaxonomy !== 'ALL' || selectedFormat !== 'ALL' || selectedLicense !== 'ALL' || selectedLang !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <span className="text-slate-400 text-[11px]">Đang lọc:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                Từ khóa: "{searchTerm}"
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchTerm('')} />
              </span>
            )}
            {selectedTaxonomy !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium">
                {selectedTaxonomy}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedTaxonomy('ALL')} />
              </span>
            )}
            {selectedFormat !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-medium">
                Định dạng: {selectedFormat}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedFormat('ALL')} />
              </span>
            )}
            {selectedLicense !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-medium">
                Giấy phép: {selectedLicense}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedLicense('ALL')} />
              </span>
            )}
            {selectedLang !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                Ngôn ngữ: {selectedLang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedLang('ALL')} />
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTaxonomy('ALL');
                setSelectedFormat('ALL');
                setSelectedLicense('ALL');
                setSelectedLang('ALL');
                setCurrentPage(1);
              }}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold ml-2"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* ── Kết Quả & Thanh Phân Trang Trên ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="text-slate-600 dark:text-slate-300">
          Tìm thấy <strong className="text-slate-900 dark:text-slate-50 font-bold">{filteredDatasets.length}</strong> bộ dữ liệu
          {filteredDatasets.length !== datasets.length && ` (trong tổng số ${datasets.length})`}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">Hiển thị:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs py-1 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-medium"
          >
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
            <option value={50}>50 / trang</option>
            <option value={100}>100 / trang</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-semibold text-slate-700 dark:text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
              title="Trang tiếp"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Danh Sách Bộ Dữ Liệu: Chế Độ Thẻ (Card View) ── */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Đang tải và chuẩn bị dữ liệu Open Development Mekong...</span>
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Không tìm thấy bộ dữ liệu phù hợp</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Hãy thử tìm với từ khóa khác hoặc bỏ bớt các bộ lọc chuyên đề, định dạng để hiển thị thêm kết quả.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentDatasets.map((item) => {
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 hover:shadow-lg hover:border-emerald-500/30 transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Badges & Meta top */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.type === 'library_record'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                      }`}>
                        {item.type === 'library_record' ? 'Báo cáo / Ấn phẩm' : 'Bộ dữ liệu (Dataset)'}
                      </span>

                      {item.published_year && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          Năm {item.published_year}
                        </span>
                      )}

                      {item.spatial?.includes('vn') && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-rose-500" /> Việt Nam
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDate(item.modified).split(' ')[0]}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <h3
                      onClick={() => setSelectedDataset(item)}
                      className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer line-clamp-2 leading-snug"
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                    {item.title_en && item.title_en !== item.title && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-0.5 font-normal">
                        {item.title_en}
                      </p>
                    )}
                  </div>

                  {/* Description Notes */}
                  {item.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {item.notes}
                    </p>
                  )}

                  {/* Taxonomy Tags */}
                  {item.taxonomy && item.taxonomy.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.taxonomy.slice(0, 3).map((tax, i) => (
                        <span
                          key={i}
                          onClick={() => {
                            setSelectedTaxonomy(tax);
                            setCurrentPage(1);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 cursor-pointer hover:bg-emerald-100"
                        >
                          {tax}
                        </span>
                      ))}
                      {item.taxonomy.length > 3 && (
                        <span className="text-[10px] text-slate-400 px-1 py-0.5">
                          +{item.taxonomy.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer: Resources list & Download actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {/* Download format buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                    {item.resources && item.resources.length > 0 ? (
                      item.resources.slice(0, 4).map((r, rIdx) => {
                        const fmt = r.format || 'FILE';
                        const colorCls = FORMAT_COLOR_MAP[fmt] || FORMAT_COLOR_MAP.DEFAULT;
                        return (
                          <a
                            key={rIdx}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all hover:scale-105 active:scale-95 ${colorCls}`}
                            title={`Tải xuống ${r.name || fmt} (${formatBytes(r.size)})`}
                          >
                            <Download className="w-2.5 h-2.5" />
                            <span>{fmt}</span>
                            {r.size > 0 && <span className="text-[9px] opacity-75">({formatBytes(r.size)})</span>}
                          </a>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Không có file đính kèm</span>
                    )}
                    {item.resources?.length > 4 && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        +{item.resources.length - 4} tệp
                      </span>
                    )}
                  </div>

                  {/* Chi tiết button */}
                  <button
                    onClick={() => setSelectedDataset(item)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Chi tiết</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Danh Sách Bộ Dữ Liệu: Chế Độ Bảng (Table View) ── */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-3.5 text-center w-12">#</th>
                  <th className="py-3 px-4 min-w-[280px]">Tiêu đề bộ dữ liệu</th>
                  <th className="py-3 px-4 min-w-[150px]">Chuyên đề (Taxonomy)</th>
                  <th className="py-3 px-3 text-center">Năm</th>
                  <th className="py-3 px-4 min-w-[200px]">Tài nguyên đính kèm</th>
                  <th className="py-3 px-3 min-w-[100px]">Cập nhật</th>
                  <th className="py-3 px-3 text-center w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {currentDatasets.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      <td className="py-3 px-4">
                        <div
                          onClick={() => setSelectedDataset(item)}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer line-clamp-2"
                        >
                          {item.title}
                        </div>
                        {item.title_en && item.title_en !== item.title && (
                          <div className="text-[11px] text-slate-400 italic line-clamp-1 mt-0.5">
                            {item.title_en}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            item.type === 'library_record'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {item.type}
                          </span>
                          {item.author && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {item.author}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(item.taxonomy || []).slice(0, 2).map((tax, tIdx) => (
                            <span
                              key={tIdx}
                              onClick={() => {
                                setSelectedTaxonomy(tax);
                                setCurrentPage(1);
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-emerald-100 hover:text-emerald-700"
                            >
                              {tax}
                            </span>
                          ))}
                          {(item.taxonomy || []).length > 2 && (
                            <span className="text-[10px] text-slate-400">
                              +{item.taxonomy.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-300 font-medium">
                        {item.published_year || '-'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 items-center">
                          {(item.resources || []).map((r, rIdx) => {
                            const fmt = r.format || 'FILE';
                            const colorCls = FORMAT_COLOR_MAP[fmt] || FORMAT_COLOR_MAP.DEFAULT;
                            return (
                              <a
                                key={rIdx}
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 hover:scale-105 transition-all ${colorCls}`}
                                title={`${r.name} (${formatBytes(r.size)})`}
                              >
                                <Download className="w-2.5 h-2.5" />
                                {fmt}
                              </a>
                            );
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(item.modified).split(' ')[0]}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedDataset(item)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Phân Trang Dưới ── */}
      {filteredDatasets.length > pageSize && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Hiển thị {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filteredDatasets.length)} trong{' '}
            <strong>{filteredDatasets.length}</strong> bộ dữ liệu
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Đầu
            </button>

            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-bold text-slate-800 dark:text-slate-100">
              Trang {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Cuối
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Chi Tiết Bộ Dữ Liệu (Dataset Detail Modal) ── */}
      {selectedDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="space-y-1.5 pr-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 uppercase">
                    {selectedDataset.type}
                  </span>
                  {selectedDataset.published_year && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Năm {selectedDataset.published_year}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    Cập nhật: {formatDate(selectedDataset.modified)}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {selectedDataset.title}
                </h2>
                {selectedDataset.title_en && selectedDataset.title_en !== selectedDataset.title && (
                  <p className="text-xs text-slate-400 italic">{selectedDataset.title_en}</p>
                )}
              </div>

              <button
                onClick={() => setSelectedDataset(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700 dark:text-slate-200">
              {/* Mô tả tóm tắt */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  Mô Tả Bộ Dữ Liệu
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {selectedDataset.notes || selectedDataset.notes_en || 'Chưa có thông tin mô tả chi tiết cho bộ dữ liệu này.'}
                </div>
              </div>

              {/* Thông tin Meta chi tiết */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-teal-500" />
                  Thông Tin Metadata
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Tác giả / Cơ quan xuất bản</span>
                    <strong className="text-slate-800 dark:text-slate-200">{selectedDataset.author || 'N/A'}</strong>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Giấy phép bản quyền</span>
                    <strong className="text-slate-800 dark:text-slate-200">{selectedDataset.license_title || 'unspecified'}</strong>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Phạm vi địa lý (Spatial)</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedDataset.spatial?.join(', ') || 'Việt Nam'}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Ngôn ngữ tài liệu</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedDataset.languages?.map((l) => (l === 'vi' ? 'Tiếng Việt' : l === 'en' ? 'Tiếng Anh' : l)).join(', ')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Chuyên đề & Tags */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  Chuyên Đề & Thẻ Phân Loại
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedDataset.taxonomy || []).map((tax, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800"
                    >
                      {tax}
                    </span>
                  ))}
                  {(selectedDataset.tags || []).map((t, i) => (
                    <span
                      key={`tag-${i}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Danh sách tệp đính kèm tải về */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-rose-500" />
                    Tài Nguyên Đính Kèm ({selectedDataset.resources?.length || 0})
                  </span>
                </h4>

                {selectedDataset.resources && selectedDataset.resources.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDataset.resources.map((res, rIdx) => {
                      const fmt = res.format || 'FILE';
                      const colorCls = FORMAT_COLOR_MAP[fmt] || FORMAT_COLOR_MAP.DEFAULT;
                      return (
                        <div
                          key={rIdx}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border shrink-0 ${colorCls}`}>
                              {fmt}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-100 truncate" title={res.name}>
                                {res.name}
                              </p>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                                <span>Kích thước: {formatBytes(res.size)}</span>
                                {res.mimetype && <span>({res.mimetype})</span>}
                              </div>
                            </div>
                          </div>

                          <a
                            href={res.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs shrink-0 transition-all shadow-xs cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Tải về</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Không có tài nguyên đính kèm nào.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
              <a
                href={selectedDataset.detailUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>Xem trang gốc trên Open Development Mekong</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => setSelectedDataset(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
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
