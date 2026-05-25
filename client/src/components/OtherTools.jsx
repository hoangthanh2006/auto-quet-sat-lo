import { Wrench } from 'lucide-react';

export default function OtherTools() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-12 text-center transition-all duration-300">
      <Wrench className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 font-heading">Công cụ khác</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        Các tool lấy data khác sẽ được thêm vào đây khi có.
      </p>
    </div>
  );
}
