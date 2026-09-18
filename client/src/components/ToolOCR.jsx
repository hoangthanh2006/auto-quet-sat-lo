import { useState, useRef } from 'react';
import {
  FileText,
  ScanText,
  Upload,
  Copy,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Languages,
  Eye,
  Sliders,
  Sparkles,
  Layers,
  FileCheck,
  X
} from 'lucide-react';
import { scanOcrFile } from '../services/api';
import DriveUploadButton from './DriveUploadButton';

export default function ToolOCR() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [langs, setLangs] = useState('vi,en');
  const [engine, setEngine] = useState('paddleocr'); // 'paddleocr' | 'auto' | 'easyocr'
  const [isHandwritten, setIsHandwritten] = useState(false);
  const [forceOcr, setForceOcr] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('fulltext'); // 'fulltext' | 'lines' | 'pages'
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [copiedText, setCopiedText] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp', 'application/pdf'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(file.type) && !['png', 'jpg', 'jpeg', 'webp', 'bmp', 'pdf'].includes(ext)) {
      setErrorMsg('Định dạng file không hỗ trợ. Vui lòng chọn file Ảnh (PNG, JPG, WEBP) hoặc file PDF.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('Dung lượng file vượt quá giới hạn 50MB.');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
    setOcrResult(null);

    // Create local image preview if image
    if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartScan = async () => {
    if (!selectedFile) return;

    setScanning(true);
    setErrorMsg(null);
    setOcrResult(null);

    try {
      const res = await scanOcrFile(selectedFile, {
        langs,
        forceOcr,
        engine,
        isHandwritten
      });

      if (res.success) {
        setOcrResult(res);
        setActiveTab('fulltext');
        setSelectedPageIdx(0);
      } else {
        throw new Error(res.error || 'Quét OCR thất bại.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi kết nối với máy chủ OCR.');
    } finally {
      setScanning(false);
    }
  };

  const handleCopyText = () => {
    if (!ocrResult?.fullText) return;
    navigator.clipboard.writeText(ocrResult.fullText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!ocrResult?.fullText) return;
    const blob = new Blob([ocrResult.fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'ocr_extracted';
    link.download = `${cleanName}_ocr.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!ocrResult) return;
    let csvRows = [];
    csvRows.push(['Page', 'Line Number', 'Extracted Text', 'Confidence'].map(v => `"${v}"`).join(','));

    ocrResult.pages.forEach((pageItem) => {
      pageItem.lines.forEach((line, idx) => {
        const textEscaped = (line.text || '').replace(/"/g, '""');
        csvRows.push([pageItem.page, idx + 1, `"${textEscaped}"`, line.confidence].join(','));
      });
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'ocr_extracted';
    link.download = `${cleanName}_ocr.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-0"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold backdrop-blur-md border border-emerald-400/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> EasyOCR & PyMuPDF Engine (Việt - Anh)
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-white flex items-center gap-3">
              <ScanText className="w-8 h-8 text-emerald-400" />
              OCR Text Scanner (Ảnh & PDF)
            </h1>
            <p className="text-emerald-200 text-sm mt-2 max-w-2xl leading-relaxed">
              Trích xuất văn bản tự động từ tệp Hình ảnh (PNG, JPG, WEBP) và Tài liệu PDF bằng trí tuệ nhân tạo OCR, hỗ trợ nhận diện Tiếng Việt chuẩn xác.
            </p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: File Upload & Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 font-heading flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-500" /> Chọn Tệp Quét (Ảnh / PDF)
            </h2>

            {/* Drag and Drop Zone */}
            {!selectedFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center space-y-3"
              >
                <div className="p-4 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform">
                  <ScanText className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Kéo & Thả tệp vào đây hoặc <span className="text-emerald-600 dark:text-emerald-400 underline">Bấm để chọn</span>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Hỗ trợ định dạng: PNG, JPG, WEBP, BMP, PDF (Tối đa 50MB)
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,image/bmp,application/pdf"
                  className="hidden"
                />
              </div>
            ) : (
              /* Selected File Card */
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60 relative flex items-center gap-4">
                <button
                  onClick={handleClearFile}
                  className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="p-3 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                  <FileText className="w-8 h-8" />
                </div>

                <div className="min-w-0 flex-1 pr-6 text-xs space-y-0.5">
                  <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">
                    {selectedFile.name}
                  </p>
                  <p className="text-slate-400">
                    Kích thước: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.name.split('.').pop().toUpperCase()}
                  </p>
                </div>
              </div>
            )}

            {/* Image Preview */}
            {previewUrl && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 p-2 flex justify-center max-h-60">
                <img src={previewUrl} alt="OCR Preview" className="object-contain max-h-56 rounded-xl" />
              </div>
            )}

            {/* OCR Options */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Sliders className="w-4 h-4 text-emerald-500" /> Động cơ OCR AI:
                </label>
                <select
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="auto">Tự động (PaddleOCR / EasyOCR AI)</option>
                  <option value="paddleocr">PaddleOCR (Đặc trị tài liệu & chữ Tiếng Việt)</option>
                  <option value="easyocr">EasyOCR (Động cơ AI mặc định)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Languages className="w-4 h-4 text-emerald-500" /> Ngôn ngữ nhận diện:
                </label>
                <select
                  value={langs}
                  onChange={(e) => setLangs(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="vi,en">Tiếng Việt + Tiếng Anh (Khuyên dùng)</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">Tiếng Anh (English)</option>
                </select>
              </div>

              {/* Handwritten & Lined Paper Toggle */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-handwritten"
                    checked={isHandwritten}
                    onChange={(e) => setIsHandwritten(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                  />
                  <label htmlFor="is-handwritten" className="text-amber-800 dark:text-amber-300 font-bold cursor-pointer flex items-center gap-1">
                    <span>✏️ Chế độ Chữ Viết Tay & Vở Ô Ly</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 leading-relaxed">
                  Tự động xóa đường kẻ ngang của trang vở học sinh & làm nét nét mực viết tay để tránh bị đứt nét chữ.
                </p>
              </div>

              {selectedFile?.name.endsWith('.pdf') && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="force-ocr"
                    checked={forceOcr}
                    onChange={(e) => setForceOcr(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                  />
                  <label htmlFor="force-ocr" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Bắt buộc quét OCR AI cả trang (Dùng cho PDF quét từ ảnh)
                  </label>
                </div>
              )}
            </div>

            {/* Scan Action Button */}
            <button
              onClick={handleStartScan}
              disabled={!selectedFile || scanning}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Đang xử lý & quét OCR...</span>
                </>
              ) : (
                <>
                  <ScanText className="w-5 h-5" />
                  <span>Bắt đầu Quét OCR</span>
                </>
              )}
            </button>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Extracted OCR Results */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md min-h-[520px] flex flex-col justify-between">
            <div>
              {/* Header Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base font-heading flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-500" /> Kết Quả Trích Xuất Văn Bản
                  </h3>
                  {ocrResult && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>Tổng số trang: {ocrResult.totalPages} • Độ dài: {ocrResult.fullText.length} ký tự</span>
                      {ocrResult.procTimeSec && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          ⚡ Xử lý trong {ocrResult.procTimeSec}s
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {ocrResult && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleCopyText}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> {copiedText ? 'Đã chép!' : 'Sao chép'}
                    </button>
                    <button
                      onClick={handleDownloadTxt}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> File TXT
                    </button>
                    <button
                      onClick={handleDownloadCSV}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <DriveUploadButton
                      fileName={`${selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'ocr_extracted'}_text`}
                      getData={ocrResult.fullText}
                      mimeType="text/plain"
                    />
                  </div>
                )}
              </div>

              {/* Result View Tabs */}
              {ocrResult && (
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <button
                    onClick={() => setActiveTab('fulltext')}
                    className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
                      activeTab === 'fulltext'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    Văn Bản Đầy Đủ
                  </button>
                  <button
                    onClick={() => setActiveTab('lines')}
                    className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
                      activeTab === 'lines'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    Chi Tiết Dòng ({ocrResult.pages.reduce((acc, p) => acc + p.lines.length, 0)})
                  </button>
                  {ocrResult.totalPages > 1 && (
                    <button
                      onClick={() => setActiveTab('pages')}
                      className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
                        activeTab === 'pages'
                          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                          : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      Phân Trang PDF ({ocrResult.totalPages})
                    </button>
                  )}
                </div>
              )}

              {/* Main Text Content */}
              {scanning ? (
                <div className="py-28 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
                  <RefreshCw className="w-10 h-10 animate-spin text-emerald-500" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Đang quét nhận diện chữ từ tệp...</p>
                  <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát (mô hình OCR đang trích xuất từng dòng)</p>
                </div>
              ) : !ocrResult ? (
                <div className="py-28 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <ScanText className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="font-medium text-slate-500 dark:text-slate-400">Chưa có dữ liệu quét</p>
                  <p className="text-slate-400">Chọn file Ảnh hoặc PDF bên trái và bấm &quot;Bắt đầu Quét OCR&quot;</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: Full Text */}
                  {activeTab === 'fulltext' && (
                    <div className="relative">
                      <textarea
                        readOnly
                        value={ocrResult.fullText}
                        rows={16}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none scrollbar-thin shadow-inner"
                      />
                    </div>
                  )}

                  {/* TAB 2: Lines & Confidence */}
                  {activeTab === 'lines' && (
                    <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                      {ocrResult.pages.map((p) =>
                        p.lines.map((l, lIdx) => (
                          <div
                            key={`${p.page}-${lIdx}`}
                            className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px] text-slate-500 font-bold">
                                P{p.page}-L{lIdx + 1}
                              </span>
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{l.text}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {(l.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: PDF Page-by-page */}
                  {activeTab === 'pages' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {ocrResult.pages.map((p, idx) => (
                          <button
                            key={p.page}
                            onClick={() => setSelectedPageIdx(idx)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                              selectedPageIdx === idx
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            Trang {p.page}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <textarea
                          readOnly
                          value={ocrResult.pages[selectedPageIdx]?.text || ''}
                          rows={12}
                          className="w-full bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {ocrResult && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span>File: {ocrResult.fileName}</span>
                <span>Phương thức: EasyOCR + PyMuPDF</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
