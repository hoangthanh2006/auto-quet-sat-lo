import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, ListOrdered, Zap } from 'lucide-react';

export default function UsageGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md mb-6 overflow-hidden transition-all duration-300">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-slate-800 dark:text-slate-100 font-heading">Hướng dẫn sử dụng</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-6">
          {/* 1. Extract data theo khóa */}
          <section>
            <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 mb-3 font-heading">
              <ListOrdered className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              1. Extract data theo click + dropdown Khóa
            </h3>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 border border-blue-100 dark:border-blue-900/20 space-y-3">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Lấy danh sách link hồ sơ theo từng khóa Đại hội:</p>
              <ol className="list-decimal list-inside space-y-2.5 pl-1 leading-relaxed">
                <li>
                  <strong>Chọn khóa:</strong> Dùng dropdown <strong>Chọn khóa</strong> (Khóa I → XIV). Mặc định là Khóa XIV (trang hiện tại).
                </li>
                <li>
                  <strong>Hoặc dùng link tùy chỉnh:</strong> Tick <strong>Sử dụng link tùy chỉnh</strong> và nhập URL trang danh sách (vd: daihoidang.vn).
                </li>
                <li>
                  <strong>Class/Selector tùy chỉnh (tùy chọn):</strong> Nhập CSS selector vùng nội dung (vd: <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border dark:border-slate-700">.box-content</code>) nếu trang dùng class khác.
                </li>
                <li>
                  <strong>Scan Links:</strong> Bấm <strong>Scan Links</strong> → hệ thống lấy danh sách link hồ sơ (với Khóa khác XIV sẽ mô phỏng click chuyển khóa rồi quét link).
                </li>
                <li>
                  <strong>Chọn link cần extract:</strong> Ở tab Links, tick các dòng cần lấy nội dung (hoặc <strong>Select All</strong>).
                </li>
                <li>
                  <strong>Extract Content:</strong> Bấm <strong>Extract Content</strong> → dữ liệu chi tiết (tiểu sử, bảng, timeline...) hiển thị ở tab <strong>Data Table</strong>. Có thể <strong>Export JSON</strong> hoặc <strong>Export CSV</strong>.
                </li>
              </ol>
            </div>
          </section>

          {/* 2. Dynamic Scraper */}
          <section>
            <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 mb-3 font-heading">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              2. Dynamic Scraper (lấy dữ liệu theo class/selector tùy ý)
            </h3>
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 border border-purple-100 dark:border-purple-900/20 space-y-3">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Lấy dữ liệu từ bất kỳ trang web theo cấu hình selector và loại dữ liệu (Text / Link / Ảnh / API):</p>
              <ol className="list-decimal list-inside space-y-2.5 pl-1 leading-relaxed">
                <li>
                  <strong>Mở tab Dynamic Scraper</strong> (tab cuối cùng).
                </li>
                <li>
                  <strong>Bước 1 – Phân tích trang:</strong> Nhập URL trang cần lấy dữ liệu → bấm <strong>Phân tích trang</strong>. Hệ thống nhận diện loại trang (Danh sách / Bài viết / Bảng) và gợi ý các vùng dữ liệu.
                </li>
                <li>
                  <strong>Lọc theo loại (tùy chọn):</strong> Click vào các card <strong>Headings</strong>, <strong>Articles</strong>, <strong>Tables</strong>, <strong>Items/Profiles</strong> để chỉ hiển thị vùng dữ liệu thuộc loại đó. Click vào một vùng để tự động điền vào form cấu hình.
                </li>
                <li>
                  <strong>Bước 2 – Cấu hình trường:</strong> Mỗi dòng gồm <strong>Tên dữ liệu</strong>, <strong>CSS Selector</strong>, và <strong>Type</strong> (Text / Link / Ảnh / API Data / <strong>Click link → Nội dung trang</strong>). Chọn <strong>Click link → Nội dung trang</strong> khi cần: chọn class chứa link (vd: .list-item), hệ thống sẽ click từng link và lấy toàn bộ text của trang đích. Dùng <strong>Thêm trường</strong> để thêm nhiều cột.
                </li>
                <li>
                  <strong>Bước 3 – Thực thi:</strong> Bấm <strong>Bắt đầu lấy dữ liệu</strong> → kết quả hiển thị dạng bảng. Có thể <strong>Export JSON</strong> hoặc <strong>Export CSV</strong>.
                </li>
                <li>
                  <strong>Trang SPA (sidebar):</strong> Nếu trang là SPA, chi tiết chỉ hiện khi click từng item (vd: trong sidebar): bấm <strong>Trang dạng SPA (click từng item, lấy nội dung sidebar)</strong> → nhập selector list item (<code>[data-id]</code> hoặc <code>.list-item</code>), selector sidebar (<code>.sidebar_right</code>), selector nội dung (<code>.detail1</code>), attribute khóa (<code>data-id</code>) → <strong>Chạy SPA Sidebar</strong>. Dữ liệu lấy theo từng click, dùng <code>data-id</code> làm khóa để tránh trùng.
                </li>
              </ol>
            </div>
          </section>

          {/* 3. Lũ quét & Sạt lở đất (NCHMF) */}
          <section>
            <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 mb-3 font-heading">
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">3.</span>
              Lũ Quét & Sạt Lở Đất (luquetsatlo.nchmf.gov.vn)
            </h3>
            <div className="bg-cyan-50 dark:bg-cyan-950/20 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 border border-cyan-100 dark:border-cyan-900/20 space-y-3">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Khai thác dữ liệu thời gian thực từ Cục Khí tượng Thủy văn:</p>
              <ul className="list-disc list-inside space-y-2 pl-1 leading-relaxed">
                <li>
                  <strong>Cảnh báo thời gian thực:</strong> Chọn ngày, giờ và số giờ dự báo (1h, 3h, 6h) hoặc bấm <strong>Cập nhật mới nhất (Realtime)</strong> để lấy ngay toàn bộ các xã/phường có nguy cơ sạt lở hoặc lũ quét.
                </li>
                <li>
                  <strong>Bộ lọc mạnh mẽ:</strong> Lọc theo 34 tỉnh trọng điểm, cấp nguy cơ (Rất cao, Cao, Trung bình), lượng mưa tối thiểu hoặc tìm kiếm theo tên địa danh.
                </li>
                <li>
                  <strong>Khảo sát thực địa & Trạm đo mưa:</strong> Xem 1.053 điểm sạt lở thực địa lịch sử và hơn 8.400 trạm đo mưa tự động toàn quốc.
                </li>
                <li>
                  <strong>Đa dạng định dạng xuất:</strong> Hỗ trợ xuất <strong>Excel (CSV)</strong>, <strong>JSON</strong>, <strong>GeoJSON (.geojson)</strong> trực tiếp cho bản đồ / GIS và tải lên Google Drive.
                </li>
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
