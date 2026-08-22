import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Plus, Trash2, Download, FileText, Table, List, FileJson, Sparkles, CheckCircle, XCircle, MousePointer, Eye, ExternalLink, ChevronLeft, ChevronRight, CornerDownRight } from 'lucide-react';
import { analyzePage, analyzePageStream, executeScrape, executeScrapeStream, scrapeSPASidebar, testSelector } from '../services/api';
import DriveUploadButton from './DriveUploadButton';

export default function DynamicScraper() {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [scrapeResults, setScrapeResults] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(null); // 'headings', 'articles', 'tables', 'items', or null
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [fields, setFields] = useState([
    { label: '', selector: '', type: 'text', contentSelector: '' }
  ]);
  const [spaMode, setSpaMode] = useState(false);
  const [spaLoading, setSpaLoading] = useState(false);
  const [spaConfig, setSpaConfig] = useState({
    listSelector: '[data-id]',
    idAttribute: 'data-id',
    sidebarSelector: '.sidebar_right',
    detailSelector: '.detail1',
    waitAfterClick: 800
  });

  // State mới cho các tính năng nâng cao
  const [testingIndex, setTestingIndex] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [resultsPage, setResultsPage] = useState(0);
  const resultsPerPage = 10;

  // Cấu hình cào nhiều cấp (Đệ quy)
  const [crawlMode, setCrawlMode] = useState('single'); // 'single' | 'multi' | 'id_loop'
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxLinks, setMaxLinks] = useState(20);
  const [urlFilter, setUrlFilter] = useState('');
  const [startId, setStartId] = useState(1);
  const [endId, setEndId] = useState(10);
  const [concurrency, setConcurrency] = useState(15);
  const [scrapeMethod, setScrapeMethod] = useState('http'); // 'http' | 'browser'
  const [delayMs, setDelayMs] = useState(0);
  const [loopPathExtension, setLoopPathExtension] = useState('');
  const [logs, setLogs] = useState([]);
  const [analysisLogs, setAnalysisLogs] = useState([]);
  const [visitedCount, setVisitedCount] = useState(0);

  // Auto-populate loop path extension for ID loop mode
  useEffect(() => {
    if (crawlMode === 'id_loop' && !loopPathExtension && url) {
      if (url.includes('chinhsachquandoi.gov.vn')) {
        setLoopPathExtension('/chi-tiet-liet-si.htm?id=');
      } else {
        setLoopPathExtension('/detail?id=');
      }
    }
  }, [crawlMode, url]);

  // Compute final loopUrlPattern dynamically
  const getLoopUrlPattern = () => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      const ext = loopPathExtension.trim();
      const cleanExt = ext.startsWith('/') || ext.startsWith('?') ? ext : '/' + ext;
      return `${urlObj.origin}${cleanExt}`;
    } catch (e) {
      return loopPathExtension;
    }
  };


  const pageTypeLabels = {
    'list': { label: 'Dạng danh sách', icon: List, color: 'blue' },
    'article': { label: 'Dạng bài viết', icon: FileText, color: 'green' },
    'table': { label: 'Dạng bảng', icon: Table, color: 'purple' },
    'unknown': { label: 'Không xác định', icon: XCircle, color: 'gray' }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Vui lòng nhập URL trước khi phân tích');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      setError('URL không hợp lệ. Vui lòng nhập URL đầy đủ (ví dụ: https://example.com)');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setScrapeResults(null);
    setAnalysisLogs([]);

    try {
      const data = await analyzePageStream(url, (log) => {
        setAnalysisLogs(prev => [...prev, log]);
      });
      
      if (data) {
        setAnalysisResult(data);
        // Auto-populate first field with first data region if available
        if (data.dataRegions && data.dataRegions.length > 0) {
          const firstRegion = data.dataRegions[0];
          setFields([{
            label: 'Dữ liệu 1',
            selector: firstRegion.selector,
            type: 'text'
          }]);
        }
      } else {
        setError('Không thể phân tích cấu trúc trang');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi phân tích trang');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTestSelector = async (index) => {
    const field = fields[index];
    if (!url.trim()) {
      setError('Vui lòng nhập URL ở Bước 1 trước khi chạy thử selector');
      return;
    }
    if (!field.selector.trim()) {
      setError(`Vui lòng nhập CSS Selector cho trường thứ ${index + 1}`);
      return;
    }

    setTestingIndex(index);
    setError(null);
    setTestResults(prev => ({ ...prev, [index]: null }));

    try {
      const response = await testSelector(url.trim(), field.selector.trim(), field.type);
      if (response.success && response.data) {
        setTestResults(prev => ({ ...prev, [index]: response.data }));
      } else {
        setTestResults(prev => ({ 
          ...prev, 
          [index]: { found: false, error: response.error || 'Không tìm thấy phần tử hoặc lỗi' } 
        }));
      }
    } catch (err) {
      setTestResults(prev => ({ 
        ...prev, 
        [index]: { found: false, error: err.message || 'Lỗi kết nối server' } 
      }));
    } finally {
      setTestingIndex(null);
    }
  };

  const addField = () => {
    setFields([...fields, { label: '', selector: '', type: 'text', contentSelector: '' }]);
  };

  const removeField = (index) => {
    if (fields.length > 1) {
      setFields(fields.filter((_, i) => i !== index));
    }
  };

  const updateField = (index, field, value) => {
    const updated = [...fields];
    updated[index][field] = value;
    setFields(updated);
  };

  const useDataRegion = (region) => {
    // Add new field with selected region
    const newFields = [...fields];
    const emptyIndex = newFields.findIndex(f => !f.label && !f.selector);
    
    if (emptyIndex >= 0) {
      newFields[emptyIndex] = {
        label: region.className ? region.className.split(' ')[0] : 'Dữ liệu',
        selector: region.selector,
        type: 'text',
        contentSelector: ''
      };
    } else {
      newFields.push({
        label: region.className ? region.className.split(' ')[0] : 'Dữ liệu',
        selector: region.selector,
        type: 'text',
        contentSelector: ''
      });
    }
    
    setFields(newFields);
  };

  const handleExecute = async () => {
    // Validate URL
    if (!url.trim()) {
      setError('Vui lòng nhập URL');
      return;
    }

    try {
      new URL(url);
    } catch (e) {
      setError('URL không hợp lệ');
      return;
    }

    // Validate fields
    const validFields = fields.filter(f => f.label.trim() && f.selector.trim());
    if (validFields.length === 0) {
      setError('Vui lòng nhập ít nhất một trường hợp lệ');
      return;
    }

    setScraping(true);
    setError(null);
    setScrapeResults(null);
    setLogs([]); // Reset logs
    setVisitedCount(0); // Reset visited pages count

    try {
      const data = await executeScrapeStream(
        crawlMode === 'id_loop' ? getLoopUrlPattern() : url,
        validFields,
        { crawlMode, maxDepth, maxLinks, urlFilter, startId, endId, concurrency, scrapeMethod, delayMs },
        (newLog) => {
          setLogs(prev => [...prev, newLog]);
          
          // Auto-parse visited count from log message
          const match = newLog.match(/trang \((\d+)\//i);
          if (match) {
            setVisitedCount(Number(match[1]));
          } else {
            const detailMatch = newLog.match(/Chi Tiết (\d+)\//i);
            if (detailMatch) {
              setVisitedCount(Number(detailMatch[1]));
            }
          }
        }
      );
      
      if (data && data.length > 0) {
        setScrapeResults(data);
        
        // Count actual unique URLs visited
        const uniqueUrls = new Set(data.filter(row => row && (row['Nguồn URL'] || row['URL'])).map(row => row['Nguồn URL'] || row['URL']));
        setVisitedCount(uniqueUrls.size > 0 ? uniqueUrls.size : 1);
      } else {
        setError('Không lấy được dữ liệu. Vui lòng kiểm tra lại CSS selector.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi lấy dữ liệu');
    } finally {
      setScraping(false);
    }
  };

  const handleSPASidebarRun = async () => {
    if (!url.trim()) {
      setError('Vui lòng nhập URL');
      return;
    }
    try {
      new URL(url);
    } catch (e) {
      setError('URL không hợp lệ');
      return;
    }
    setSpaLoading(true);
    setError(null);
    setScrapeResults(null);
    try {
      const response = await scrapeSPASidebar({
        url: url.trim(),
        listSelector: spaConfig.listSelector || '[data-id]',
        idAttribute: spaConfig.idAttribute || 'data-id',
        sidebarSelector: spaConfig.sidebarSelector || '.sidebar_right',
        detailSelector: spaConfig.detailSelector || '.detail1',
        waitAfterClick: Number(spaConfig.waitAfterClick) || 800
      });
      if (response.success) {
        setScrapeResults(response.data);
      } else {
        setError(response.error || 'Không thể lấy dữ liệu SPA');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi chạy SPA Sidebar');
    } finally {
      setSpaLoading(false);
    }
  };

  const handleExportJSON = () => {
    if (!scrapeResults || scrapeResults.length === 0) return;
    
    const dataStr = JSON.stringify(scrapeResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scraped-data-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!scrapeResults || scrapeResults.length === 0) return;

    // Get all unique keys from all rows
    const allKeys = new Set();
    scrapeResults.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    // Escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Create CSV content
    const csvRows = [
      headers.join(','),
      ...scrapeResults.map(row => 
        headers.map(header => escapeCSV(row[header] || '')).join(',')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for Excel UTF-8
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scraped-data-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const PageTypeIcon = analysisResult ? pageTypeLabels[analysisResult.pageType]?.icon || XCircle : null;
  const pageTypeInfo = analysisResult ? pageTypeLabels[analysisResult.pageType] : null;
  
  const getPageTypeStyles = () => {
    if (!pageTypeInfo) return 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-400';
    const colorMap = {
      blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400',
      green: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400',
      purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-400',
      gray: 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
    };
    return colorMap[pageTypeInfo.color] || colorMap.gray;
  };

  // Filter data regions based on selected filter
  const displayedRegions = analysisResult?.dataRegions 
    ? (selectedFilter 
        ? analysisResult.dataRegions.filter(region => region.category === selectedFilter)
        : analysisResult.dataRegions)
    : [];

  const filteredDataRegions = showAllRegions ? displayedRegions : displayedRegions.slice(0, 10);

  // Reconstruct tree and render parent-child nesting
  const renderDataRegionsTree = () => {
    if (!filteredDataRegions || filteredDataRegions.length === 0) return null;

    // Separate roots and children among the filtered items
    const roots = filteredDataRegions.filter(r => {
      return !r.parentIndex || !filteredDataRegions.some(p => p.index === r.parentIndex);
    });

    const childrenMap = {};
    filteredDataRegions.forEach(r => {
      if (r.parentIndex) {
        if (!childrenMap[r.parentIndex]) childrenMap[r.parentIndex] = [];
        childrenMap[r.parentIndex].push(r);
      }
    });

    const renderNode = (node, depthLevel = 0) => {
      const children = childrenMap[node.index] || [];
      const parentNode = node.parentIndex ? filteredDataRegions.find(p => p.index === node.parentIndex) : null;
      
      return (
        <div key={node.index} className="w-full">
          {/* Node Button */}
          <div className="flex items-start w-full relative">
            {depthLevel > 0 && (
              <div 
                className="absolute border-l-2 border-dashed border-slate-300 dark:border-slate-700/80" 
                style={{ 
                  left: `${(depthLevel - 1) * 24 + 12}px`,
                  top: '-12px',
                  bottom: children.length > 0 ? '0px' : '22px'
                }} 
              />
            )}
            
            <button
              type="button"
              onClick={() => useDataRegion(node)}
              className="flex-grow text-left p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-850 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all duration-200 group flex items-start justify-between gap-3 mb-2 shadow-sm"
              style={{ marginLeft: `${depthLevel * 24}px` }}
            >
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  {depthLevel > 0 && (
                    <CornerDownRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  )}
                  <span className="font-mono text-sm text-blue-700 dark:text-blue-400 font-bold truncate max-w-[280px]" title={node.selector}>
                    {node.selector}
                  </span>
                  {depthLevel > 0 && parentNode && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal shrink-0">
                      (con của {parentNode.selector})
                    </span>
                  )}
                </div>
                
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-semibold flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-800/60 rounded font-normal capitalize">
                    Thẻ: {node.type}
                  </span>
                  <span>•</span>
                  <span>{node.textLength} ký tự</span>
                </div>
                
                {node.sampleText && (
                  <div className="text-xs text-slate-600 dark:text-slate-500 truncate group-hover:text-slate-900 dark:group-hover:text-slate-300 italic font-normal pl-2 border-l-2 border-slate-200 dark:border-slate-800 max-w-full">
                    "{node.sampleText}"
                  </div>
                )}
              </div>

              {node.category && (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-400 rounded-full shrink-0 uppercase tracking-wider">
                  {node.category === 'headings' ? 'H' : node.category === 'articles' ? 'A' : node.category === 'tables' ? 'T' : 'I'}
                </span>
              )}
            </button>
          </div>

          {/* Children container */}
          {children.length > 0 && (
            <div className="w-full">
              {children.map(child => renderNode(child, depthLevel + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-1 w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-250 dark:border-slate-800/60 p-4 rounded-2xl shadow-inner max-h-[500px] overflow-y-auto">
        {roots.map(root => renderNode(root, 0))}
      </div>
    );
  };

  // Get filter button styles
  const getFilterButtonStyles = (filterType) => {
    const isSelected = selectedFilter === filterType;
    const baseStyles = 'p-3 rounded-lg transition-all cursor-pointer hover:shadow-md';
    
    if (isSelected) {
      return `${baseStyles} bg-blue-100 border-2 border-blue-500 shadow-md`;
    }
    return `${baseStyles} bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300">
        <h2 className="text-2xl font-black text-slate-950 dark:text-slate-50 mb-2 font-heading">
          Dynamic Scraper - Lấy Dữ Liệu Linh Hoạt
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Phân tích trang web và lấy dữ liệu theo cấu hình tùy chỉnh
        </p>
      </div>

      {/* Bước 1: Phân tích trang */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2 font-heading">
          <span className="bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">1</span>
          Phân tích trang (Analysis Phase)
        </h3>
        
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            URL trang web
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-800 dark:text-slate-100"
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold transition-all duration-200 shadow-sm"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Phân tích trang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Chế độ SPA: click từng item, lấy nội dung sidebar */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setSpaMode(!spaMode)}
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-semibold"
          >
            <MousePointer className="w-4 h-4" />
            <span>Trang dạng SPA (click từng item, lấy nội dung sidebar)</span>
          </button>
          {spaMode && (
            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-900/30 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Tìm các phần tử theo selector → click từng phần tử → đợi sidebar cập nhật → lấy nội dung từ sidebar. Dùng <strong>data-id</strong> (hoặc attribute tùy chọn) làm khóa để tránh trùng.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Selector list item (vd: [data-id], .list-item)</label>
                  <input
                    type="text"
                    value={spaConfig.listSelector}
                    onChange={(e) => setSpaConfig(c => ({ ...c, listSelector: e.target.value }))}
                    placeholder="[data-id]"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Attribute khóa (vd: data-id)</label>
                  <input
                    type="text"
                    value={spaConfig.idAttribute}
                    onChange={(e) => setSpaConfig(c => ({ ...c, idAttribute: e.target.value }))}
                    placeholder="data-id"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Selector sidebar</label>
                  <input
                    type="text"
                    value={spaConfig.sidebarSelector}
                    onChange={(e) => setSpaConfig(c => ({ ...c, sidebarSelector: e.target.value }))}
                    placeholder=".sidebar_right"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Selector nội dung trong sidebar (vd: .detail1)</label>
                  <input
                    type="text"
                    value={spaConfig.detailSelector}
                    onChange={(e) => setSpaConfig(c => ({ ...c, detailSelector: e.target.value }))}
                    placeholder=".detail1"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Đợi sau mỗi click (ms)</label>
                  <input
                    type="number"
                    min={300}
                    max={3000}
                    value={spaConfig.waitAfterClick}
                    onChange={(e) => setSpaConfig(c => ({ ...c, waitAfterClick: Number(e.target.value) || 800 }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <button
                onClick={handleSPASidebarRun}
                disabled={spaLoading || !url.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2 text-sm font-semibold transition-colors"
              >
                {spaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MousePointer className="w-4 h-4" />}
                <span>{spaLoading ? 'Đang click và lấy dữ liệu...' : 'Chạy SPA Sidebar'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Real-time Analysis Console */}
        {(analyzing || analysisLogs.length > 0) && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {analyzing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${analyzing ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                </span>
                Tiến trình phân tích thời gian thực
              </span>
              
              <div className="flex items-center gap-2 text-xs">
                {analyzing ? (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                    Đang phân tích cấu trúc...
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Đã phân tích xong
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setAnalysisLogs([])}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  Xóa Logs
                </button>
              </div>
            </div>

            {/* Console Box */}
            <div className="bg-slate-950 text-slate-250 font-mono text-xs p-4 rounded-xl border border-slate-800 shadow-inner max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-900 scroll-smooth">
              {analysisLogs.map((log, index) => {
                let colorClass = "text-slate-350";
                if (log.includes("❌")) colorClass = "text-red-400 font-semibold";
                else if (log.includes("⚠️")) colorClass = "text-amber-400";
                else if (log.includes("[Hoàn thành]")) colorClass = "text-emerald-400 font-semibold";
                else if (log.includes("[Tải trang]")) colorClass = "text-indigo-300";
                else if (log.includes("[Khởi tạo]")) colorClass = "text-cyan-400";
                else if (log.includes("[Trình duyệt]")) colorClass = "text-teal-400";
                else if (log.includes("[Phân tích DOM]")) colorClass = "text-blue-400 font-semibold";
                
                return (
                  <div key={index} className={`${colorClass} break-all whitespace-pre-wrap leading-relaxed`}>
                    {log}
                  </div>
                );
              })}
              <ScrollToBottom dependency={analysisLogs.length} />
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <div className="mt-6 space-y-4">
            {/* Page Type */}
            <div className={`p-4 rounded-lg border-2 ${getPageTypeStyles()}`}>
              <div className="flex items-center gap-3">
                {PageTypeIcon && <PageTypeIcon className={`w-6 h-6 ${pageTypeInfo?.color === 'blue' ? 'text-blue-600' : pageTypeInfo?.color === 'green' ? 'text-green-600' : pageTypeInfo?.color === 'purple' ? 'text-purple-600' : 'text-slate-600 dark:text-slate-400'}`} />}
                <div>
                  <div className="font-semibold text-slate-850 dark:text-slate-200">
                    Loại trang: {pageTypeLabels[analysisResult.pageType]?.label || 'Không xác định'}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Độ tin cậy: {analysisResult.confidence}%
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Headings</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-50">{analysisResult.statistics.headings}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Articles</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-50">{analysisResult.statistics.articles}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Tables</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-50">{analysisResult.statistics.tables}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Items/Profiles</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-50">{analysisResult.statistics.items + analysisResult.statistics.profiles}</div>
              </div>
            </div>

            {/* Data Regions - Filtered */}
            {filteredDataRegions.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Vùng dữ liệu tiềm năng
                    {selectedFilter && (
                      <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">
                        (Đã lọc theo {selectedFilter === 'headings' ? 'Headings' : selectedFilter === 'articles' ? 'Articles' : selectedFilter === 'tables' ? 'Tables' : 'Items/Profiles'})
                      </span>
                    )}
                    {selectedFilter && (
                      <button
                        onClick={() => setSelectedFilter(null)}
                        className="ml-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Hiển thị {filteredDataRegions.length} / {displayedRegions.length} vùng {displayedRegions.length !== analysisResult.dataRegions.length && `(tổng số ${analysisResult.dataRegions.length})`}
                    </span>
                    {displayedRegions.length > 10 && (
                      <button
                        type="button"
                        onClick={() => setShowAllRegions(!showAllRegions)}
                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg font-bold border border-blue-200 dark:border-blue-800/60 shadow-sm transition-all duration-200 cursor-pointer shrink-0"
                      >
                        {showAllRegions ? 'Thu gọn' : 'Hiện tất cả'}
                      </button>
                    )}
                  </div>
                </div>
                {renderDataRegionsTree()}
              </div>
            )}
            {selectedFilter && filteredDataRegions.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>Không tìm thấy vùng dữ liệu nào thuộc loại "{selectedFilter === 'headings' ? 'Headings' : selectedFilter === 'articles' ? 'Articles' : selectedFilter === 'tables' ? 'Tables' : 'Items/Profiles'}"</p>
                <button
                  onClick={() => setSelectedFilter(null)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Xóa bộ lọc để xem tất cả
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bước 2: Cấu hình trường dữ liệu */}
      {analysisResult && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span className="bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">2</span>
            Cấu hình trường dữ liệu (UI Phase)
          </h3>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={index} className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700/50 space-y-3 transition-colors duration-200">
                <div className="flex gap-3 items-center">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(index, 'label', e.target.value)}
                      placeholder="Tên dữ liệu (ví dụ: Họ tên)"
                      className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={field.selector}
                      onChange={(e) => updateField(index, 'selector', e.target.value)}
                      placeholder="CSS Selector (vd: .thumb-art)"
                      className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-slate-800 dark:text-slate-100"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, 'type', e.target.value)}
                      className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-800 dark:text-slate-100"
                    >
                      <option value="text">Text (Văn bản)</option>
                      <option value="link">Link (Đường dẫn)</option>
                      <option value="image">Ảnh (src)</option>
                      <option value="api">API Data (JSON)</option>
                      <option value="click_content">Click link → Nội dung trang chi tiết</option>
                    </select>
                  </div>
                  
                  {/* Actions for field */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTestSelector(index)}
                      disabled={testingIndex !== null || scraping}
                      title="Chạy thử selector này"
                      className="p-2.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors border border-transparent disabled:opacity-50"
                    >
                      {testingIndex === index ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      disabled={fields.length === 1}
                      className="p-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* CSS Selector for click_content */}
                {field.type === 'click_content' && (
                  <div className="grid grid-cols-1 gap-2 pt-2.5 border-t border-slate-200/60 dark:border-slate-750/60 animate-fadeIn">
                    <label className="block text-xs font-bold text-slate-750 dark:text-slate-350">
                      CSS Selector trích xuất chi tiết (ví dụ: <code className="bg-slate-150 px-1 dark:bg-slate-800 rounded">div.lietsi_container</code>)
                    </label>
                    <input
                      type="text"
                      value={field.contentSelector || ''}
                      onChange={(e) => updateField(index, 'contentSelector', e.target.value)}
                      placeholder="Mặc định sẽ lấy toàn bộ nội dung text của trang. Nhập selector để lọc riêng (vd: div.lietsi_container)"
                      className="px-4 py-2 bg-white dark:bg-slate-905 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs text-slate-800 dark:text-slate-100 w-full"
                    />
                  </div>
                )}

                {/* Quick Test Result Banner */}
                {testResults[index] && (
                  <div className={`text-xs p-3 rounded-lg border flex flex-col gap-1 transition-all duration-300 ${
                    testResults[index].found 
                      ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-rose-50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-800/30 text-rose-800 dark:text-rose-300'
                  }`}>
                    <div className="font-semibold flex items-center gap-1">
                      {testResults[index].found ? '✓ Kết quả chạy thử:' : '✗ Lỗi chạy thử:'}
                    </div>
                    <div className="font-mono break-all line-clamp-2 max-w-full">
                      {testResults[index].found ? testResults[index].value : (testResults[index].error || 'Không tìm thấy dữ liệu')}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addField}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm trường</span>
          </button>
        </div>
      )}

      {/* Bước 3: Thực thi */}
      {analysisResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2 font-heading">
            <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">3</span>
            Thực thi lấy dữ liệu (Execution Phase)
          </h3>

          {/* Cấu hình cào nhiều cấp (Đệ quy) */}
          <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Cấu hình cấp độ cào (Crawl Depth Options)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chế độ cào */}
              <div className="col-span-full">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Chế độ cào</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => { setCrawlMode('single'); setMaxDepth(1); }}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                      crawlMode === 'single'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-950 border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-150'
                    }`}
                  >
                    1 cấp (Trang hiện tại)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCrawlMode('multi'); if (maxDepth === 1) setMaxDepth(3); }}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                      crawlMode === 'multi'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-950 border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-150'
                    }`}
                  >
                    Nhiều cấp (Đệ quy)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCrawlMode('id_loop'); }}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                      crawlMode === 'id_loop'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-950 border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-150'
                    }`}
                  >
                    Vòng lặp ID (Detail ID Loop)
                  </button>
                </div>
              </div>

              {/* Số cấp tối đa (Level Depth) */}
              {crawlMode === 'multi' && (
                <div className="space-y-1 col-span-full md:col-span-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>Số cấp tối đa (Độ sâu)</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{maxDepth} cấp</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>2 cấp</span>
                    <span>10 cấp</span>
                  </div>
                </div>
              )}
            </div>

            {crawlMode === 'id_loop' && (
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 transition-all duration-350 animate-fadeIn">
                {/* URL mẫu vòng lặp */}
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-750 dark:text-slate-350 mb-1.5">
                    Đường dẫn trang chi tiết vòng lặp ID (Detail Path & Parameter)
                  </label>
                  
                  <div className="flex items-stretch rounded-lg overflow-hidden border border-gray-300 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                    {/* Prefix: Domain Origin */}
                    <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-2 text-sm font-mono flex items-center border-r border-gray-300 dark:border-slate-700 select-none shrink-0 font-medium">
                      {(() => {
                        try {
                          return new URL(url).origin;
                        } catch (e) {
                          return 'http://domain.com';
                        }
                      })()}
                    </div>
                    
                    {/* Path input */}
                    <input
                      type="text"
                      value={loopPathExtension}
                      onChange={(e) => setLoopPathExtension(e.target.value)}
                      className="flex-grow px-3 py-2 bg-white dark:bg-slate-950 text-sm text-slate-850 dark:text-slate-100 font-mono focus:outline-none"
                      placeholder="vd: /chi-tiet-liet-si.htm?id="
                    />
                  </div>
                  
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    * Hệ thống sẽ tự động trích xuất Tên miền gốc ở Bước 1 và ghép với Đường dẫn này để tạo URL cào đầy đủ.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full">
                  {/* ID bắt đầu */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">ID bắt đầu (Start ID)</label>
                    <input
                      type="number"
                      min={1}
                      value={startId}
                      onChange={(e) => setStartId(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                      placeholder="1"
                    />
                  </div>

                  {/* ID kết thúc */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">ID kết thúc (End ID)</label>
                    <input
                      type="number"
                      min={startId}
                      value={endId}
                      onChange={(e) => setEndId(Math.max(startId, Number(e.target.value) || startId))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 col-span-full pt-4 border-t border-slate-250 dark:border-slate-800/60">
                  {/* Phương thức cào */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Phương thức cào</label>
                    <select
                      value={scrapeMethod}
                      onChange={(e) => {
                        const val = e.target.value;
                        setScrapeMethod(val);
                        if (val === 'http') {
                          setConcurrency(15);
                        } else {
                          setConcurrency(3);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    >
                      <option value="http">HTTP siêu tốc (Cheerio)</option>
                      <option value="browser">Trình duyệt (Puppeteer)</option>
                    </select>
                  </div>

                  {/* Số luồng đồng thời */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Số luồng đồng thời: <span className="font-bold text-blue-600 dark:text-blue-400">{concurrency}</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={scrapeMethod === 'http' ? 100 : 15}
                      value={concurrency}
                      onChange={(e) => setConcurrency(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    />
                  </div>

                  {/* Độ trễ */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Độ trễ request (ms)</label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={delayMs}
                      onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="col-span-full">
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                    * Ghi chú: Chế độ này sẽ lần lượt tải các trang chi tiết bằng cách ghép ID từ <strong>{startId}</strong> đến <strong>{endId}</strong> vào cuối URL mẫu (ví dụ: <code className="text-blue-600 dark:text-blue-400 font-semibold">{getLoopUrlPattern()}{startId}</code>).
                  </p>
                </div>
              </div>
            )}

            {crawlMode === 'multi' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                {/* Giới hạn tổng số trang */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Giới hạn tổng số trang cào tối đa</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={maxLinks}
                    onChange={(e) => setMaxLinks(Math.min(100, Math.max(1, Number(e.target.value) || 20)))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    placeholder="20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Tránh cào quá nhiều gây tốn tài nguyên hoặc bị khóa IP (tối đa 100 trang).</p>
                </div>

                {/* Bộ lọc liên kết */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Bộ lọc liên kết (URL Filter Keyword)</label>
                  <input
                    type="text"
                    value={urlFilter}
                    onChange={(e) => setUrlFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="vd: /nhan-su/ hoặc /tin-tuc/"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Chỉ đi tiếp vào các liên kết có chứa từ khóa này. Để trống để đi tiếp vào tất cả liên kết cùng tên miền.</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExecute}
            disabled={scraping || fields.filter(f => f.label.trim() && f.selector.trim()).length === 0}
            className="w-full px-6 py-3.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold transition-all duration-200 shadow-md shadow-purple-500/10 hover:shadow-purple-500/20"
          >
            {scraping ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang lấy dữ liệu...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Bắt đầu lấy dữ liệu</span>
              </>
            )}
          </button>

          {/* Real-time Progress Console */}
          {(logs.length > 0 || scraping) && (
            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    {scraping && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${scraping ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                  </span>
                  Hộp thoại Tiến độ Thời gian thực
                </span>
                
                <div className="flex items-center gap-2 text-xs">
                  {scraping ? (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                      Đang xử lý ({visitedCount} trang đã duyệt)...
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Hoàn thành ({visitedCount} trang đã duyệt)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    Xóa Logs
                  </button>
                </div>
              </div>

              {/* Console Box */}
              <div className="bg-slate-950 text-slate-250 font-mono text-xs p-4 rounded-xl border border-slate-800 shadow-inner max-h-60 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-900 scroll-smooth">
                {logs.map((log, index) => {
                  let colorClass = "text-slate-350";
                  if (log.includes("❌")) colorClass = "text-red-400 font-semibold";
                  else if (log.includes("⚠️")) colorClass = "text-amber-400";
                  else if (log.includes("↳")) colorClass = "text-slate-400 pl-4";
                  else if (log.includes("[Hoàn thành]")) colorClass = "text-emerald-400 font-semibold";
                  else if (log.includes("[Cào Đệ Quy") || log.includes("[Cào Chi Tiết")) colorClass = "text-indigo-300 font-semibold";
                  else if (log.includes("[Khởi tạo]")) colorClass = "text-cyan-400";
                  
                  return (
                    <div key={index} className={`${colorClass} break-all whitespace-pre-wrap leading-relaxed`}>
                      {log}
                    </div>
                  );
                })}
                <ScrollToBottom dependency={logs.length} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {scrapeResults && scrapeResults.length > 0 && (() => {
        const filtered = scrapeResults.filter(row => {
          return Object.values(row).some(val => 
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
          );
        });
        
        const totalPages = Math.ceil(filtered.length / resultsPerPage);
        const startIndex = resultsPage * resultsPerPage;
        const paginated = filtered.slice(startIndex, startIndex + resultsPerPage);

        const isImage = (val) => {
          if (!val || typeof val !== 'string') return false;
          return val.startsWith('http') && (
            val.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || 
            val.includes('data:image') || 
            val.includes('images?')
          );
        };

        const isLink = (val) => {
          if (!val || typeof val !== 'string') return false;
          return val.startsWith('http') && !isImage(val);
        };

        return (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-md p-6 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-heading">
                  Kết quả dữ liệu cào
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Đã duyệt <span className="font-bold text-blue-650 dark:text-blue-400">{visitedCount} trang web</span> • Đang hiển thị {filtered.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + resultsPerPage, filtered.length)} trên tổng số <span className="font-bold text-purple-650 dark:text-purple-400">{filtered.length} dòng dữ liệu</span> trích xuất được
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative flex-1 md:flex-initial min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setResultsPage(0); // Reset to first page
                    }}
                    placeholder="Tìm kiếm kết quả..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleExportJSON}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <FileJson className="w-4 h-4" />
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                  <DriveUploadButton
                    fileName={`scraped_data_${Date.now()}`}
                    getData={() => {
                      if (!scrapeResults || scrapeResults.length === 0) return '';
                      const allKeys = new Set();
                      scrapeResults.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
                      const headers = Array.from(allKeys);
                      const escapeCSV = (value) => {
                        if (value === null || value === undefined) return '';
                        const str = String(value);
                        return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
                      };
                      return '\uFEFF' + [headers.join(','), ...scrapeResults.map(row => headers.map(header => escapeCSV(row[header] || '')).join(','))].join('\n');
                    }}
                    mimeType="text/csv"
                    className="px-4 py-2 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-800/80">
                  <tr>
                    {Object.keys(scrapeResults[0]).map((header, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 last:border-r-0"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {paginated.length > 0 ? (
                    paginated.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        {Object.keys(scrapeResults[0]).map((header, colIdx) => {
                          const val = row[header];
                          return (
                            <td
                              key={colIdx}
                              className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 border-r border-gray-150 dark:border-slate-800 last:border-r-0 max-w-xs break-words font-normal"
                            >
                              {val === 'N/A' || val === null || val === undefined ? (
                                <span className="text-slate-400 dark:text-slate-500 italic">N/A</span>
                              ) : isImage(val) ? (
                                <div className="relative group w-12 h-12">
                                  <img 
                                    src={val} 
                                    alt="scraped" 
                                    className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-slate-700 group-hover:scale-150 group-hover:shadow-lg transition-all duration-200 cursor-zoom-in relative z-0 group-hover:z-50"
                                    onClick={() => window.open(val, '_blank')}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                </div>
                              ) : isLink(val) ? (
                                <a 
                                  href={val} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 max-w-full"
                                >
                                  <span className="truncate max-w-[200px]" title={val}>{val}</span>
                                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                </a>
                              ) : (
                                <div className="line-clamp-3 whitespace-pre-wrap leading-relaxed">{String(val)}</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td 
                        colSpan={Object.keys(scrapeResults[0]).length} 
                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400 italic"
                      >
                        Không tìm thấy dòng nào khớp với từ khóa tìm kiếm
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-150 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Trang {resultsPage + 1} / {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setResultsPage(p => Math.max(0, p - 1))}
                    disabled={resultsPage === 0}
                    className="p-1.5 rounded-lg border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    // Show only around current page if there are too many pages
                    if (idx === 0 || idx === totalPages - 1 || Math.abs(idx - resultsPage) <= 1) {
                      return (
                        <button
                          key={idx}
                          onClick={() => setResultsPage(idx)}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                            resultsPage === idx 
                              ? 'bg-blue-600 text-white' 
                              : 'border border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    }
                    if (idx === 1 && resultsPage > 2) {
                      return <span key={idx} className="text-gray-400 text-xs px-1">...</span>;
                    }
                    if (idx === totalPages - 2 && resultsPage < totalPages - 3) {
                      return <span key={idx} className="text-gray-400 text-xs px-1">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => setResultsPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={resultsPage === totalPages - 1}
                    className="p-1.5 rounded-lg border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function ScrollToBottom({ dependency }) {
  const elementRef = useRef(null);
  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dependency]);
  return <div ref={elementRef} />;
}
