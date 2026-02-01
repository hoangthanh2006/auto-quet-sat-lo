import { useState } from 'react';
import { Search, Loader2, Plus, Trash2, Download, FileText, Table, List, FileJson, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { analyzePage, executeScrape } from '../services/api';

export default function DynamicScraper() {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [scrapeResults, setScrapeResults] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(null); // 'headings', 'articles', 'tables', 'items', or null
  const [fields, setFields] = useState([
    { label: '', selector: '', type: 'text' }
  ]);

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

    try {
      const response = await analyzePage(url);
      if (response.success) {
        setAnalysisResult(response.data);
        // Auto-populate first field with first data region if available
        if (response.data.dataRegions && response.data.dataRegions.length > 0) {
          const firstRegion = response.data.dataRegions[0];
          setFields([{
            label: 'Dữ liệu 1',
            selector: firstRegion.selector,
            type: 'text'
          }]);
        }
      } else {
        setError(response.error || 'Không thể phân tích trang');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi phân tích trang');
    } finally {
      setAnalyzing(false);
    }
  };

  const addField = () => {
    setFields([...fields, { label: '', selector: '', type: 'text' }]);
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
        type: 'text'
      };
    } else {
      newFields.push({
        label: region.className ? region.className.split(' ')[0] : 'Dữ liệu',
        selector: region.selector,
        type: 'text'
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

    try {
      const response = await executeScrape(url, validFields);
      if (response.success) {
        setScrapeResults(response.data);
      } else {
        setError(response.error || 'Không thể lấy dữ liệu');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi lấy dữ liệu');
    } finally {
      setScraping(false);
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
    if (!pageTypeInfo) return 'bg-gray-50 border-gray-200 text-gray-600';
    const colorMap = {
      blue: 'bg-blue-50 border-blue-200 text-blue-600',
      green: 'bg-green-50 border-green-200 text-green-600',
      purple: 'bg-purple-50 border-purple-200 text-purple-600',
      gray: 'bg-gray-50 border-gray-200 text-gray-600'
    };
    return colorMap[pageTypeInfo.color] || colorMap.gray;
  };

  // Filter data regions based on selected filter
  const filteredDataRegions = analysisResult?.dataRegions 
    ? (selectedFilter 
        ? analysisResult.dataRegions.filter(region => region.category === selectedFilter)
        : analysisResult.dataRegions)
    : [];

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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dynamic Scraper - Lấy Dữ Liệu Linh Hoạt</h2>
        <p className="text-gray-600 text-sm">
          Phân tích trang web và lấy dữ liệu theo cấu hình tùy chỉnh
        </p>
      </div>

      {/* Bước 1: Phân tích trang */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">1</span>
          Phân tích trang (Analysis Phase)
        </h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL trang web
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
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

        {/* Analysis Results */}
        {analysisResult && (
          <div className="mt-6 space-y-4">
            {/* Page Type */}
            <div className={`p-4 rounded-lg border-2 ${getPageTypeStyles()}`}>
              <div className="flex items-center gap-3">
                {PageTypeIcon && <PageTypeIcon className={`w-6 h-6 ${pageTypeInfo?.color === 'blue' ? 'text-blue-600' : pageTypeInfo?.color === 'green' ? 'text-green-600' : pageTypeInfo?.color === 'purple' ? 'text-purple-600' : 'text-gray-600'}`} />}
                <div>
                  <div className="font-semibold text-gray-800">
                    Loại trang: {pageTypeLabels[analysisResult.pageType]?.label || 'Không xác định'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Độ tin cậy: {analysisResult.confidence}%
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">Headings</div>
                <div className="text-lg font-semibold">{analysisResult.statistics.headings}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">Articles</div>
                <div className="text-lg font-semibold">{analysisResult.statistics.articles}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">Tables</div>
                <div className="text-lg font-semibold">{analysisResult.statistics.tables}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">Items/Profiles</div>
                <div className="text-lg font-semibold">{analysisResult.statistics.items + analysisResult.statistics.profiles}</div>
              </div>
            </div>

            {/* Data Regions - Filtered */}
            {filteredDataRegions.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-700">
                    Vùng dữ liệu tiềm năng
                    {selectedFilter && (
                      <span className="ml-2 text-sm font-normal text-blue-600">
                        (Đã lọc theo {selectedFilter === 'headings' ? 'Headings' : selectedFilter === 'articles' ? 'Articles' : selectedFilter === 'tables' ? 'Tables' : 'Items/Profiles'})
                      </span>
                    )}
                    {selectedFilter && (
                      <button
                        onClick={() => setSelectedFilter(null)}
                        className="ml-2 text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </h4>
                  <div className="text-sm text-gray-500">
                    Hiển thị {filteredDataRegions.length} / {analysisResult.dataRegions.length} vùng
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredDataRegions.map((region, idx) => (
                    <button
                      key={idx}
                      onClick={() => useDataRegion(region)}
                      className="text-left p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-mono text-sm text-blue-700">
                          {region.selector}
                        </div>
                        {region.category && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {region.category === 'headings' ? 'H' : region.category === 'articles' ? 'A' : region.category === 'tables' ? 'T' : 'I'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        {region.type} • {region.textLength} ký tự
                      </div>
                      {region.sampleText && (
                        <div className="text-xs text-gray-500 truncate">
                          {region.sampleText}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedFilter && filteredDataRegions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">2</span>
            Cấu hình trường dữ liệu (UI Phase)
          </h3>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={index} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(index, 'label', e.target.value)}
                    placeholder="Tên dữ liệu (ví dụ: Họ tên)"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={field.selector}
                    onChange={(e) => updateField(index, 'selector', e.target.value)}
                    placeholder="CSS Selector (ví dụ: .name)"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(index, 'type', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="text">Text</option>
                    <option value="link">Link (href)</option>
                    <option value="image">Ảnh (src)</option>
                    <option value="api">API Data</option>
                  </select>
                </div>
                <button
                  onClick={() => removeField(index)}
                  disabled={fields.length === 1}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addField}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm trường</span>
          </button>
        </div>
      )}

      {/* Bước 3: Thực thi */}
      {analysisResult && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">3</span>
            Thực thi lấy dữ liệu (Execution Phase)
          </h3>

          <button
            onClick={handleExecute}
            disabled={scraping || fields.filter(f => f.label.trim() && f.selector.trim()).length === 0}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
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
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {scrapeResults && scrapeResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Kết quả ({scrapeResults.length} dòng)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <FileJson className="w-4 h-4" />
                <span>Export JSON</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(scrapeResults[0]).map((header, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 last:border-r-0"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scrapeResults.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50">
                    {Object.keys(scrapeResults[0]).map((header, colIdx) => (
                      <td
                        key={colIdx}
                        className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200 last:border-r-0 whitespace-pre-wrap break-words max-w-xs"
                      >
                        {row[header] === 'N/A' ? (
                          <span className="text-gray-400 italic">N/A</span>
                        ) : (
                          row[header]
                        )}
                      </td>
                    ))}
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
