import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, AlertTriangle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { RaloaLogo } from './brand/RaloaLogo';
import { getInitialLocale } from '../utils/locale';
import { getInitialTheme } from '../utils/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  detailsOpen: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    detailsOpen: false,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Log to console for diagnostic reporting
    console.error('RALOA ErrorBoundary caught an unexpected runtime crash:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    // If onReset handler provided, trigger it
    if (this.props.onReset) {
      this.props.onReset();
    }
    // Clear hash/query and navigate to root cleanly
    window.location.href = '/';
  };

  private handleCopyError = (): void => {
    const errorDetails = [
      `RALOA Application Error Report`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `Error: ${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown error'}`,
      `Stack:\n${this.state.error?.stack || 'No stack trace'}`,
      `Component Stack:\n${this.state.errorInfo?.componentStack || 'No component stack'}`
    ].join('\n\n');

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const locale = getInitialLocale();
      const isRtl = locale === 'ar';
      const theme = getInitialTheme();
      const isDark = theme === 'dark';

      return (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-200 ${
            isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
          }`}
        >
          <div
            className={`w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all ${
              isDark
                ? 'bg-slate-900/90 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl'
                : 'bg-white border-slate-200/80 shadow-[0_20px_50px_rgba(15,23,42,0.08)]'
            }`}
          >
            {/* Logo and Brand Header */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-200/80 dark:border-slate-800">
              <RaloaLogo isRtl={isRtl} theme={isDark ? 'on-dark' : 'primary'} size="sm" />
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isRtl ? 'خطأ بالنظام' : 'System Guard'}</span>
              </span>
            </div>

            {/* Error Message Header */}
            <div className="pt-6 text-center sm:text-start rtl:sm:text-right">
              <div className="w-14 h-14 rounded-2xl bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto sm:mx-0 mb-4 shadow-xs">
                <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
                {isRtl ? 'حدث خطأ غير متوقع' : 'Something unexpected happened'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isRtl
                  ? 'واجه التطبيق مشكلة مؤقتة أثناء معالجة طلبك. تم حماية بياناتك ويمكنك إعادة تحميل الصفحة أو العودة للرئيسية.'
                  : 'An unexpected runtime issue occurred. Your data has been safeguarded, and you can safely reload the page or head back to the home screen.'}
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{isRtl ? 'إعادة تحميل الصفحة' : 'Reload Page'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto py-3 px-5 rounded-2xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.99] font-bold text-sm text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <Home className="w-4 h-4" />
                <span>{isRtl ? 'الرئيسية' : 'Back to Home'}</span>
              </button>
            </div>

            {/* Collapsible Diagnostic Technical Details */}
            {this.state.error && (
              <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => this.setState({ detailsOpen: !this.state.detailsOpen })}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors py-1 cursor-pointer"
                >
                  <span>{isRtl ? 'التفاصيل التقنية للخطأ' : 'Technical Details'}</span>
                  {this.state.detailsOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {this.state.detailsOpen && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left font-mono text-[11px] overflow-hidden">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-rose-600 dark:text-rose-400 font-bold truncate max-w-[280px]">
                        {this.state.error.name}: {this.state.error.message}
                      </span>
                      <button
                        type="button"
                        onClick={this.handleCopyError}
                        className="flex items-center gap-1 text-[10px] font-sans font-bold px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={isRtl ? 'نسخ تفاصيل الخطأ' : 'Copy error details'}
                      >
                        {this.state.copied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{isRtl ? 'تم النسخ' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{isRtl ? 'نسخ' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="max-h-40 overflow-y-auto text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words leading-relaxed select-all">
                      {this.state.error.stack || this.state.error.message}
                      {this.state.errorInfo?.componentStack && `\n\nComponent Stack:${this.state.errorInfo.componentStack}`}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
