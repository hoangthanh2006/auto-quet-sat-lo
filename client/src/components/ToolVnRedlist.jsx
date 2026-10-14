import { useState, useEffect, useMemo } from 'react';
import {
  PawPrint,
  Search,
  Filter,
  RefreshCw,
  Download,
  ExternalLink,
  ShieldAlert,
  Layers,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileSpreadsheet,
  FileCode,
  MapPin,
  Sparkles,
  TreePine,
  AlertTriangle,
  Info,
  Calendar,
  User,
  BookOpen,
  ArrowUpDown,
  Compass,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  Check,
  Settings2
} from 'lucide-react';
import DriveUploadButton from './DriveUploadButton';
import localFallbackData from '../data/vnredlist_animals.json';
import {
  fetchVnRedlistAnimals,
  fetchVnRedlistSpeciesDetail,
  rescanVnRedlistAnimals,
  startDeepCrawl,
  getDeepCrawlStatus,
  stopDeepCrawl,
  getSafeImageUrl,
  getBackendImageProxyUrl
} from '../services/vnredlistClientService';

// Bảng màu chuẩn IUCN / Danh lục Đỏ Việt Nam
const RED_LIST_META = {
  CR: {
    code: 'CR',
    label: 'Cực kỳ nguy cấp',
    enLabel: 'Critically Endangered',
    badgeClass: 'bg-rose-600 text-white dark:bg-rose-600 dark:text-white',
    dotClass: 'bg-rose-600',
    borderClass: 'border-rose-500/50',
    order: 1
  },
  EN: {
    code: 'EN',
    label: 'Nguy cấp',
    enLabel: 'Endangered',
    badgeClass: 'bg-orange-600 text-white dark:bg-orange-600 dark:text-white',
    dotClass: 'bg-orange-600',
    borderClass: 'border-orange-500/50',
    order: 2
  },
  VU: {
    code: 'VU',
    label: 'Sắp nguy cấp',
    enLabel: 'Vulnerable',
    badgeClass: 'bg-amber-500 text-slate-900 font-bold dark:bg-amber-500 dark:text-slate-950',
    dotClass: 'bg-amber-500',
    borderClass: 'border-amber-500/50',
    order: 3
  },
  NT: {
    code: 'NT',
    label: 'Sắp bị đe dọa',
    enLabel: 'Near Threatened',
    badgeClass: 'bg-lime-600 text-white dark:bg-lime-600 dark:text-white',
    dotClass: 'bg-lime-600',
    borderClass: 'border-lime-500/50',
    order: 4
  },
  LC: {
    code: 'LC',
    label: 'Ít lo ngại',
    enLabel: 'Least Concern',
    badgeClass: 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white',
    dotClass: 'bg-emerald-600',
    borderClass: 'border-emerald-500/50',
    order: 5
  },
  DD: {
    code: 'DD',
    label: 'Thiếu dữ liệu',
    enLabel: 'Data Deficient',
    badgeClass: 'bg-slate-500 text-white dark:bg-slate-600 dark:text-white',
    dotClass: 'bg-slate-500',
    borderClass: 'border-slate-500/50',
    order: 6
  }
};

// Cấu hình các cột dữ liệu có thể tùy chọn xuất CSV
export const AVAILABLE_EXPORT_COLUMNS = [
  { id: 'stt', label: 'Số thứ tự (STT)', category: 'Cơ bản', defaultChecked: true, getVal: (s, idx) => idx + 1 },
  { id: 'vietnameseName', label: 'Tên Tiếng Việt', category: 'Cơ bản', defaultChecked: true, getVal: (s) => s.vietnameseName || '' },
  { id: 'scientificName', label: 'Tên Khoa Học', category: 'Cơ bản', defaultChecked: true, getVal: (s) => s.scientificName || '' },
  { id: 'redListStatus', label: 'Mã Phân Hạng (CR/EN/VU...)', category: 'Bảo tồn', defaultChecked: true, getVal: (s) => s.redListStatus || 'DD' },
  { id: 'statusLabel', label: 'Ý Nghĩa Phân Hạng Bảo Tồn', category: 'Bảo tồn', defaultChecked: true, getVal: (s) => RED_LIST_META[s.redListStatus]?.label || 'Thiếu dữ liệu' },
  { id: 'className', label: 'Lớp (Class)', category: 'Phân loại', defaultChecked: true, getVal: (s) => s.className || '' },
  { id: 'phylum', label: 'Ngành (Phylum)', category: 'Phân loại', defaultChecked: true, getVal: (s) => s.phylum || '' },
  { id: 'publicationYear', label: 'Năm Công Bố', category: 'Hồ sơ', defaultChecked: true, getVal: (s) => s.publicationYear || '2023 - 2024' },
  { id: 'assessor', label: 'Người Đánh Giá', category: 'Hồ sơ', defaultChecked: true, getVal: (s) => s.assessor || '' },
  { id: 'contributors', label: 'Người Góp Ý', category: 'Hồ sơ', defaultChecked: false, getVal: (s) => s.contributors || '' },
  { id: 'distributionVietnam', label: 'Phân Bố Tại Việt Nam', category: 'Phân bố', defaultChecked: true, getVal: (s) => s.distributionVietnam || '' },
  { id: 'distributionWorld', label: 'Phân Bố Thế Giới', category: 'Phân bố', defaultChecked: true, getVal: (s) => s.distributionWorld || '' },
  { id: 'distributionMapUrl', label: 'Link Ảnh Bản Đồ VAST', category: 'Phân bố', defaultChecked: false, getVal: (s) => s.distributionMapUrl || '' },
  { id: 'populationStatus', label: 'Hiện Trạng Quần Thể', category: 'Sinh thái', defaultChecked: true, getVal: (s) => s.populationStatus || '' },
  { id: 'populationTrend', label: 'Xu Hướng Quần Thể', category: 'Sinh thái', defaultChecked: true, getVal: (s) => s.populationTrend || '' },
  { id: 'habitat', label: 'Đặc Điểm Sinh Cảnh Sống', category: 'Sinh thái', defaultChecked: true, getVal: (s) => s.habitat || '' },
  { id: 'diet', label: 'Tập Tính Thức Ăn', category: 'Sinh thái', defaultChecked: true, getVal: (s) => s.diet || '' },
  { id: 'threats', label: 'Mối Đe Dọa Chính', category: 'Bảo tồn', defaultChecked: true, getVal: (s) => s.threats || '' },
  { id: 'conservationExisting', label: 'Biện Pháp Bảo Tồn Đã Có', category: 'Bảo tồn', defaultChecked: true, getVal: (s) => s.conservationExisting || '' },
  { id: 'conservationProposed', label: 'Biện Pháp Bảo Tồn Đề Xuất', category: 'Bảo tồn', defaultChecked: true, getVal: (s) => s.conservationProposed || '' },
  { id: 'criteria', label: 'Tiêu Chuẩn Đánh Giá IUCN', category: 'Bảo tồn', defaultChecked: true, getVal: (s) => s.criteria || '' },
  { id: 'url', label: 'Link Bài Gốc vnredlist.vast.vn', category: 'Nguồn', defaultChecked: true, getVal: (s) => s.url || '' }
];

