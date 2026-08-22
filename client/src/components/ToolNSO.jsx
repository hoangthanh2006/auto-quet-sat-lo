import { useState, useEffect } from 'react';
import {
  BarChart3,
  Database,
  FileText,
  Globe,
  Search,
  Download,
  Copy,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Table as TableIcon,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import {
  fetchNsoPxWebTables,
  scrapeNsoPxTable,
  scrapeNsoArticles,
  scrapeNsoUrl
} from '../services/api';
import DriveUploadButton from './DriveUploadButton';

const CATEGORIES = [
  {
    id: 'dan-so-lao-dong',
    title: 'DÂN SỐ VÀ LAO ĐỘNG',
    pxdb: 'Dân số và lao động',
    iconColor: 'from-blue-600 to-indigo-600',
    subcategories: [
      { name: 'Dân số', url: 'https://www.nso.gov.vn/dan-so/', pxdb: 'Dân số và lao động' },
      { name: 'Lao động việc làm', url: 'https://www.nso.gov.vn/lao-dong/', pxdb: 'Dân số và lao động' }
    ]
  },
  {
    id: 'tai-khoan-quoc-gia-tai-chinh',
    title: 'TÀI KHOẢN QUỐC GIA VÀ TÀI CHÍNH',
    pxdb: 'Tài khoản quốc gia',
    iconColor: 'from-emerald-600 to-teal-600',
    subcategories: [
      { name: 'Tài khoản quốc gia', url: 'https://www.nso.gov.vn/tai-khoan-quoc-gia/', pxdb: 'Tài khoản quốc gia' },
      { name: 'Ngân hàng, bảo hiểm & thu chi ngân sách', url: 'https://www.nso.gov.vn/ngan-hang-bao-hiem-va-thu-chi-ngan-sach/', pxdb: 'Tài khoản quốc gia' }
    ]
  },
  {
    id: 'kinh-te',
    title: 'KINH TẾ',
    pxdb: 'Công nghiệp',
    iconColor: 'from-purple-600 to-violet-600',
    subcategories: [
      { name: 'Nông, Lâm nghiệp và Thủy sản', url: 'https://www.nso.gov.vn/nong-lam-nghiep-va-thuy-san/', pxdb: 'Công nghiệp' },
      { name: 'Đầu tư và Xây dựng', url: 'https://www.nso.gov.vn/dau-tu-va-xay-dung/', pxdb: 'Đầu tư' },
      { name: 'Công nghiệp', url: 'https://www.nso.gov.vn/cong-nghiep/', pxdb: 'Công nghiệp' },
      { name: 'Doanh nghiệp', url: 'https://www.nso.gov.vn/doanh-nghiep/', pxdb: 'Doanh nghiệp' },
      { name: 'Thương mại và Du lịch', url: 'https://www.nso.gov.vn/thuong-mai-dich-vu/', pxdb: 'Doanh nghiệp' },
      { name: 'Thống kê Giá', url: 'https://www.nso.gov.vn/gia/', pxdb: 'Công nghiệp' }
    ]
  },
  {
    id: 'xa-hoi-moi-truong-hanh-chinh',
    title: 'XÃ HỘI MÔI TRƯỜNG VÀ ĐƠN VỊ HÀNH CHÍNH',
    pxdb: 'Giáo dục',
    iconColor: 'from-rose-600 to-pink-600',
    subcategories: [
      { name: 'Khoa học công nghệ, giáo dục', url: 'https://www.nso.gov.vn/giao-duc/', pxdb: 'Giáo dục' },
      { name: 'Y tế, mức sống, văn hóa & môi trường', url: 'https://www.nso.gov.vn/y-te-muc-song-dan-cu-van-hoa-the-thao-trat-tu-an-toan-xa-hoi-va-moi-truong/', pxdb: 'Giáo dục' },
      { name: 'Đơn vị hành chính, Đất đai và Khí hậu', url: 'https://www.nso.gov.vn/don-vi-hanh-chinh-dat-dai-va-khi-hau/', pxdb: 'Giáo dục' }
    ]
  },
  {
    id: 'tong-dieu-tra',
    title: 'TỔNG ĐIỀU TRA',
    pxdb: 'Dân số và lao động',
    iconColor: 'from-amber-600 to-orange-600',
    subcategories: [
      { name: 'Tổng điều tra dân số và nhà ở', url: 'https://www.nso.gov.vn/tong-dieu-tra-dan-so-va-nha-o/', pxdb: 'Dân số và lao động' },
      { name: 'Tổng điều tra nông thôn & nông nghiệp', url: 'https://www.nso.gov.vn/tong-dieu-tra-nong-thon-nong-nghiep-va-thuy-san/', pxdb: 'Công nghiệp' },
      { name: 'Tổng điều tra kinh tế', url: 'https://www.nso.gov.vn/tong-dieu-tra-kinh-te/', pxdb: 'Doanh nghiệp' }
    ]
  }
];

export default function ToolNSO() {
  const [selectedCat, setSelectedCat] = useState(CATEGORIES[0]);
  const [selectedSubcat, setSelectedSubcat] = useState(CATEGORIES[0].subcategories[0]);
  const [mode, setMode] = useState('pxweb'); // 'pxweb' | 'articles' | 'custom'

  // PX-Web state
  const [tablesList, setTablesList] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [scrapingTable, setScrapingTable] = useState(false);
  const [scrapedTableData, setScrapedTableData] = useState(null);

  // Articles state
  const [articlesList, setArticlesList] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Custom URL state
  const [customUrl, setCustomUrl] = useState('https://www.nso.gov.vn/dan-so/');
  const [scrapingCustom, setScrapingCustom] = useState(false);
  const [customResult, setCustomResult] = useState(null);

  // Global state / Filter
  const [dataSearch, setDataSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [copiedText, setCopiedText] = useState(false);

  // Fetch PX-Web tables when selected category/subcat changes
  useEffect(() => {
    if (mode === 'pxweb') {
      loadPxWebTables(selectedSubcat.url, selectedSubcat.pxdb || selectedCat.pxdb);
    } else if (mode === 'articles') {
      loadCategoryArticles(selectedSubcat.url);
    }
  }, [selectedCat, selectedSubcat, mode]);

  const loadPxWebTables = async (categoryUrl, pxdb) => {
    setLoadingTables(true);
    setErrorMsg(null);
    try {
      const data = await fetchNsoPxWebTables(categoryUrl, pxdb);
      if (data.success) {
        setTablesList(data.data || []);
      } else {
        setErrorMsg(data.error || 'Không thể tải danh sách bảng thống kê');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ. Vui lòng kiểm tra backend server trên port 3002.');
    } finally {
      setLoadingTables(false);
    }
  };

  const loadCategoryArticles = async (url) => {
    setLoadingArticles(true);
    setErrorMsg(null);
    try {
      const data = await scrapeNsoArticles(url, 30);
      if (data.success) {
        setArticlesList(data.data || []);
      } else {
        setErrorMsg(data.error || 'Không thể lấy bài viết chuyên mục');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleScrapePxTable = async (tableItem) => {
    setSelectedTable(tableItem);
    setScrapingTable(true);
    setErrorMsg(null);
    setScrapedTableData(null);
    try {
      const data = await scrapeNsoPxTable(tableItem.pxUrl);
      if (data.success) {
        setScrapedTableData(data.data);
      } else {
        setErrorMsg(data.error || 'Không thể lấy dữ liệu bảng thống kê này');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi cào bảng PX-Web');
    } finally {
      setScrapingTable(false);
    }
  };

  const handleScrapeCustomUrl = async () => {
    if (!customUrl || !customUrl.trim()) return;
    setScrapingCustom(true);
    setErrorMsg(null);
    setCustomResult(null);
    try {
      const data = await scrapeNsoUrl(customUrl.trim());
      if (data.success) {
        setCustomResult(data.data);
      } else {
        setErrorMsg(data.error || 'Không thể cào dữ liệu từ URL này');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setScrapingCustom(false);
    }
  };


  const removeVietnameseTones = (str) => {
    if (!str) return 'nso_data';
    const clean = str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
    return clean || 'nso_data';
  };

  // Export functions
  const downloadCSV = (rows, title = 'nso_data') => {
    if (!rows || rows.length === 0) return;
    const cleanTitle = removeVietnameseTones(title);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${cleanTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyJSON = (data) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const filteredTables = tablesList.filter(t =>
    t.text.toLowerCase().includes(tableSearch.toLowerCase()) ||
    t.id.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-0"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold backdrop-blur-md border border-blue-400/20 mb-3">
              <Globe className="w-3.5 h-3.5" /> nso.gov.vn - Tổng cục Thống kê Việt Nam
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-400" />
              NSO Scraper & Data Portal
            </h1>
            <p className="text-blue-200 text-sm mt-2 max-w-2xl leading-relaxed">
              Trích xuất dữ liệu niên giám thống kê, bảng số liệu PX-Web, thông cáo báo chí, tình hình kinh tế - xã hội từ website Tổng cục Thống kê (nso.gov.vn).
            </p>
          </div>
          <a
            href="https://www.nso.gov.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs backdrop-blur-md transition-all border border-white/10 shrink-0 self-start md:self-auto"
          >
            Truy cập nso.gov.vn <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* 5 Main Menu Category Tabs (Matching user provided Image 1) */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 border-t border-white/10 pt-6">
          {CATEGORIES.map(cat => {
            const active = selectedCat.id === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCat(cat);
                  setSelectedSubcat(cat.subcategories[0]);
                }}
                className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                  active
                    ? 'bg-white/20 border-white/40 text-white shadow-lg font-bold'
                    : 'bg-white/5 border-white/5 text-blue-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider line-clamp-2">{cat.title}</div>
                <div className="text-[10px] text-blue-300/80 mt-1 font-normal">
                  {cat.subcategories.length} chuyên mục nhỏ
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subcategory Selector & Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Subcategory Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Chuyên mục:
            </span>
            {selectedCat.subcategories.map((sub, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedSubcat(sub)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedSubcat.name === sub.name
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>

          {/* Scrape Mode Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <button
              onClick={() => setMode('pxweb')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                mode === 'pxweb'
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Bảng Thống kê PX-Web
            </button>
            <button
              onClick={() => setMode('articles')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                mode === 'articles'
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Bài viết & Báo cáo
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                mode === 'custom'
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> URL Tùy chỉnh
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MODE 1: PX-Web Database Tables */}
      {mode === 'pxweb' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Tables List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2 font-heading">
                  <Database className="w-4 h-4 text-violet-500" />
                  Danh sách Bảng số liệu
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300">
                  {filteredTables.length} bảng
                </span>
              </div>

              {/* Search filter */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Lọc tên bảng hoặc mã V0..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Table items list */}
              {loadingTables ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
                  Đang tải danh sách bảng PX-Web từ nso.gov.vn...
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Không tìm thấy bảng số liệu phù hợp
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredTables.map((t) => {
                    const isSelected = selectedTable?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleScrapePxTable(t)}
                        className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${
                          isSelected
                            ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-500 text-violet-900 dark:text-violet-100 font-semibold shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium line-clamp-2 leading-relaxed">{t.text}</span>
                          <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                            {t.id}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                          <span>Cập nhật: {t.updated ? new Date(t.updated).toLocaleDateString('vi-VN') : 'N/A'}</span>
                          <span className="text-violet-500 font-semibold flex items-center gap-0.5">
                            Xem số liệu <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Scraped Table View */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-md min-h-[500px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm font-heading flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-emerald-500" />
                      {selectedTable ? selectedTable.text : 'Chọn bảng số liệu bên trái'}
                    </h3>
                    {selectedTable && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Mã bảng: {selectedTable.id} | Nguồn: pxweb.nso.gov.vn
                      </p>
                    )}
                  </div>
                  {scrapedTableData && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadCSV(scrapedTableData.rows, selectedTable?.text || 'nso_pxweb')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> CSV (Excel)
                      </button>
                      <button
                        onClick={() => copyJSON(scrapedTableData.rows)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" /> {copiedText ? 'Đã chép!' : 'JSON'}
                      </button>
                      <DriveUploadButton
                        fileName={removeVietnameseTones(selectedTable?.text || 'nso_pxweb')}
                        getData={() => {
                          return scrapedTableData.rows.map(e => e.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
                        }}
                        mimeType="text/csv"
                      />
                    </div>
                  )}
                </div>

                {/* Table content view */}
                {scrapingTable ? (
                  <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
                    <span>Đang tự động cào và trích xuất bảng số liệu từ PX-Web...</span>
                  </div>
                ) : !scrapedTableData ? (
                  <div className="py-24 text-center text-slate-400 dark:text-slate-600 text-sm flex flex-col items-center gap-2">
                    <Database className="w-12 h-12 opacity-30" />
                    <span>Vui lòng chọn 1 bảng thống kê bên danh sách trái để xem dữ liệu</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Search inside table */}
                    <div className="relative max-w-xs">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Lọc số liệu trong bảng..."
                        value={dataSearch}
                        onChange={(e) => setDataSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    {/* Matrix table renderer */}
                    <div className="overflow-x-auto max-h-[450px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-xs text-left border-collapse">
                        <tbody>
                          {scrapedTableData.rows
                            .filter(row => row.some(cell => (cell || '').toLowerCase().includes(dataSearch.toLowerCase())))
                            .map((row, rIdx) => {
                              const isSingleCell = row.length === 1 || (rIdx === 0 && row.length < (scrapedTableData.colCount || 2));
                              if (isSingleCell) {
                                return (
                                  <tr key={rIdx} className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700">
                                    <td
                                      colSpan={scrapedTableData.colCount || 100}
                                      className="p-3 text-left text-xs font-bold bg-violet-50/50 dark:bg-slate-800/80 text-violet-950 dark:text-violet-200 border-b border-slate-300 dark:border-slate-700"
                                    >
                                      {row[0]}
                                    </td>
                                  </tr>
                                );
                              }

                              const isHeader = rIdx < 3;
                              return (
                                <tr
                                  key={rIdx}
                                  className={
                                    isHeader
                                      ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800/50 text-slate-700 dark:text-slate-300'
                                  }
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`p-2.5 border-r border-slate-200 dark:border-slate-800/50 ${
                                        cIdx === 0 ? 'font-semibold' : 'text-right'
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2">
                      <span>Tổng số hàng: {scrapedTableData.rowCount} | Cột: {scrapedTableData.colCount}</span>
                      <span>Trích xuất từ NSO Vietnam</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Category Articles & Reports */}
      {mode === 'articles' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2 font-heading">
              <FileText className="w-5 h-5 text-indigo-500" />
              Bài viết & Báo cáo chuyên mục: {selectedSubcat.name}
            </h3>
            <button
              onClick={() => loadCategoryArticles(selectedSubcat.url)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingArticles ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingArticles ? (
            <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              Đang cào danh sách bài viết từ {selectedSubcat.url}...
            </div>
          ) : articlesList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Không tìm thấy bài viết nào trong chuyên mục này
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {articlesList.map((art, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                >
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-2">
                      {art.type === 'pxweb_table' ? 'Bảng PX-Web' : 'Bài viết'}
                    </span>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-2">
                      {art.title}
                    </h4>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <button
                      onClick={() => {
                        setCustomUrl(art.url);
                        setMode('custom');
                        handleScrapeCustomUrl();
                      }}
                      className="text-violet-600 dark:text-violet-400 hover:underline font-medium flex items-center gap-1"
                    >
                      Cào nội dung bài <ChevronRight className="w-3 h-3" />
                    </button>
                    <a
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 text-[11px]"
                    >
                      Xem trang gốc <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODE 3: Custom URL Scraper */}
      {mode === 'custom' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2 font-heading">
              <Globe className="w-5 h-5 text-purple-500" />
              Cào dữ liệu từ URL nso.gov.vn tùy chỉnh
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Nhập đường dẫn trang web nso.gov.vn..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleScrapeCustomUrl}
                disabled={scrapingCustom}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${scrapingCustom ? 'animate-spin' : ''}`} />
                {scrapingCustom ? 'Đang cào...' : 'Bắt đầu cào'}
              </button>
            </div>
          </div>

          {/* Custom Result */}
          {customResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 font-heading">
                    {customResult.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">URL: {customResult.url}</p>
                </div>
                <button
                  onClick={() => copyJSON(customResult)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Full JSON
                </button>
              </div>

              {/* Data Snippets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-heading">
                    {customResult.paragraphsCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Đoạn văn bản</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
                    {customResult.tablesCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Bảng số liệu HTML</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-heading">
                    {customResult.attachmentsCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tệp PDF/Excel đính kèm</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
                    {customResult.imagesCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hình ảnh/Infographics</div>
                </div>
              </div>

              {/* Display Tables extracted if available */}
              {customResult.tables && customResult.tables.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm font-heading flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-emerald-500" />
                    Các bảng số liệu tìm thấy ({customResult.tables.length})
                  </h3>
                  {customResult.tables.map((tbl, tIdx) => (
                    <div key={tIdx} className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-xs text-left border-collapse">
                        <tbody>
                          {tbl.rows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-100 dark:bg-slate-800 font-bold' : 'border-b border-slate-200 dark:border-slate-800'}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2 border-r border-slate-200 dark:border-slate-800">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {/* Display Paragraphs */}
              {customResult.paragraphs && customResult.paragraphs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm font-heading">Nội dung văn bản:</h3>
                  <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl text-xs space-y-2 max-h-96 overflow-y-auto leading-relaxed">
                    {customResult.paragraphs.map((p, pIdx) => (
                      <p key={pIdx} className="text-slate-700 dark:text-slate-300">{p}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
