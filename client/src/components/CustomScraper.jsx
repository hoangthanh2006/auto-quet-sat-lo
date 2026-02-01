import { useState } from 'react';
import { Plus, Trash2, Search, Loader2, Sparkles, Download, X } from 'lucide-react';
import { scrapeCustom, previewStructure } from '../services/api';

export default function CustomScraper() {
  const [url, setUrl] = useState('');
  const [selectors, setSelectors] = useState([
    { label: '', selector: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addSelector = () => {
    setSelectors([...selectors, { label: '', selector: '' }]);
  };

  const removeSelector = (index) => {
    if (selectors.length > 1) {
      setSelectors(selectors.filter((_, i) => i !== index));
    }
  };

  const updateSelector = (index, field, value) => {
    const updated = [...selectors];
    updated[index][field] = value;
    setSelectors(updated);
  };

  const handlePreview = async () => {
    if (!url.trim()) {
      setError('Vui lòng nhập URL trước khi xem gợi ý');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      setError('URL không hợp lệ. Vui lòng nhập URL đầy đủ (ví dụ: https://example.com)');
      return;
    }

    setPreviewing(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await previewStructure(url);
      if (response.success && response.data) {
        setSuggestions(response.data);
        setShowSuggestions(true);
      }
    } catch (err) {
      setError(err.message || 'Không thể phân tích cấu trúc trang');
    } finally {
      setPreviewing(false);
    }
  };

  const useSuggestion = (className) => {
    // Add new selector with suggested class
    const newSelectors = [...selectors];
    const emptyIndex = newSelectors.findIndex(s => !s.label && !s.selector);
    
    if (emptyIndex >= 0) {
      newSelectors[emptyIndex] = {
        label: className.replace(/\./g, '').replace(/\s+/g, ' ').trim() || 'Dữ liệu',
        selector: className
      };
    } else {
      newSelectors.push({
        label: className.replace(/\./g, '').replace(/\s+/g, ' ').trim() || 'Dữ liệu',
        selector: className
      });
    }
    
    setSelectors(newSelectors);
    setShowSuggestions(false);
  };

  const handleScrape = async () => {
    // Validate URL
    if (!url.trim()) {
      setError('Vui lòng nhập URL');
      return;
    }

    try {
      new URL(url);
    } catch (e) {
      setError('URL không hợp lệ. Vui lòng nhập URL đầy đủ (ví dụ: https://example.com)');
      return;
    }

    // Validate selectors
    const validSelectors = selectors.filter(s => s.label.trim() && s.selector.trim());
    if (validSelectors.length === 0) {
      setError('Vui lòng nhập ít nhất một selector hợp lệ (có cả Tên dữ liệu và CSS Selector)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await scrapeCustom(url, validSelectors);
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Không thể lấy dữ liệu');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi lấy dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    
    const dataStr = JSON.stringify(result, null, 2);
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Lấy Dữ Liệu Theo Class Động</h2>
        
        {/* URL Input */}
        <div className="mb-6">
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
              onClick={handlePreview}
              disabled={previewing || !url.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {previewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Gợi ý Class</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-purple-900">Gợi ý Class (Top {suggestions.length})</h3>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-purple-600 hover:text-purple-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => useSuggestion(`.${suggestion.class}`)}
                  className="text-left p-3 bg-white rounded border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors"
                >
                  <div className="font-mono text-sm text-purple-700 mb-1">
                    .{suggestion.class}
                  </div>
                  <div className="text-xs text-gray-600">
                    {suggestion.textLength} ký tự • {suggestion.count} phần tử
                  </div>
                  {suggestion.sampleText && (
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {suggestion.sampleText}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selectors List */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Danh sách Selectors
            </label>
            <button
              onClick={addSelector}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm trường</span>
            </button>
          </div>
          
          <div className="space-y-3">
            {selectors.map((selector, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={selector.label}
                    onChange={(e) => updateSelector(index, 'label', e.target.value)}
                    placeholder="Tên dữ liệu (ví dụ: Tiểu sử)"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={selector.selector}
                    onChange={(e) => updateSelector(index, 'selector', e.target.value)}
                    placeholder="CSS Selector (ví dụ: .detail-info)"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <button
                  onClick={() => removeSelector(index)}
                  disabled={selectors.length === 1}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Scrape Button */}
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim()}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
        >
          {loading ? (
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

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Kết quả</h3>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON</span>
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          {/* Formatted Results */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(result).map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">{label}</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {value === 'N/A' ? (
                    <span className="text-gray-400 italic">Không tìm thấy</span>
                  ) : (
                    value
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