export default function ToolVnRedlist() {
  const [dataPayload, setDataPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState(null);
  const [statusNotice, setStatusNotice] = useState('');

  // Tùy chọn xuất dữ liệu CSV
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingProgressText, setExportingProgressText] = useState('');
  const [selectedColumnIds, setSelectedColumnIds] = useState(() => {
    const defaults = AVAILABLE_EXPORT_COLUMNS.filter(c => c.defaultChecked).map(c => c.id);
    if (!defaults.includes('populationStatus')) defaults.push('populationStatus');
    return defaults;
  });

  // Tự động kiểm tra và đảm bảo populationStatus luôn được chọn xuất CSV
  useEffect(() => {
    setSelectedColumnIds(prev => {
      const mustHave = ['populationStatus', 'populationTrend', 'habitat', 'threats', 'conservationExisting'];
      const missing = mustHave.filter(id => !prev.includes(id));
      if (missing.length > 0) {
        return [...prev, ...missing];
      }
      return prev;
    });
  }, []);

  // Deep Crawl State
  const [deepCrawlRunning, setDeepCrawlRunning] = useState(false);
  const [deepProgress, setDeepProgress] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhylum, setSelectedPhylum] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('threat-desc'); // threat-desc | name-asc | sci-asc

  // View state
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table' | 'taxonomy'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  // Modal Detail State
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('overview'); // overview | taxonomy | distribution | ecology | conservation

  // Load ban đầu
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        setStatusNotice('Đang tải dữ liệu Danh lục Đỏ Động vật Việt Nam từ máy chủ VAST...');

        const res = await fetchVnRedlistAnimals(false);
        if (isMounted) {
          if (res.success && res.data) {
            let p = res.data;
            // Hợp nhất dữ liệu chi tiết (Hiện trạng quần thể, Sinh cảnh...) từ local fallback nếu có loài chưa có chi tiết
            if (p?.species && localFallbackData?.species) {
              const merged = p.species.map(s => {
                if (s.hasDetail && s.populationStatus) return s;
                const loc = localFallbackData.species.find(ls => ls.id === s.id || ls.slug === s.slug);
                if (loc) {
                  return { ...loc, ...s, populationStatus: s.populationStatus || loc.populationStatus };
                }
                return s;
              });
              p = {
                ...p,
                species: merged,
                totalDetailed: merged.filter(s => s.hasDetail).length
              };
            }
            setDataPayload(p);
            if (res.warning) {
              setStatusNotice(res.warning);
            } else {
              setStatusNotice('Đã tải thành công 720 loài động vật trong Danh lục Đỏ Việt Nam.');
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Lỗi khi tải dữ liệu Sách Đỏ.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, []);

  // Lắng nghe tiến độ deep crawl nếu đang chạy
  useEffect(() => {
    if (!deepCrawlRunning) return;
    const timer = setInterval(async () => {
      try {
        const res = await getDeepCrawlStatus();
        if (res?.progress) {
          setDeepProgress(res.progress);
          if (!res.progress.running) {
            setDeepCrawlRunning(false);
            // Refresh data
            const fresh = await fetchVnRedlistAnimals(false);
            if (fresh.success) setDataPayload(fresh.data);
          }
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(timer);
  }, [deepCrawlRunning]);

  // Handler cào lại toàn bộ danh mục từ VAST
  const handleRescan = async () => {
    if (rescanning) return;
    try {
      setRescanning(true);
      setStatusNotice('Đang cào làm mới 720 loài qua 54 trang phân lớp từ vnredlist.vast.vn...');
      const res = await rescanVnRedlistAnimals();
      if (res.success && res.data) {
        setDataPayload(res.data);
        setStatusNotice('Đã cập nhật dữ liệu mới nhất thành công từ vnredlist.vast.vn!');
      }
    } catch (err) {
      setStatusNotice('Không thể kết nối đến máy chủ cào: ' + err.message);
    } finally {
      setRescanning(false);
    }
  };

  // Handler mở modal chi tiết loài
  const handleOpenDetail = async (species) => {
    setSelectedSpecies(species);
    setActiveModalTab('overview');

    if (!species.hasDetail) {
      try {
        setLoadingDetail(true);
        const detailed = await fetchVnRedlistSpeciesDetail(species.id, species);
        setSelectedSpecies(detailed);
        // Cập nhật lại trong dataPayload
        setDataPayload(prev => {
          if (!prev?.species) return prev;
          const updated = prev.species.map(s => s.id === species.id ? { ...s, ...detailed } : s);
          return { ...prev, species: updated };
        });
      } catch (err) {
        console.error('Lỗi khi tải chi tiết loài:', err);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  // Handler Deep Crawl
  const handleStartDeepCrawl = async () => {
    try {
      setDeepCrawlRunning(true);
      setStatusNotice('Đang khởi chạy tiến trình cào sâu chi tiết hồ sơ các loài...');
      await startDeepCrawl({ concurrency: 5 });
    } catch (err) {
      setStatusNotice('Lỗi khi bắt đầu cào sâu: ' + err.message);
      setDeepCrawlRunning(false);
    }
  };

  const handleStopDeepCrawl = async () => {
    try {
      await stopDeepCrawl();
      setDeepCrawlRunning(false);
      setStatusNotice('Đã dừng tiến trình cào sâu.');
    } catch (e) {}
  };

  // Lọc và sắp xếp danh sách loài
  const filteredSpecies = useMemo(() => {
    if (!dataPayload?.species) return [];
    let list = [...dataPayload.species];

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(s =>
        (s.scientificName && s.scientificName.toLowerCase().includes(q)) ||
        (s.vietnameseName && s.vietnameseName.toLowerCase().includes(q)) ||
        (s.className && s.className.toLowerCase().includes(q)) ||
        (s.distributionVietnam && s.distributionVietnam.toLowerCase().includes(q)) ||
        (s.assessor && s.assessor.toLowerCase().includes(q))
      );
    }

    // Phylum
    if (selectedPhylum !== 'ALL') {
      list = list.filter(s => s.phylum === selectedPhylum);
    }

    // Class
    if (selectedClass !== 'ALL') {
      list = list.filter(s => s.className === selectedClass || s.classSlug === selectedClass);
    }

    // Status
    if (selectedStatus !== 'ALL') {
      list = list.filter(s => (s.redListStatus || 'DD') === selectedStatus);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'threat-desc') {
        const orderA = RED_LIST_META[a.redListStatus]?.order || 99;
        const orderB = RED_LIST_META[b.redListStatus]?.order || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.scientificName.localeCompare(b.scientificName);
      }
      if (sortBy === 'name-asc') {
        return a.vietnameseName.localeCompare(b.vietnameseName, 'vi');
      }
      if (sortBy === 'sci-asc') {
        return a.scientificName.localeCompare(b.scientificName);
      }
      return 0;
    });

    return list;
  }, [dataPayload, searchTerm, selectedPhylum, selectedClass, selectedStatus, sortBy]);

  // Phân trang
  const totalPages = Math.ceil(filteredSpecies.length / pageSize) || 1;
  const paginatedSpecies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSpecies.slice(start, start + pageSize);
  }, [filteredSpecies, currentPage, pageSize]);

  // Reset trang khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedPhylum, selectedClass, selectedStatus, pageSize]);

  // Danh sách các Ngành và Lớp động vật
  const phylumList = useMemo(() => {
    if (!dataPayload?.species) return [];
    return Array.from(new Set(dataPayload.species.map(s => s.phylum))).filter(Boolean);
  }, [dataPayload]);

  const classList = useMemo(() => {
    if (!dataPayload?.species) return [];
    const filtered = selectedPhylum === 'ALL'
      ? dataPayload.species
      : dataPayload.species.filter(s => s.phylum === selectedPhylum);
    return Array.from(new Set(filtered.map(s => s.className))).filter(Boolean);
  }, [dataPayload, selectedPhylum]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    if (!dataPayload?.species) return { total: 0, cr: 0, en: 0, vu: 0, detailed: 0 };
    const all = dataPayload.species;
    return {
      total: all.length,
      cr: all.filter(s => s.redListStatus === 'CR').length,
      en: all.filter(s => s.redListStatus === 'EN').length,
      vu: all.filter(s => s.redListStatus === 'VU').length,
      detailed: all.filter(s => s.hasDetail).length
    };
  }, [dataPayload]);

  // Tạo tên tệp CSV tự động mô tả chính xác bộ lọc hiện tại
  const generateExportFileName = () => {
    const parts = ['danh_luc_do'];
    if (selectedClass !== 'ALL') {
      const cleanCls = selectedClass.replace(/Lớp\s+/i, '').replace(/[^a-zA-Z0-9\u00C0-\u1EF9]+/g, '_');
      parts.push(cleanCls);
    } else if (selectedPhylum !== 'ALL') {
      const cleanPhy = selectedPhylum.replace(/Ngành\s+/i, '').replace(/[^a-zA-Z0-9\u00C0-\u1EF9]+/g, '_');
      parts.push(cleanPhy);
    }
    if (selectedStatus !== 'ALL') {
      parts.push(selectedStatus);
    }
    if (searchTerm.trim()) {
      parts.push(`loc_${searchTerm.trim().slice(0, 15).replace(/[^a-zA-Z0-9\u00C0-\u1EF9]+/g, '_')}`);
    }
    parts.push(`${filteredSpecies.length}_loai`);
    parts.push(new Date().toISOString().slice(0, 10));
    return `${parts.join('_')}.csv`;
  };

  // Xuất CSV theo tùy chọn các cột
  const handleExportCSVWithColumns = async (colIds = selectedColumnIds) => {
    if (!filteredSpecies || filteredSpecies.length === 0) return;

    let targetColIds = Array.isArray(colIds) ? [...colIds] : [];
    // Tự động đảm bảo 'populationStatus' (Hiện Trạng Quần Thể) luôn có mặt nếu người dùng chưa chủ động tắt trong modal
    if (!targetColIds.includes('populationStatus') && !showExportModal) {
      targetColIds.push('populationStatus');
    }

    const activeCols = AVAILABLE_EXPORT_COLUMNS.filter(c => targetColIds.includes(c.id));
    if (activeCols.length === 0) {
      alert('Vui lòng chọn ít nhất 1 cột dữ liệu để xuất!');
      return;
    }

    try {
      setExportingCSV(true);

      // Điền thông tin chi tiết đầy đủ (hiện trạng quần thể, sinh cảnh, mối đe dọa...)
      let workingSpecies = filteredSpecies.map(item => {
        let merged = { ...item };
        if (!merged.hasDetail || !merged.populationStatus) {
          const local = localFallbackData?.species?.find(s => s.id === item.id || s.slug === item.slug);
          if (local) {
            merged = { ...local, ...merged, populationStatus: local.populationStatus || merged.populationStatus };
          }
        }
        return merged;
      });

      // Nếu vẫn còn loài thiếu chi tiết, tải nhanh từ server
      const missingDetail = workingSpecies.filter(s => !s.hasDetail || !s.populationStatus);
      if (missingDetail.length > 0) {
        setExportingProgressText(`Đang đồng bộ chi tiết cho ${missingDetail.length} loài...`);
        const concurrency = 6;
        for (let i = 0; i < missingDetail.length; i += concurrency) {
          const chunk = missingDetail.slice(i, i + concurrency);
          await Promise.all(chunk.map(async (item) => {
            try {
              const detailed = await fetchVnRedlistSpeciesDetail(item.id, item);
              const idx = workingSpecies.findIndex(s => s.id === item.id);
              if (idx !== -1 && detailed) {
                workingSpecies[idx] = { ...workingSpecies[idx], ...detailed };
              }
            } catch (e) {}
          }));
          setExportingProgressText(`Đã đồng bộ ${Math.min(i + chunk.length, missingDetail.length)}/${missingDetail.length} loài...`);
        }

        // Cập nhật lại vào dataPayload chính
        setDataPayload(prev => {
          if (!prev?.species) return prev;
          const merged = prev.species.map(s => {
            const found = workingSpecies.find(w => w.id === s.id);
            return found || s;
          });
          return { ...prev, species: merged, totalDetailed: merged.filter(s => s.hasDetail).length };
        });
      }

      setExportingProgressText('Đang tạo tệp CSV...');

      const headers = activeCols.map(c => `"${c.label.replace(/"/g, '""')}"`);
      const rows = workingSpecies.map((s, idx) => {
        return activeCols.map(col => {
          let val = col.getVal(s, idx);
          // Dự phòng an toàn: nếu cột là populationStatus mà s chưa có thì tra lại localFallbackData
          if ((val === '' || val === undefined) && col.id === 'populationStatus' && localFallbackData?.species) {
            const fallbackItem = localFallbackData.species.find(ls => ls.id === s.id || ls.slug === s.slug);
            if (fallbackItem?.populationStatus) val = fallbackItem.populationStatus;
          }
          // Làm sạch chuỗi nhiều dòng và escape dấu ngoặc kép an toàn cho Excel
          const cleanStr = String(val ?? '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/"/g, '""');
          return `"${cleanStr}"`;
        });
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', generateExportFileName());
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi khi xuất CSV:', err);
      alert('Lỗi khi tạo tệp CSV: ' + err.message);
    } finally {
      setExportingCSV(false);
      setExportingProgressText('');
    }
  };

  // Xuất CSV mặc định
  const handleExportCSV = () => {
    handleExportCSVWithColumns(selectedColumnIds);
  };

  // Xuất JSON
  const handleExportJSON = () => {
    if (!dataPayload?.species) return;
    const jsonStr = JSON.stringify(filteredSpecies, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `danh_luc_do_viet_nam_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 transition-colors duration-300 pb-12">
      {/* ── 1. Top Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-700/30">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-md">
              <PawPrint className="w-3.5 h-3.5 text-emerald-300" />
              <span>Cơ sở Dữ liệu Động vật Quốc gia · VAST / IEBR</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white font-heading">
              Danh Lục Đỏ Động Vật Việt Nam
            </h1>
            <p className="text-slate-200 text-sm leading-relaxed">
              Dữ liệu phân hạng bảo tồn, hiện trạng quần thể, sinh cảnh và bản đồ phân bố của <strong>720 loài động vật</strong> tại Việt Nam từ nguồn{' '}
              <a
                href="http://vnredlist.vast.vn/dong-vat/"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-emerald-300 transition-colors font-medium inline-flex items-center gap-1"
              >
                vnredlist.vast.vn <ExternalLink className="w-3 h-3" />
              </a>{' '}
              thuộc Viện Hàn lâm Khoa học và Công nghệ Việt Nam (VAST).
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleRescan}
              disabled={rescanning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              title="Cào làm mới toàn bộ 720 loài từ 54 trang phân lớp"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rescanning ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{rescanning ? 'Đang cào...' : 'Quét làm mới'}</span>
            </button>

            {deepCrawlRunning ? (
              <button
                onClick={handleStopDeepCrawl}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md transition-all cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                <span>Dừng cào sâu</span>
              </button>
            ) : (
              <button
                onClick={handleStartDeepCrawl}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                title="Tự động cào hồ sơ chi tiết (bản đồ, mô tả, đe dọa) của từng loài"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Quét sâu hồ sơ</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              disabled={exportingCSV}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer disabled:opacity-50"
              title="Xuất bảng Excel/CSV tiếng Việt đầy đủ hiện trạng quần thể và bảo tồn"
            >
              {exportingCSV ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span>{exportingCSV ? 'Đang tạo...' : 'Excel/CSV'}</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer"
              title="Xuất định dạng JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-300" />
              <span>JSON</span>
            </button>

            <DriveUploadButton
              fileName={generateExportFileName()}
              getData={() => {
                const activeCols = AVAILABLE_EXPORT_COLUMNS.filter(c => selectedColumnIds.includes(c.id));
                const colsToUse = activeCols.length > 0 ? activeCols : AVAILABLE_EXPORT_COLUMNS.filter(c => c.defaultChecked);
                const headers = colsToUse.map(c => `"${c.label.replace(/"/g, '""')}"`);
                const rows = filteredSpecies.map((s, idx) => {
                  return colsToUse.map(col => {
                    let val = col.getVal(s, idx);
                    if ((val === '' || val === undefined) && col.id === 'populationStatus' && localFallbackData?.species) {
                      const fallback = localFallbackData.species.find(ls => ls.id === s.id || ls.slug === s.slug);
                      if (fallback?.populationStatus) val = fallback.populationStatus;
                    }
                    const cleanStr = String(val ?? '')
                      .replace(/\r\n/g, '\n')
                      .replace(/\r/g, '\n')
                      .replace(/"/g, '""');
                    return `"${cleanStr}"`;
                  });
                });
                return '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
              }}
              mimeType="text/csv"
              buttonText="Lưu Drive"
              className="!py-2.5 !px-3 !text-xs !rounded-xl !bg-white/10 hover:!bg-white/20 !border !border-white/15 !text-white"
            />
          </div>
        </div>

        {/* Thông báo trạng thái / Deep crawl banner */}
        {(statusNotice || deepCrawlRunning) && (
          <div className="mt-4 pt-4 border-t border-emerald-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusNotice}</span>
            </div>
            {deepCrawlRunning && deepProgress && (
              <div className="flex items-center gap-3 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-600/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>
                  Đang cào: <strong>{deepProgress.current}</strong> / {deepProgress.total} ({deepProgress.percent}%)
                </span>
                <span className="text-[11px] text-slate-300 italic truncate max-w-[200px]">
                  {deepProgress.currentSpecies}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. KPI Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Tổng số loài</span>
            <PawPrint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-50 font-heading">
              {stats.total.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">loài động vật</span>
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            16 Lớp · 5 Ngành
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus(selectedStatus === 'CR' ? 'ALL' : 'CR')}
          className={`p-4 rounded-xl bg-white dark:bg-slate-800/90 border shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatus === 'CR'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20'
              : 'border-slate-200/80 dark:border-slate-700/80 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
            <span className="text-xs font-semibold">Cực kỳ nguy cấp (CR)</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-heading">
              {stats.cr}
            </span>
            <span className="text-[10px] text-slate-500">loài (CR)</span>
          </div>
          <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">
            Mức nguy cấp cao nhất
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus(selectedStatus === 'EN' ? 'ALL' : 'EN')}
          className={`p-4 rounded-xl bg-white dark:bg-slate-800/90 border shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatus === 'EN'
              ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20'
              : 'border-slate-200/80 dark:border-slate-700/80 hover:border-orange-400'
          }`}
        >
          <div className="flex items-center justify-between text-orange-600 dark:text-orange-400 mb-2">
            <span className="text-xs font-semibold">Nguy cấp (EN)</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400 font-heading">
              {stats.en}
            </span>
            <span className="text-[10px] text-slate-500">loài (EN)</span>
          </div>
          <div className="text-[10px] text-orange-600/80 dark:text-orange-400/80 mt-1 font-medium">
            Nguy cơ tuyệt chủng cao
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus(selectedStatus === 'VU' ? 'ALL' : 'VU')}
          className={`p-4 rounded-xl bg-white dark:bg-slate-800/90 border shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatus === 'VU'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20'
              : 'border-slate-200/80 dark:border-slate-700/80 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-semibold">Sắp nguy cấp (VU)</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
              {stats.vu}
            </span>
            <span className="text-[10px] text-slate-500">loài (VU)</span>
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1 font-medium">
            Dễ bị tổn thương
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Hồ sơ chi tiết</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-heading">
              {stats.detailed}
            </span>
            <span className="text-[10px] text-slate-500">/ {stats.total} loài</span>
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
            Có đầy đủ bản đồ & mô tả
          </div>
        </div>
      </div>

      {/* ── 3. Search & Filter Bar ── */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên tiếng Việt (Voi, Hổ, Cu li...), tên khoa học (Elephas...), tỉnh phân bố..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Dạng thẻ</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Dạng bảng</span>
            </button>
            <button
              onClick={() => setViewMode('taxonomy')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'taxonomy'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Phân loại học</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          {/* Ngành (Phylum) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Ngành động vật
            </label>
            <select
              value={selectedPhylum}
              onChange={(e) => {
                setSelectedPhylum(e.target.value);
                setSelectedClass('ALL');
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Tất cả ngành ({phylumList.length})</option>
              {phylumList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Lớp (Class) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Lớp động vật
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Tất cả lớp ({classList.length})</option>
              {classList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Phân hạng bảo tồn (IUCN / VN) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Phân hạng bảo tồn
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Tất cả phân hạng</option>
              <option value="CR">CR - Rất nguy cấp (Critically Endangered)</option>
              <option value="EN">EN - Nguy cấp (Endangered)</option>
              <option value="VU">VU - Sắp nguy cấp (Vulnerable)</option>
              <option value="NT">NT - Sắp bị đe dọa (Near Threatened)</option>
              <option value="LC">LC - Ít lo ngại (Least Concern)</option>
              <option value="DD">DD - Thiếu dữ liệu (Data Deficient)</option>
            </select>
          </div>

          {/* Sắp xếp */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Sắp xếp theo
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="threat-desc">Mức đe dọa (CR → EN → VU...)</option>
              <option value="name-asc">Tên Tiếng Việt (A-Z)</option>
              <option value="sci-asc">Tên Khoa Học (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Results summary & Filter Export Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Tìm thấy <strong className="text-slate-900 dark:text-slate-100 font-bold">{filteredSpecies.length}</strong> loài động vật phù hợp
              {dataPayload?.totalSpecies ? ` (trên tổng số ${dataPayload.totalSpecies} loài)` : ''}
            </span>

            {(selectedPhylum !== 'ALL' || selectedClass !== 'ALL' || selectedStatus !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedPhylum('ALL');
                  setSelectedClass('ALL');
                  setSelectedStatus('ALL');
                  setSearchTerm('');
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer ml-1"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>

          {/* Action buttons: Xuất CSV theo bộ lọc + Tùy chọn cột */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => handleExportCSVWithColumns(selectedColumnIds)}
              disabled={filteredSpecies.length === 0 || exportingCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Xuất ngay tệp CSV gồm ${filteredSpecies.length} loài theo các bộ lọc hiện tại`}
            >
              {exportingCSV ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{exportingProgressText || 'Đang tạo CSV...'}</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xuất CSV ({filteredSpecies.length} loài)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600 transition-all cursor-pointer"
              title="Mở bảng tùy chọn chọn lọc các cột dữ liệu cần xuất trong tệp CSV"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Tùy chọn cột ({selectedColumnIds.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Main Content Area ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Đang tải dữ liệu Danh lục Đỏ Động vật Việt Nam...
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Đồng bộ 720 loài qua 16 Lớp động vật
          </p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800/40">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">Không thể tải dữ liệu</h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>
          <button
            onClick={handleRescan}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            Thử tải lại
          </button>
        </div>
      ) : viewMode === 'taxonomy' ? (
        /* ── Taxonomy Tree View ── */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Cây phân loại học chính thức gồm <strong>5 Ngành</strong> và <strong>16 Lớp</strong> động vật theo hệ thống Danh lục Đỏ Việt Nam (VAST). Bấm vào từng Lớp để lọc nhanh các loài thuộc nhóm đó.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataPayload?.classes && (
              Array.from(new Set(dataPayload.classes.map(c => c.phylum))).map(phylumName => {
                const classesInPhylum = dataPayload.classes.filter(c => c.phylum === phylumName);
                const totalInPhylum = classesInPhylum.reduce((sum, c) => sum + (c.count || 0), 0);

                return (
                  <div
                    key={phylumName}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <TreePine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{phylumName}</h3>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {totalInPhylum} loài
                      </span>
                    </div>

                    <div className="space-y-2">
                      {classesInPhylum.map(cls => (
                        <div
                          key={cls.name}
                          onClick={() => {
                            setSelectedClass(cls.name);
                            setViewMode('grid');
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PawPrint className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {cls.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              {cls.count} loài
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginatedSpecies.map(species => {
              const statusMeta = RED_LIST_META[species.redListStatus] || RED_LIST_META.DD;
              return (
                <div
                  key={species.id}
                  onClick={() => handleOpenDetail(species)}
                  className="group bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Thumbnail Image */}
                    <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden">
                      {species.thumbnail ? (
                        <img
                          src={getSafeImageUrl(species.thumbnail)}
                          alt={species.vietnameseName}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            const fallback = getBackendImageProxyUrl(species.thumbnail);
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            } else {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }
                          }}
                        />
                      ) : null}
                      <div className={`${species.thumbnail ? 'hidden' : ''} w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-900`}>
                        <PawPrint className="w-10 h-10 stroke-1" />
                        <span className="text-[10px] mt-1 text-slate-400">Ảnh đang cập nhật</span>
                      </div>

                      {/* Phân hạng bảo tồn Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm ${statusMeta.badgeClass}`}>
                          {statusMeta.code}
                        </span>
                      </div>

                      {/* Lớp Badge */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white bg-slate-900/70 backdrop-blur-md px-2 py-1 rounded-md">
                        <span className="truncate">{species.className.replace(/Lớp\s+/i, '')}</span>
                        {species.hasDetail && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Đã có hồ sơ chi tiết" />
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 space-y-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {species.vietnameseName || species.scientificName}
                      </h3>
                      <p className="text-xs italic text-slate-500 dark:text-slate-400 font-serif line-clamp-1">
                        {species.scientificName}
                      </p>
                      {species.distributionVietnam && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 pt-1 flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                          <span>{species.distributionVietnam}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-3.5 py-2.5 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">
                      {statusMeta.label}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Chi tiết <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="text-slate-500">
                Hiển thị trang <strong>{currentPage}</strong> / {totalPages} (Tổng cộng {filteredSpecies.length} loài)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
                  let p = idx + 1;
                  if (totalPages > 7) {
                    if (currentPage > 4) {
                      p = currentPage - 3 + idx;
                      if (p > totalPages) p = totalPages - (6 - idx);
                    }
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer ${
                        currentPage === p
                          ? 'bg-emerald-600 text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Table View ── */
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3 w-12 text-center">STT</th>
                  <th className="py-3 px-3 w-16 text-center">Ảnh</th>
                  <th className="py-3 px-4">Tên Tiếng Việt</th>
                  <th className="py-3 px-4">Tên Khoa Học</th>
                  <th className="py-3 px-3 text-center">Phân Hạng</th>
                  <th className="py-3 px-3">Lớp / Ngành</th>
                  <th className="py-3 px-4">Người Đánh Giá</th>
                  <th className="py-3 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {paginatedSpecies.map((s, idx) => {
                  const statusMeta = RED_LIST_META[s.redListStatus] || RED_LIST_META.DD;
                  const itemIndex = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleOpenDetail(s)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                        {itemIndex}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                          {s.thumbnail ? (
                            <img
                              src={getSafeImageUrl(s.thumbnail)}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const fallback = getBackendImageProxyUrl(s.thumbnail);
                                if (e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                } else {
                                  e.currentTarget.style.display = 'none';
                                }
                              }}
                            />
                          ) : (
                            <PawPrint className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {s.vietnameseName}
                      </td>
                      <td className="py-2.5 px-4 italic font-serif text-slate-600 dark:text-slate-300">
                        {s.scientificName}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${statusMeta.badgeClass}`}>
                          {statusMeta.code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        <div className="font-semibold">{s.className.replace(/Lớp\s+/i, '')}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{s.phylum}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                        {s.assessor || 'Chờ quét'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(s);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 cursor-pointer"
                        >
                          Xem hồ sơ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination for Table */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-500">Trang {currentPage} / {totalPages} ({filteredSpecies.length} loài)</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. Modal Chi Tiết Hồ Sơ Loài (Species Profile Modal) ── */}
      {selectedSpecies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-md ${RED_LIST_META[selectedSpecies.redListStatus]?.badgeClass || RED_LIST_META.DD.badgeClass}`}>
                    {selectedSpecies.redListStatus || 'DD'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {RED_LIST_META[selectedSpecies.redListStatus]?.label || 'Thiếu dữ liệu'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedSpecies.className}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 truncate">
                  {selectedSpecies.vietnameseName || selectedSpecies.scientificName}
                </h2>
                <p className="text-sm italic font-serif text-slate-600 dark:text-slate-300">
                  {selectedSpecies.scientificName}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={selectedSpecies.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Mở bài viết gốc trên vnredlist.vast.vn"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedSpecies(null)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs Bar */}
            <div className="flex items-center gap-1 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto text-xs shrink-0">
              {[
                { id: 'overview', label: 'Tổng quan & Hồ sơ' },
                { id: 'taxonomy', label: 'Phân loại học' },
                { id: 'distribution', label: 'Phân bố & Bản đồ' },
                { id: 'ecology', label: 'Sinh thái & Quần thể' },
                { id: 'conservation', label: 'Đe dọa & Bảo tồn' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveModalTab(tab.id)}
                  className={`px-3.5 py-3 font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                    activeModalTab === tab.id
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-sm">
              {loadingDetail && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Đang tải thông tin chi tiết đầy đủ từ máy chủ vnredlist.vast.vn...</span>
                </div>
              )}

              {/* ── Tab: Overview ── */}
              {activeModalTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Ảnh loài & Bản đồ nhỏ */}
                    <div className="space-y-3">
                      <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 aspect-[4/3] relative">
                        {selectedSpecies.thumbnail ? (
                          <img
                            src={getSafeImageUrl(selectedSpecies.thumbnail)}
                            alt={selectedSpecies.vietnameseName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const fallback = getBackendImageProxyUrl(selectedSpecies.thumbnail);
                              if (e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
                              } else {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }
                            }}
                          />
                        ) : null}
                        <div className={`${selectedSpecies.thumbnail ? 'hidden' : ''} w-full h-full flex flex-col items-center justify-center text-slate-400`}>
                          <PawPrint className="w-12 h-12" />
                          <span className="text-xs mt-1">Chưa có ảnh</span>
                        </div>
                      </div>

                      {selectedSpecies.distributionMapUrl && (
                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                          <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            Bản đồ phân bố (VAST)
                          </div>
                          <a
                            href={selectedSpecies.distributionMapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-[4/3] bg-slate-900"
                          >
                            <img
                              src={getSafeImageUrl(selectedSpecies.distributionMapUrl)}
                              alt="Bản đồ phân bố"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const fallback = getBackendImageProxyUrl(selectedSpecies.distributionMapUrl);
                                if (e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                }
                              }}
                            />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Bảng tóm tắt hồ sơ */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Phân hạng bảo tồn
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-base font-black px-2 py-0.5 rounded ${RED_LIST_META[selectedSpecies.redListStatus]?.badgeClass || RED_LIST_META.DD.badgeClass}`}>
                              {selectedSpecies.redListStatus || 'DD'}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {RED_LIST_META[selectedSpecies.redListStatus]?.label || 'Thiếu dữ liệu'}
                            </span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Năm công bố
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {selectedSpecies.publicationYear || '2023 - 2024'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Người đánh giá
                          </span>
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {selectedSpecies.assessor || 'Chờ đồng bộ chi tiết'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Người góp ý
                          </span>
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                            {selectedSpecies.contributors || 'Nhiều chuyên gia sinh thái học'}
                          </span>
                        </div>
                      </div>

                      {/* Phân bố tại Việt Nam */}
                      {selectedSpecies.distributionVietnam && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            Phân bố tại Việt Nam
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            {selectedSpecies.distributionVietnam}
                          </p>
                        </div>
                      )}

                      {/* Hiện trạng quần thể */}
                      {selectedSpecies.populationStatus && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Hiện trạng quần thể
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            {selectedSpecies.populationStatus}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Taxonomy ── */}
              {activeModalTab === 'taxonomy' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Hệ thống Phân loại học 7 Bậc
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Giới (Kingdom)</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {selectedSpecies.taxonomy?.['Giới'] || 'Animalia'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Ngành (Phylum)</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {selectedSpecies.taxonomy?.['Ngành'] || selectedSpecies.phylum}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Lớp (Class)</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {selectedSpecies.taxonomy?.['Lớp'] || selectedSpecies.className}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Bộ (Order)</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {selectedSpecies.taxonomy?.['Bộ'] || 'Chưa cập nhật'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Họ (Family)</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {selectedSpecies.taxonomy?.['Họ'] || 'Chưa cập nhật'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Chi / Giống (Genus)</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {selectedSpecies.taxonomy?.['Chi/Giống'] || 'Chưa cập nhật'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {selectedSpecies.taxonomy?.Synonym && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-xs font-bold text-slate-500">Tên đồng danh (Synonyms)</span>
                      <p className="text-xs italic text-slate-700 dark:text-slate-300">
                        {selectedSpecies.taxonomy.Synonym}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.taxonomy?.['Tên phổ thông'] && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-xs font-bold text-slate-500">Tên địa phương / Tên phổ thông khác</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {selectedSpecies.taxonomy['Tên phổ thông']}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Distribution ── */}
              {activeModalTab === 'distribution' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      Phân bố tại Việt Nam
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedSpecies.distributionVietnam || 'Chưa có dữ liệu chi tiết phân bố.'}
                    </p>
                  </div>

                  {selectedSpecies.distributionWorld && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Phân bố trên Thế giới
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedSpecies.distributionWorld}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.distributionMapUrl && (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-between">
                        <span>Bản đồ tọa độ phân bố chính thức từ VAST</span>
                        <a
                          href={selectedSpecies.distributionMapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          Xem ảnh gốc cỡ lớn <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="bg-slate-950 p-2 flex justify-center">
                        <img
                          src={getSafeImageUrl(selectedSpecies.distributionMapUrl)}
                          alt="Bản đồ phân bố"
                          className="max-h-96 object-contain rounded-lg"
                          onError={(e) => {
                            const fallback = getBackendImageProxyUrl(selectedSpecies.distributionMapUrl);
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Ecology ── */}
              {activeModalTab === 'ecology' && (
                <div className="space-y-4">
                  {selectedSpecies.habitat && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Đặc điểm sinh cảnh sống
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedSpecies.habitat}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.diet && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Tập tính thức ăn
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedSpecies.diet}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.populationTrend && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Xu hướng biến động quần thể
                      </span>
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {selectedSpecies.populationTrend}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.criteria && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Tiêu chuẩn đánh giá IUCN
                      </span>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedSpecies.criteria}
                      </p>
                      {selectedSpecies.criteriaInterpretation && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                          {selectedSpecies.criteriaInterpretation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Conservation ── */}
              {activeModalTab === 'conservation' && (
                <div className="space-y-4">
                  {selectedSpecies.threats && (
                    <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 space-y-1.5">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Mối đe dọa chính
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {selectedSpecies.threats}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.conservationExisting && (
                    <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-1.5">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Biện pháp bảo tồn đã có
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {selectedSpecies.conservationExisting}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.conservationProposed && (
                    <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 space-y-1.5">
                      <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                        Biện pháp bảo tồn đề xuất
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {selectedSpecies.conservationProposed}
                      </p>
                    </div>
                  )}

                  {selectedSpecies.bibliography && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        Tài liệu tham khảo & Trích dẫn
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {selectedSpecies.bibliography}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Nguồn: vnredlist.vast.vn · Bản quyền VAST & IEBR
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={selectedSpecies.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Mở trang gốc</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Modal Tùy Chọn Xuất Dữ Liệu CSV Theo Bộ Lọc ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Tùy chọn xuất dữ liệu CSV theo bộ lọc
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Chọn các trường thông tin cần đưa vào tệp CSV xuất bản
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
              {/* Tóm tắt điều kiện lọc đang chọn */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-emerald-600" />
                    Điều kiện bộ lọc đang áp dụng ({filteredSpecies.length} loài)
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    {filteredSpecies.length} loài
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/60 text-slate-700 dark:text-slate-300">
                    Ngành: <strong>{selectedPhylum === 'ALL' ? 'Tất cả' : selectedPhylum}</strong>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/60 text-slate-700 dark:text-slate-300">
                    Lớp: <strong>{selectedClass === 'ALL' ? 'Tất cả' : selectedClass}</strong>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/60 text-slate-700 dark:text-slate-300">
                    Phân hạng: <strong>{selectedStatus === 'ALL' ? 'Tất cả' : selectedStatus}</strong>
                  </span>
                  {searchTerm.trim() && (
                    <span className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/60 text-slate-700 dark:text-slate-300">
                      Từ khóa: <strong>"{searchTerm.trim()}"</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Tên tệp xuất dự kiến */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Tên tệp xuất dự kiến:
                </label>
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 break-all select-all">
                  {generateExportFileName()}
                </div>
              </div>

              {/* Công cụ chọn nhanh cột */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Chọn các cột thông tin ({selectedColumnIds.length}/{AVAILABLE_EXPORT_COLUMNS.length} cột):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedColumnIds(AVAILABLE_EXPORT_COLUMNS.map(c => c.id))}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    onClick={() => setSelectedColumnIds(AVAILABLE_EXPORT_COLUMNS.filter(c => c.defaultChecked).map(c => c.id))}
                    className="text-[11px] text-slate-600 dark:text-slate-400 hover:underline font-semibold cursor-pointer"
                  >
                    Mặc định
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    onClick={() => setSelectedColumnIds([])}
                    className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Danh sách checkbox các cột */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                {AVAILABLE_EXPORT_COLUMNS.map(col => {
                  const checked = selectedColumnIds.includes(col.id);
                  return (
                    <label
                      key={col.id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                        checked
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-slate-900 dark:text-slate-100 font-medium'
                          : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/70 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setSelectedColumnIds(prev => prev.filter(id => id !== col.id));
                          } else {
                            setSelectedColumnIds(prev => [...prev, col.id]);
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="truncate flex-1">{col.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                        {col.category}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500">
                Định dạng: CSV (UTF-8 with BOM, mở được trực tiếp bằng Microsoft Excel)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Đóng
                </button>

                <button
                  onClick={() => {
                    handleExportCSVWithColumns(selectedColumnIds);
                    setShowExportModal(false);
                  }}
                  disabled={filteredSpecies.length === 0 || selectedColumnIds.length === 0}
                  className="px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải CSV ({filteredSpecies.length} loài)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
