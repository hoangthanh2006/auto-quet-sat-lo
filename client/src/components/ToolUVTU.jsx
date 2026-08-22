import { useState } from 'react';
import { Search, Download, Loader2, ExternalLink, FileText, CheckSquare, Square } from 'lucide-react';
import { scanLinks, extractContent } from '../services/api';
import DriveUploadButton from './DriveUploadButton';

const khoaTextMap = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV'
};

export default function ToolUVTU() {
  const [links, setLinks] = useState([]);
  const [selectedLinks, setSelectedLinks] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [activeTab, setActiveTab] = useState('links');
  const [selectedKhoa, setSelectedKhoa] = useState(14);
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState('https://daihoidang.vn/uy-vien-trung-uong.html');
  const [customSelector, setCustomSelector] = useState('');

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    setLinks([]);
    setSelectedLinks(new Set());
    setExtractedData([]);
    setActiveTab('links');
    try {
      const targetUrl = useCustomUrl && customUrl.trim() ? customUrl.trim() : 'https://daihoidang.vn/uy-vien-trung-uong.html';
      try { new URL(targetUrl); } catch (e) {
        setError('URL không hợp lệ.');
        setLoading(false);
        return;
      }
      const khoaText = khoaTextMap[selectedKhoa] || 'XIV';
      const linkText = `Đại hội Đảng lần thứ ${khoaText}`;
      const clickLink = useCustomUrl ? false : (selectedKhoa !== 14);
      const response = await scanLinks(clickLink, '.dhd-prev.directioncontrol, .dhd-next.directioncontrol', linkText, selectedKhoa, targetUrl);
      if (response.success) setLinks(response.data || []);
      else setError(response.error || 'Failed to scan links');
    } catch (err) {
      setError(err.message || 'An error occurred while scanning');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    setSelectedLinks(selectedLinks.size === links.length ? new Set() : new Set(links.map(link => link.url)));
  };

  const handleSelectLink = (url) => {
    const next = new Set(selectedLinks);
    if (next.has(url)) next.delete(url); else next.add(url);
    setSelectedLinks(next);
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
      const response = await extractContent(Array.from(selectedLinks), customSelector.trim() || null);
      if (response.success) {
        setExtractedData(response.data || []);
        setActiveTab('data');
      } else setError(response.error || 'Failed to extract content');
    } catch (err) {
      setError(err.message || 'An error occurred while extracting content');
    } finally {
      setExtracting(false);
    }
  };

  const handleExport = () => {
    if (links.length === 0) return;
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'links.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExportData = () => {
    if (extractedData.length === 0) return;
    const blob = new Blob([JSON.stringify(extractedData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'extracted-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const escapeCSV = (v) => {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const convertToCSV = () => {
    if (extractedData.length === 0) return '';
    const headers = ['URL', 'Họ và tên', 'Ngày sinh', 'Ngày vào Đảng', 'Quê quán', 'Chức vụ', 'Trình độ lý luận chính trị', 'Trình độ chuyên môn', 'Timeline (Date | Description)', 'Tổng số timeline entries'];
    const rows = extractedData
      .filter(item => item.success && item.data)
      .map(item => {
        const data = item.data;
        const boxContent = data.boxContent || {};
        const personalInfo = boxContent.personalInfo || {};
        const timeline = boxContent.timeline || [];
        const timelineText = timeline.map(e => `${e.date} | ${e.description}`).join('; ');
        return [data.url || item.url, personalInfo.hoTen || '', personalInfo.ngaySinh || '', personalInfo.ngayVaoDang || '', personalInfo.queQuan || '', personalInfo.chucVu || '', personalInfo.trinhDoLyLuan || '', personalInfo.trinhDoChuyenMon || '', timelineText, timeline.length].map(escapeCSV);
      });
    return '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const handleExportCSV = () => {
    if (extractedData.length === 0) return;
    const blob = new Blob([convertToCSV()], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'extracted-data.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const getDataTableRows = () => {
    const rows = [];
    const navPatterns = ['Tìm kiếm', 'Đại hội Đảng các cấp', 'Lịch sử các kỳ', 'Hồ sơ Tư liệu', 'Dành cho Báo chí', 'Dữ liệu nhân sự', 'Danh sách ủy viên', 'Thống kê', 'đhđ-14', 'đhđ'];
    extractedData.forEach((item) => {
      if (!item.success || !item.data) return;
      const data = item.data;
      const contentSource = data.boxContent || data;
      const sourcePrefix = data.boxContent ? 'Box-Content' : 'Page';
      if (data.boxContent?.personalInfo) {
        Object.entries(data.boxContent.personalInfo).forEach(([key, value], idx) => {
          if (value?.trim()) {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace('HoTen', 'Họ và tên').replace('NgaySinh', 'Ngày sinh').replace('NgayVaoDang', 'Ngày vào Đảng').replace('QueQuan', 'Quê quán').replace('ChucVu', 'Chức vụ').replace('TrinhDoLyLuan', 'Trình độ lý luận chính trị').replace('TrinhDoChuyenMon', 'Trình độ chuyên môn');
            rows.push({ url: data.url, source: 'Box-Content - Personal Info', rowIndex: idx, cells: `${label}: ${value}` });
          }
        });
      }
      if (data.boxContent?.timeline?.length) {
        data.boxContent.timeline.forEach((entry, idx) => {
          rows.push({ url: data.url, source: 'Box-Content - Timeline', rowIndex: idx, cells: `${entry.date} | ${entry.description}` });
        });
      }
      if (data.boxContent?.allItems?.length) {
        data.boxContent.allItems.forEach((it, idx) => {
          const isNav = navPatterns.some(p => it.text?.toLowerCase().includes(p.toLowerCase()));
          const hasProfile = /Họ|Ngày|Quê|Chức|Trình độ|TÓM TẮT|quá trình|\d{4}(?:-\d{4})?/.test(it.text || '') || (it.text?.length > 50);
          if (!isNav && hasProfile && it.text?.length > 10)
            rows.push({ url: data.url, source: `Box-Content - ${it.tag || 'Item'}`, rowIndex: idx, cells: it.text });
        });
      }
      if (contentSource.tables?.length) {
        contentSource.tables.forEach((table, ti) => {
          table.rows.forEach((row, ri) => {
            rows.push({ url: data.url, source: `${sourcePrefix} - Table ${ti + 1}`, rowIndex: ri, cells: row.cells.map(c => c.text).join(' | ') });
          });
        });
      }
      if (contentSource.lists?.length) {
        contentSource.lists.forEach((list, li) => {
          list.items.forEach((it, ii) => {
            rows.push({ url: data.url, source: `${sourcePrefix} - List ${li + 1}`, rowIndex: ii, cells: typeof it === 'string' ? it : (it.text || it) });
          });
        });
      }
      if (data.boxContent?.text && rows.filter(r => r.url === data.url).length === 0) {
        rows.push({ url: data.url, source: 'Box-Content - Text', rowIndex: 0, cells: data.boxContent.text });
      }
      if (data.paragraphs?.length && rows.filter(r => r.url === data.url).length === 0) {
        data.paragraphs.forEach((p, i) => rows.push({ url: data.url, source: 'Page - Paragraph', rowIndex: i, cells: typeof p === 'string' ? p : (p.text || p) }));
      }
    });
    return rows;
  };

  const dataTableRows = getDataTableRows();
  const successfulExtractions = extractedData.filter(i => i.success).length;
  const failedExtractions = extractedData.filter(i => !i.success).length;

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-4 font-heading">
          Lấy data từ trang Danh sách thành viên UVTU theo khóa
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="use-custom-url" 
              checked={useCustomUrl} 
              onChange={(e) => { setUseCustomUrl(e.target.checked); if (!e.target.checked) setCustomUrl('https://daihoidang.vn/uy-vien-trung-uong.html'); }} 
              disabled={loading || extracting} 
              className="w-4 h-4 text-blue-600 dark:text-blue-500 rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700" 
            />
            <label htmlFor="use-custom-url" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sử dụng link tùy chỉnh</label>
          </div>
          
          {useCustomUrl && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">URL:</label>
              <input 
                type="text" 
                value={customUrl} 
                onChange={(e) => setCustomUrl(e.target.value)} 
                disabled={loading || extracting} 
                placeholder="https://daihoidang.vn/uy-vien-trung-uong.html" 
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-slate-800 dark:text-slate-200" 
              />
            </div>
          )}
          
          {!useCustomUrl && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Chọn khóa:</label>
              <select 
                value={selectedKhoa} 
                onChange={(e) => setSelectedKhoa(Number(e.target.value))} 
                disabled={loading || extracting} 
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-slate-800 dark:text-slate-100"
              >
                {Array.from({ length: 14 }, (_, i) => i + 1).map((k) => (
                  <option key={k} value={k}>Khóa {khoaTextMap[k]} (Đại hội lần thứ {khoaTextMap[k]})</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Class/Selector tùy chỉnh:</label>
            <input 
              type="text" 
              value={customSelector} 
              onChange={(e) => setCustomSelector(e.target.value)} 
              disabled={extracting} 
              placeholder=".box-content, #content, .detail, ... (để trống để dùng mặc định)" 
              className="flex-1 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm text-slate-800 dark:text-slate-200" 
            />
          </div>
          
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button 
              onClick={handleScan} 
              disabled={loading || extracting} 
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 text-sm font-semibold transition-all duration-200 shadow-sm shadow-blue-500/10"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{useCustomUrl ? 'Scan Links từ URL tùy chỉnh' : `Scan Links Khóa ${khoaTextMap[selectedKhoa]}`}</span>
            </button>
            
            {links.length > 0 && selectedLinks.size > 0 && (
              <button 
                onClick={handleExtractContent} 
                disabled={extracting} 
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50 text-sm font-semibold transition-all duration-200 shadow-sm shadow-purple-500/10"
              >
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>Trích xuất nội dung ({selectedLinks.size})</span>
              </button>
            )}
            
            {links.length > 0 && (
              <button 
                onClick={handleExport} 
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm"
              >
                <Download className="w-4 h-4" /> Export Links JSON
              </button>
            )}
            
            {extractedData.length > 0 && (
              <>
                <button 
                  onClick={handleExportData} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm"
                >
                  <Download className="w-4 h-4" /> Export Data JSON
                </button>
                <button 
                  onClick={handleExportCSV} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <DriveUploadButton
                  fileName={`uvtu_khoa_${selectedKhoa}`}
                  getData={() => convertToCSV()}
                  mimeType="text/csv"
                  className="py-2.5 px-5 text-sm font-semibold"
                />
              </>
            )}
            
            {links.length > 0 && (
              <div className="ml-auto text-sm text-slate-500 dark:text-slate-400 font-medium">
                Tổng cộng: <span className="text-blue-600 dark:text-blue-400 font-bold">{links.length}</span> liên kết 
                {selectedLinks.size > 0 && (
                  <> | Đã chọn: <span className="text-purple-600 dark:text-purple-400 font-bold">{selectedLinks.size}</span></>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          <p className="font-semibold">Lỗi: {error}</p>
        </div>
      )}

      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-8">
          <button 
            onClick={() => setActiveTab('links')} 
            className={`py-4 px-1 border-b-2 font-bold text-sm transition-all ${
              activeTab === 'links' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Liên kết {links.length > 0 && `(${links.length})`}
          </button>
          {extractedData.length > 0 && (
            <button 
              onClick={() => setActiveTab('data')} 
              className={`py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                activeTab === 'data' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Bảng dữ liệu ({dataTableRows.length} dòng) 
              {successfulExtractions > 0 && <span className="ml-2 text-green-600 dark:text-green-400">✓ {successfulExtractions}</span>} 
              {failedExtractions > 0 && <span className="ml-2 text-red-600 dark:text-red-400">✗ {failedExtractions}</span>}
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'links' && links.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden transition-all duration-300">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <button onClick={handleSelectAll} className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              {selectedLinks.size === links.length ? <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" /> : <Square className="w-5 h-5" />}
              <span>Chọn tất cả</span>
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đang chọn {selectedLinks.size} liên kết</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-12"></th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">STT</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Họ và tên</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Đường dẫn chi tiết</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                {links.map((link, index) => (
                  <tr key={link.url} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button onClick={() => handleSelectLink(link.url)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        {selectedLinks.has(link.url) ? <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" /> : <Square className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100">{link.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-lg truncate">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                        {link.url} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'data' && extractedData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden transition-all duration-300">
          {dataTableRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">STT</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Đường dẫn</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Nguồn tin</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Nội dung trích xuất</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                  {dataTableRows.map((row, index) => (
                    <tr key={`${row.url}-${row.source}-${row.rowIndex}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1" title={row.url}>
                          {row.url} <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-200 font-medium">{row.source}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 max-w-2xl leading-relaxed">{row.cells}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <FileText className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-sm font-medium">Không tìm thấy dữ liệu cấu trúc để hiển thị. Bạn có thể xuất tệp JSON để xem cấu trúc chi tiết.</p>
            </div>
          )}
        </div>
      )}

      {!loading && !extracting && links.length === 0 && !error && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md p-12 text-center transition-all duration-300">
          <Search className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Chọn khóa hoặc nhập URL tùy chỉnh và bấm &quot;Scan Links&quot; để bắt đầu quét liên kết.</p>
        </div>
      )}
    </div>
  );
}

