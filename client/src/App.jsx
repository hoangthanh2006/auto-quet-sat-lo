import { useState } from 'react';
import { Search, Download, Loader2, ExternalLink, FileText, CheckSquare, Square } from 'lucide-react';
import { scanLinks, extractContent } from './services/api';

function App() {
  const [links, setLinks] = useState([]);
  const [selectedLinks, setSelectedLinks] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [activeTab, setActiveTab] = useState('links'); // 'links' or 'data'
  const [selectedKhoa, setSelectedKhoa] = useState(14); // Default to Khóa XIV (default)
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState('https://daihoidang.vn/uy-vien-trung-uong.html');
  const [customSelector, setCustomSelector] = useState(''); // Custom CSS selector for content extraction

  // Map khóa number to text
  const khoaTextMap = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
    11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV'
  };

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    setLinks([]);
    setSelectedLinks(new Set());
    setExtractedData([]);
    setActiveTab('links');

    try {
      const targetUrl = useCustomUrl && customUrl.trim() 
        ? customUrl.trim() 
        : 'https://daihoidang.vn/uy-vien-trung-uong.html';
      
      // Validate URL
      try {
        new URL(targetUrl);
      } catch (e) {
        setError('URL không hợp lệ. Vui lòng nhập URL đầy đủ (ví dụ: https://daihoidang.vn/...)');
        setLoading(false);
        return;
      }

      const khoaText = khoaTextMap[selectedKhoa] || 'XIV';
      const linkText = `Đại hội Đảng lần thứ ${khoaText}`;
      
      // Khóa XIV (14) is current page, no need to click (unless using custom URL)
      const clickLink = useCustomUrl ? false : (selectedKhoa !== 14);
      
      const response = await scanLinks(
        clickLink, 
        '.dhd-prev.directioncontrol, .dhd-next.directioncontrol', 
        linkText,
        selectedKhoa,
        targetUrl
      );
      if (response.success) {
        setLinks(response.data || []);
      } else {
        setError(response.error || 'Failed to scan links');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while scanning');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedLinks.size === links.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(links.map(link => link.url)));
    }
  };

  const handleSelectLink = (url) => {
    const newSelected = new Set(selectedLinks);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedLinks(newSelected);
  };

  const handleExtractContent = async () => {
    if (selectedLinks.size === 0) {
      setError('Vui lòng chọn ít nhất một link để extract');
      return;
    }

    setExtracting(true);
    setError(null);
    setExtractedData([]);

    try {
      const urlsToExtract = Array.from(selectedLinks);
      const selector = customSelector.trim() || null;
      const response = await extractContent(urlsToExtract, selector);
      
      if (response.success) {
        setExtractedData(response.data || []);
        setActiveTab('data');
      } else {
        setError(response.error || 'Failed to extract content');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while extracting content');
    } finally {
      setExtracting(false);
    }
  };

  const handleExport = () => {
    if (links.length === 0) return;

    const dataStr = JSON.stringify(links, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'links.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportData = () => {
    if (extractedData.length === 0) return;

    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'extracted-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convert extracted data to CSV format
  const convertToCSV = () => {
    if (extractedData.length === 0) return '';

    // CSV Headers
    const headers = [
      'URL',
      'Họ và tên',
      'Ngày sinh',
      'Ngày vào Đảng',
      'Quê quán',
      'Chức vụ',
      'Trình độ lý luận chính trị',
      'Trình độ chuyên môn',
      'Timeline (Date | Description)',
      'Tổng số timeline entries'
    ];

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV rows
    const rows = extractedData
      .filter(item => item.success && item.data)
      .map(item => {
        const data = item.data;
        const boxContent = data.boxContent || {};
        const personalInfo = boxContent.personalInfo || {};
        const timeline = boxContent.timeline || [];

        // Format timeline entries
        const timelineText = timeline
          .map(entry => `${entry.date} | ${entry.description}`)
          .join('; ');

        return [
          escapeCSV(data.url || item.url),
          escapeCSV(personalInfo.hoTen || ''),
          escapeCSV(personalInfo.ngaySinh || ''),
          escapeCSV(personalInfo.ngayVaoDang || ''),
          escapeCSV(personalInfo.queQuan || ''),
          escapeCSV(personalInfo.chucVu || ''),
          escapeCSV(personalInfo.trinhDoLyLuan || ''),
          escapeCSV(personalInfo.trinhDoChuyenMon || ''),
          escapeCSV(timelineText),
          escapeCSV(timeline.length)
        ];
      });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    return '\uFEFF' + csvContent;
  };

  const handleExportCSV = () => {
    if (extractedData.length === 0) return;

    const csvContent = convertToCSV();
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'extracted-data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Flatten extracted data into table rows
  const getDataTableRows = () => {
    const rows = [];
    
    extractedData.forEach((item) => {
      if (!item.success || !item.data) return;

      const data = item.data;
      
      // Priority: Use box-content if available
      const contentSource = data.boxContent || data;
      const sourcePrefix = data.boxContent ? 'Box-Content' : 'Page';
      
      // Process personal information first
      if (data.boxContent && data.boxContent.personalInfo) {
        const personalInfo = data.boxContent.personalInfo;
        Object.entries(personalInfo).forEach(([key, value], idx) => {
          if (value && value.trim()) {
            const label = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .replace('HoTen', 'Họ và tên')
              .replace('NgaySinh', 'Ngày sinh')
              .replace('NgayVaoDang', 'Ngày vào Đảng')
              .replace('QueQuan', 'Quê quán')
              .replace('ChucVu', 'Chức vụ')
              .replace('TrinhDoLyLuan', 'Trình độ lý luận chính trị')
              .replace('TrinhDoChuyenMon', 'Trình độ chuyên môn');
            
            rows.push({
              url: data.url,
              source: 'Box-Content - Personal Info',
              rowIndex: idx,
              cells: `${label}: ${value}`
            });
          }
        });
      }
      
      // Process timeline entries (highest priority for structured data)
      if (data.boxContent && data.boxContent.timeline && data.boxContent.timeline.length > 0) {
        data.boxContent.timeline.forEach((entry, idx) => {
          rows.push({
            url: data.url,
            source: 'Box-Content - Timeline',
            rowIndex: idx,
            cells: `${entry.date} | ${entry.description}`
          });
        });
      }

      // Process allItems (comprehensive extraction) - filter out navigation
      if (data.boxContent && data.boxContent.allItems && data.boxContent.allItems.length > 0) {
        const navPatterns = [
          'Tìm kiếm', 'Đại hội Đảng các cấp', 'Lịch sử các kỳ', 
          'Hồ sơ Tư liệu', 'Dành cho Báo chí', 'Dữ liệu nhân sự',
          'Danh sách ủy viên', 'Thống kê', 'đhđ-14', 'đhđ'
        ];
        
        data.boxContent.allItems.forEach((item, idx) => {
          // Only add if not already in timeline
          const isInTimeline = data.boxContent.timeline && 
            data.boxContent.timeline.some(t => t.fullText === item.text);
          
          // Check if it's navigation text
          const isNav = navPatterns.some(pattern => {
            const lowerText = item.text.toLowerCase();
            const lowerPattern = pattern.toLowerCase();
            return lowerText === lowerPattern || 
                   lowerText.startsWith(lowerPattern + ' ') ||
                   (item.text.length < 50 && lowerText.includes(lowerPattern));
          });
          
          // Must have profile indicators
          const hasProfileContent = 
            item.text.includes('Họ') || item.text.includes('Ngày') || 
            item.text.includes('Quê') || item.text.includes('Chức') ||
            item.text.includes('Trình độ') || item.text.includes('TÓM TẮT') ||
            item.text.includes('quá trình') || item.text.match(/\d{4}(?:-\d{4})?/) ||
            item.text.length > 50;
          
          if (!isInTimeline && !isNav && hasProfileContent && item.text.length > 10) {
            rows.push({
              url: data.url,
              source: `Box-Content - ${item.tag || 'Item'}`,
              rowIndex: idx,
              cells: item.text
            });
          }
        });
      }

      // Process tables from box-content or page
      if (contentSource.tables && contentSource.tables.length > 0) {
        contentSource.tables.forEach((table, tableIdx) => {
          table.rows.forEach((row, rowIdx) => {
            const rowData = {
              url: data.url,
              source: `${sourcePrefix} - Table ${tableIdx + 1}`,
              rowIndex: rowIdx,
              cells: row.cells.map(cell => cell.text).join(' | ')
            };
            rows.push(rowData);
          });
        });
      }

      // Process lists from box-content or page
      if (contentSource.lists && contentSource.lists.length > 0) {
        contentSource.lists.forEach((list, listIdx) => {
          list.items.forEach((item, itemIdx) => {
            const itemText = typeof item === 'string' ? item : (item.text || item);
            rows.push({
              url: data.url,
              source: `${sourcePrefix} - List ${listIdx + 1}`,
              rowIndex: itemIdx,
              cells: itemText
            });
          });
        });
      }

      // Process divs from box-content
      if (data.boxContent && data.boxContent.divs && data.boxContent.divs.length > 0) {
        data.boxContent.divs.forEach((div, idx) => {
          rows.push({
            url: data.url,
            source: 'Box-Content - Div',
            rowIndex: idx,
            cells: div.text
          });
        });
      }

      // Process spans from box-content
      if (data.boxContent && data.boxContent.spans && data.boxContent.spans.length > 0) {
        data.boxContent.spans.forEach((span, idx) => {
          rows.push({
            url: data.url,
            source: 'Box-Content - Span',
            rowIndex: idx,
            cells: span.text
          });
        });
      }

      // If box-content has text but no structured data, use the text
      if (data.boxContent && data.boxContent.text && rows.length === 0) {
        // Split text by lines or use as single row
        const textLines = data.boxContent.text.split('\n').filter(line => line.trim());
        if (textLines.length > 0) {
          textLines.forEach((line, idx) => {
            rows.push({
              url: data.url,
              source: 'Box-Content - Text',
              rowIndex: idx,
              cells: line.trim()
            });
          });
        } else {
          rows.push({
            url: data.url,
            source: 'Box-Content - Text',
            rowIndex: 0,
            cells: data.boxContent.text
          });
        }
      }

      // If no box-content or no data from box-content, use page paragraphs
      if (rows.length === 0 && data.paragraphs && data.paragraphs.length > 0) {
        data.paragraphs.forEach((para, idx) => {
          const paraText = typeof para === 'string' ? para : (para.text || para);
          rows.push({
            url: data.url,
            source: 'Page - Paragraph',
            rowIndex: idx,
            cells: paraText
          });
        });
      }
    });

    return rows;
  };

  const dataTableRows = getDataTableRows();
  const successfulExtractions = extractedData.filter(item => item.success).length;
  const failedExtractions = extractedData.filter(item => !item.success).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            DaiHoiDang Scraper
          </h1>
          <p className="text-gray-600">
            Scrape profile links from daihoidang.vn và extract nội dung HTML
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-4">
            {/* Custom URL Option */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use-custom-url"
                checked={useCustomUrl}
                onChange={(e) => {
                  setUseCustomUrl(e.target.checked);
                  if (!e.target.checked) {
                    setCustomUrl('https://daihoidang.vn/uy-vien-trung-uong.html');
                  }
                }}
                disabled={loading || extracting}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="use-custom-url" className="text-sm font-medium text-gray-700 cursor-pointer">
                Sử dụng link tùy chỉnh
              </label>
            </div>

            {/* Custom URL Input */}
            {useCustomUrl && (
              <div className="flex items-center gap-2">
                <label htmlFor="custom-url" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  URL:
                </label>
                <input
                  type="text"
                  id="custom-url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  disabled={loading || extracting}
                  placeholder="https://daihoidang.vn/uy-vien-trung-uong.html"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {/* Dropdown for selecting Congress session (only show if not using custom URL) */}
            {!useCustomUrl && (
              <div className="flex items-center gap-2">
                <label htmlFor="khoa-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Chọn khóa:
                </label>
                <select
                  id="khoa-select"
                  value={selectedKhoa}
                  onChange={(e) => setSelectedKhoa(Number(e.target.value))}
                  disabled={loading || extracting}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((khoa) => (
                    <option key={khoa} value={khoa}>
                      Khóa {khoaTextMap[khoa]} (Đại hội lần thứ {khoaTextMap[khoa]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Selector for Content Extraction */}
            <div className="flex items-center gap-2">
              <label htmlFor="custom-selector" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Class/Selector tùy chỉnh:
              </label>
              <input
                type="text"
                id="custom-selector"
                value={customSelector}
                onChange={(e) => setCustomSelector(e.target.value)}
                disabled={extracting}
                placeholder=".box-content, #content, .detail, ... (để trống để dùng mặc định)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Scan Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleScan}
                disabled={loading || extracting}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>
                      {useCustomUrl 
                        ? 'Scan Links từ URL tùy chỉnh' 
                        : `Scan Links Khóa ${khoaTextMap[selectedKhoa]}`}
                    </span>
                  </>
                )}
              </button>

              {links.length > 0 && selectedLinks.size > 0 && (
                <button
                  onClick={handleExtractContent}
                  disabled={extracting}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      <span>Extract Content ({selectedLinks.size})</span>
                    </>
                  )}
                </button>
              )}

              {links.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Download className="w-5 h-5" />
                  <span>Export Links JSON</span>
                </button>
              )}

              {extractedData.length > 0 && (
                <>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export Data JSON</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export CSV</span>
                  </button>
                </>
              )}

              {links.length > 0 && (
                <div className="ml-auto text-lg font-semibold text-gray-700">
                  Total: <span className="text-blue-600">{links.length}</span> links
                  {selectedLinks.size > 0 && (
                    <span className="ml-2">
                      | Selected: <span className="text-purple-600">{selectedLinks.size}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error: {error}</p>
          </div>
        )}

        {/* Tabs */}
        {(links.length > 0 || extractedData.length > 0) && (
          <div className="mb-4 border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('links')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'links'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Links ({links.length})
              </button>
              {extractedData.length > 0 && (
                <button
                  onClick={() => setActiveTab('data')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'data'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Data Table ({dataTableRows.length} rows)
                  {successfulExtractions > 0 && (
                    <span className="ml-2 text-green-600">✓ {successfulExtractions}</span>
                  )}
                  {failedExtractions > 0 && (
                    <span className="ml-2 text-red-600">✗ {failedExtractions}</span>
                  )}
                </button>
              )}
            </nav>
          </div>
        )}

        {/* Links Table */}
        {activeTab === 'links' && links.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
              >
                {selectedLinks.size === links.length ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span>Select All</span>
              </button>
              <span className="text-sm text-gray-500">
                {selectedLinks.size} selected
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      STT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {links.map((link, index) => (
                    <tr key={link.url} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleSelectLink(link.url)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {selectedLinks.has(link.url) ? (
                            <CheckSquare className="w-5 h-5 text-purple-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {link.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                          {link.url}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Table */}
        {activeTab === 'data' && extractedData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {dataTableRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        STT
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Content
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dataTableRows.map((row, index) => (
                      <tr key={`${row.url}-${row.source}-${row.rowIndex}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            title={row.url}
                          >
                            {row.url}
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.source}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-2xl">
                            {row.cells}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  Không tìm thấy dữ liệu table/list để hiển thị
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Dữ liệu raw đã được lưu, bạn có thể export JSON để xem chi tiết
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !extracting && links.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              Click "Scan Links" to start scraping profile links
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
