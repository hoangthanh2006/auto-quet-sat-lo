import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Plus, Trash2, Download, FileText, CheckCircle, XCircle, ChevronLeft, ChevronRight, Play, Square, Settings, Wrench } from 'lucide-react';
import { parseSitemap, executeScrapeStream } from '../services/api';

// Small component to auto-scroll logs container to bottom
function ScrollToBottom({ dependency }) {
  const elementRef = useRef(null);
  useEffect(() => {
    elementRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dependency]);
  return <div ref={elementRef} />;
}

export default function OtherTools() {
  const [sitemapUrl, setSitemapUrl] = useState('https://thophuong.vn/sitemap.xml');
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [urls, setUrls] = useState([]);
  const [filteredUrls, setFilteredUrls] = useState([]);
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const [filterText, setFilterText] = useState('/song/');
  const [error, setError] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Scraper config
  const [fields, setFields] = useState([
    { label: 'Tên bài hát', selector: 'h1', type: 'text' },
    { label: 'Lời và Hợp âm', selector: '.columns-1', type: 'text' }
  ]);
  const [concurrency, setConcurrency] = useState(5);
  const [delayMs, setDelayMs] = useState(500);
  
  // Scraping progress
  const [scraping, setScraping] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);

  // Fetch and parse sitemap
  const handleParseSitemap = async () => {
    if (!sitemapUrl.trim()) {
      setError('Vui lòng nhập URL Sitemap');
      return;
    }
    
    setLoadingSitemap(true);
    setError(null);
    setUrls([]);
    setFilteredUrls([]);
    setSelectedUrls(new Set());
    setResults(null);
    setProgress(0);
    setLogs([]);
    
    try {
      const res = await parseSitemap(sitemapUrl.trim());
      if (res.success && res.urls) {
        setUrls(res.urls);
        applyFilter(res.urls, filterText);
      } else {
        setError('Không thể phân tích sitemap');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi quét sitemap. Hãy kiểm tra lại đường dẫn sitemap.');
    } finally {
      setLoadingSitemap(false);
    }
  };

  // Apply filter text to sitemap urls list
  const applyFilter = (allUrls, text) => {
    let list = allUrls;
    if (text.trim()) {
      list = allUrls.filter(item => 
        item.url.toLowerCase().includes(text.toLowerCase())
      );
    }
    setFilteredUrls(list);
    setCurrentPage(1);
    
    // Auto select filtered URLs by default (Vietnamese workflow convenience)
    const newSelected = new Set();
    list.forEach(item => newSelected.add(item.url));
    setSelectedUrls(newSelected);
  };

  // Re-apply filter when sitemap list updates
  useEffect(() => {
    if (urls.length > 0) {
      applyFilter(urls, filterText);
    }
  }, [filterText, urls]);

  // Handle URL checkbox toggle
  const toggleSelectUrl = (url) => {
    const next = new Set(selectedUrls);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setSelectedUrls(next);
  };

  // Toggle selection for all filtered URLs
  const toggleSelectAll = () => {
    if (selectedUrls.size === filteredUrls.length) {
      setSelectedUrls(new Set());
    } else {
      const next = new Set();
      filteredUrls.forEach(item => next.add(item.url));
      setSelectedUrls(next);
    }
  };

  // Selector fields utilities
  const addField = () => {
    setFields([...fields, { label: '', selector: '', type: 'text' }]);
  };

  const removeField = (index) => {
    if (fields.length > 1) {
      setFields(fields.filter((_, i) => i !== index));
    }
  };

  const updateField = (index, key, val) => {
    const updated = [...fields];
    updated[index][key] = val;
    setFields(updated);
  };

  // Execute list scrape
  const handleStartScrape = async () => {
    const selectedList = Array.from(selectedUrls);
    if (selectedList.length === 0) {
      setError('Vui lòng chọn ít nhất một URL để cào dữ liệu');
      return;
    }

    const validFields = fields.filter(f => f.label.trim() && f.selector.trim());
    if (validFields.length === 0) {
      setError('Vui lòng định cấu hình ít nhất một trường dữ liệu hợp lệ (nhập đầy đủ Tên trường và CSS Selector)');
      return;
    }

    setScraping(true);
    setError(null);
    setResults(null);
    setLogs([]);
    setProgress(0);

    try {
      const scrapedData = await executeScrapeStream(
        sitemapUrl, // dummy base url, ignored in backend list mode
        validFields,
        {
          crawlMode: 'list',
          urls: selectedList,
          concurrency,
          delayMs
        },
        (newLog) => {
          setLogs(prev => [...prev, newLog]);
          
          // Try to extract progress from logs (e.g. "[Cào trang 3/10]")
          const progressMatch = newLog.match(/trang\s+(\d+)\/(\d+)/i);
          if (progressMatch) {
            const current = parseInt(progressMatch[1], 10);
            const total = parseInt(progressMatch[2], 10);
            setProgress(Math.round((current / total) * 100));
          }
        }
      );

      if (scrapedData && scrapedData.length > 0) {
        setResults(scrapedData);
      } else {
        setError('Không lấy được dữ liệu. Vui lòng kiểm tra lại cấu hình CSS selector.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi cào dữ liệu');
    } finally {
      setScraping(false);
    }
  };

  // Export Results
  const handleExportJSON = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitemap-scrape-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!results || results.length === 0) return;
    const keys = Array.from(new Set(results.flatMap(row => Object.keys(row))));
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      keys.join(','),
      ...results.map(row => keys.map(k => escapeCSV(row[k] || '')).join(','))
    ];

    const content = '\uFEFF' + csvRows.join('\n'); // Excel UTF-8 BOM
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitemap-scrape-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pagination bounds
  const totalPages = Math.ceil(filteredUrls.length / itemsPerPage);
  const paginatedUrls = filteredUrls.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Header Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Wrench className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-950 dark:text-slate-50 font-heading">
            Sitemap Parser & Scraper
          </h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Phân tích sitemap XML, lọc danh sách bài viết/sản phẩm và tiến hành cào dữ liệu hàng loạt theo cấu hình.
        </p>
      </div>

      {/* Step 1: Parse Sitemap */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2 font-heading">
          <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">1</span>
          Nhập đường dẫn Sitemap
        </h3>
        
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm text-slate-800 dark:text-slate-100 shadow-inner font-mono"
              />
            </div>
            <button
              onClick={handleParseSitemap}
              disabled={loadingSitemap || scraping}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 shadow-sm"
            >
              {loadingSitemap ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Quét Sitemap</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: URL List Filtration */}
      {urls.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2 font-heading">
              <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">2</span>
              Lọc và Chọn liên kết cào
            </h3>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg font-semibold border border-slate-200 dark:border-slate-700">
                Tìm thấy {urls.length} liên kết
              </span>
              <span className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg font-bold">
                Đã chọn: {selectedUrls.size} / {filteredUrls.length}
              </span>
            </div>
          </div>

          {/* Filter query */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Lọc đường dẫn (ví dụ: /song/ để lọc bài hát)</label>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Nhập phần đường dẫn cần lọc..."
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-250 dark:border-slate-700 transition-colors"
              >
                {selectedUrls.size === filteredUrls.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả đã lọc'}
              </button>
            </div>
          </div>

          {/* Url table list */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner">
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-150 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/20 font-mono text-xs">
              {paginatedUrls.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleSelectUrl(item.url)}
                  className="flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedUrls.has(item.url)}
                    onChange={() => {}} // toggled by row click
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div className="flex-1 truncate text-slate-700 dark:text-slate-300">
                    {item.url}
                  </div>
                  {item.lastmod && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      {new Date(item.lastmod).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
              {paginatedUrls.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy URL nào khớp bộ lọc.
                </div>
              )}
            </div>
          </div>

          {/* Table list pagination footer */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Fields Selector Configurator */}
      {selectedUrls.size > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2 font-heading">
            <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">3</span>
            Cấu hình Selector trường dữ liệu
          </h3>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={index} className="flex flex-col md:flex-row items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(index, 'label', e.target.value)}
                  placeholder="Tên trường (vd: Tiêu đề)"
                  className="w-full md:w-1/4 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={field.selector}
                  onChange={(e) => updateField(index, 'selector', e.target.value)}
                  placeholder="CSS Selector (vd: h1, .entry-content)"
                  className="w-full md:flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-100"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(index, 'type', e.target.value)}
                  className="w-full md:w-36 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                >
                  <option value="text">Văn bản (Text)</option>
                  <option value="link">Đường dẫn (Href)</option>
                  <option value="image">Ảnh (Src)</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  disabled={fields.length === 1}
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm trường dữ liệu</span>
            </button>
          </div>

          {/* Settings Accordion */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Độ song song tối đa (Concurrency Limit): {concurrency}</label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Giới hạn số trình duyệt/tab chạy đồng thời để tối ưu hóa hiệu năng.</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Độ trễ giữa mỗi trang (Delay): {delayMs}ms</label>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="250"
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Đặt thời gian nghỉ giữa mỗi lượt cào để tránh bị chặn IP (anti-bot protection).</span>
              </div>
            </div>
          </div>

          {/* Play/Scraping Execution Buttons */}
          <div className="pt-4 flex gap-3">
            <button
              onClick={handleStartScrape}
              disabled={scraping}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-500/10"
            >
              {scraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang cào dữ liệu... {progress}%</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Bắt đầu cào hàng loạt</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Progress & Real-time Logs Console */}
      {(scraping || logs.length > 0) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 space-y-4 transition-all duration-300">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {scraping && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${scraping ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              </span>
              Nhật ký cào dữ liệu thời gian thực
            </h4>
            {progress > 0 && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Tiến trình: {progress}%
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {scraping && (
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Console logger display box */}
          <div className="bg-slate-950 text-slate-300 font-mono text-xs p-4 rounded-xl border border-slate-800 shadow-inner max-h-56 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-900 scroll-smooth">
            {logs.map((log, index) => {
              let color = 'text-slate-400';
              if (log.includes('❌')) color = 'text-red-400';
              else if (log.includes('⚠️')) color = 'text-yellow-400';
              else if (log.includes('[Thành công]')) color = 'text-emerald-400';
              else if (log.includes('[Hoàn thành]')) color = 'text-cyan-400 font-bold';
              else if (log.includes('[Khởi tạo]')) color = 'text-indigo-400';
              
              return (
                <div key={index} className={`${color} break-all whitespace-pre-wrap`}>
                  {log}
                </div>
              );
            })}
            <ScrollToBottom dependency={logs.length} />
          </div>
        </div>
      )}

      {/* Scraped Results Table & Export Panel */}
      {results && results.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 font-heading">
                Kết quả cào dữ liệu
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cào thành công {results.length} dòng dữ liệu.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất CSV (Excel)</span>
              </button>
              <button
                type="button"
                onClick={handleExportJSON}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-250 dark:border-slate-700 transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Xuất JSON</span>
              </button>
            </div>
          </div>

          {/* Results grid list preview */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner max-h-96 overflow-auto">
            <table className="w-full text-xs text-left border-collapse bg-slate-50/20 dark:bg-slate-950/20">
              <thead className="bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-800">#</th>
                  {Object.keys(results[0]).map((h, i) => (
                    <th key={i} className="p-3 border-r border-slate-200 dark:border-slate-800 truncate max-w-[200px]" title={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {results.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-500">
                      {idx + 1}
                    </td>
                    {Object.keys(results[0]).map((key, i) => {
                      const val = row[key];
                      const isUrl = String(val).startsWith('http');
                      return (
                        <td key={i} className="p-3 border-r border-slate-200 dark:border-slate-800 truncate max-w-[250px] text-slate-700 dark:text-slate-300" title={String(val)}>
                          {isUrl ? (
                            <a href={val} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 font-semibold">
                              <span>Link</span>
                            </a>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
