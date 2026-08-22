import { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings,
  Loader2,
  FolderCheck,
  ShieldAlert,
  X
} from 'lucide-react';
import { getDriveStatus, uploadToDrive, saveDriveConfig } from '../services/api';

export default function DriveUploadButton({
  fileName,
  getData,
  mimeType = 'text/csv',
  buttonText = 'Upload Google Drive',
  className = ''
}) {
  const [uploading, setUploading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Config modal state
  const [jsonKeyInput, setJsonKeyInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [driveStatus, setDriveStatus] = useState(null);

  const handleUpload = async () => {
    setErrorMsg(null);
    setSuccessResult(null);
    setUploading(true);

    try {
      // 1. Check Drive status first
      const statusRes = await getDriveStatus();
      setDriveStatus(statusRes.data);

      if (!statusRes.data?.hasCredentials) {
        setShowConfigModal(true);
        setUploading(false);
        return;
      }

      // 2. Obtain content
      let content = typeof getData === 'function' ? getData() : getData;
      if (!content) {
        throw new Error('Không có dữ liệu để tải lên Google Drive');
      }

      if (typeof content !== 'string' && !(content instanceof Buffer)) {
        content = JSON.stringify(content, null, 2);
      }

      // 3. Perform upload
      const cleanFileName = fileName.endsWith('.csv') || fileName.endsWith('.json')
        ? fileName
        : `${fileName}.${mimeType === 'application/json' ? 'json' : 'csv'}`;

      const res = await uploadToDrive({
        fileName: cleanFileName,
        content,
        mimeType
      });

      if (res.success) {
        setSuccessResult(res);
      } else {
        throw new Error(res.error || 'Tải lên Google Drive thất bại');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tải lên Google Drive');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!jsonKeyInput || !jsonKeyInput.trim()) {
      setErrorMsg('Vui lòng dán nội dung file Service Account JSON key');
      return;
    }

    setSavingConfig(true);
    setErrorMsg(null);

    try {
      let parsed;
      try {
        parsed = JSON.parse(jsonKeyInput.trim());
      } catch (e) {
        throw new Error('Nội dung dán vào không phải là định dạng JSON hợp lệ.');
      }

      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('File Service Account JSON thiếu thông tin client_email hoặc private_key');
      }

      const res = await saveDriveConfig({ credentials: parsed });
      if (res.success) {
        setShowConfigModal(false);
        setJsonKeyInput('');
        // Retry upload after config save
        handleUpload();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi lưu cấu hình Google Drive');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <>
      <button
        onClick={handleUpload}
        disabled={uploading}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all duration-200 disabled:opacity-50 ${className}`}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UploadCloud className="w-4 h-4 text-blue-200" />
        )}
        {uploading ? 'Đang tải lên Drive...' : buttonText}
      </button>

      {/* Success Banner Toast */}
      {successResult && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-emerald-900/90 text-emerald-100 p-4 rounded-2xl border border-emerald-500/40 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-1">
              <p className="font-bold text-white text-sm">Đã lưu lên Google Drive!</p>
              <p className="text-emerald-200">
                Thư mục: <span className="font-mono text-emerald-300 font-semibold">{successResult.folderPath}</span>
              </p>
              <p className="truncate text-emerald-300/80">{successResult.fileName}</p>
              <div className="pt-2 flex items-center gap-3">
                <a
                  href={successResult.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Mở trên Google Drive
                </a>
                <button
                  onClick={() => setSuccessResult(null)}
                  className="text-emerald-300 hover:text-white"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert Toast */}
      {errorMsg && !showConfigModal && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-rose-900/90 text-rose-100 p-4 rounded-2xl border border-rose-500/40 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-1">
              <p className="font-bold text-white text-sm">Lỗi tải lên Drive</p>
              <p className="text-rose-200">{errorMsg}</p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setShowConfigModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-rose-100 font-semibold transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Cài đặt Service Account
                </button>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-300 hover:text-white"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Account Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-4 relative animate-in zoom-in-95">
            <button
              onClick={() => setShowConfigModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-white">Kết nối Google Drive API</h3>
                <p className="text-xs text-slate-400">Cấu hình Google Service Account để tự động lưu file vào Drive</p>
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span>Thư mục lưu trữ trên Drive:</span>
                <span className="font-mono text-blue-400 font-bold">YYYY / MM / DD</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Các file sẽ được tự động chia vào thư mục phân cấp theo Ngày/Tháng/Năm trong thư mục Google Drive gốc:
              </p>
              <a
                href={driveStatus?.targetFolderUrl || 'https://drive.google.com/drive/folders/1qyM-4r0aBiyVmRDotRARVg6WVUKAGAJC'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-400 hover:underline font-mono text-[11px]"
              >
                <FolderCheck className="w-4 h-4 text-emerald-400" />
                Folder ID: 1qyM-4r0aBiyVmRDotRARVg6WVUKAGAJC <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Dán nội dung file Service Account Key (.json):
              </label>
              <textarea
                value={jsonKeyInput}
                onChange={(e) => setJsonKeyInput(e.target.value)}
                placeholder='{"type": "service_account", "project_id": "...", "client_email": "...", "private_key": "..."}'
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500">
                * Lưu ý: Đảm bảo đã Chia sẻ (Share) quyền Editor cho Email Service Account (`client_email`) vào thư mục Google Drive của bạn.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors disabled:opacity-50"
              >
                {savingConfig && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingConfig ? 'Đang lưu...' : 'Lưu & Tiến hành Tải lên'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
