import React, { useEffect, useState } from 'react';
import { AlertOctagon, Download, ExternalLink, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react';
import DuplicateScanner from './DuplicateScanner';
import { checkRemoteConfig, getCachedRemoteConfig, RemoteConfig, CURRENT_APP_VERSION, isVersionOutdated } from '../utils/killSwitch';
import { Button } from './ui/Button';

const GlobalOverlays: React.FC = () => {
  const [showSortToast, setShowSortToast] = useState(false);
  const [showDuplicateScanner, setShowDuplicateScanner] = useState(false);
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>(() => getCachedRemoteConfig());
  const [dismissUpdateBanner, setDismissUpdateBanner] = useState(false);

  useEffect(() => {
    const showToast = () => {
      setShowSortToast(true);
      setTimeout(() => setShowSortToast(false), 3000);
    };
    const openDuplicateScanner = () => setShowDuplicateScanner(true);
    const closeDuplicateScanner = () => setShowDuplicateScanner(false);

    const handleKillSwitchEvent = (e: CustomEvent<RemoteConfig>) => {
      if (e.detail) {
        setRemoteConfig(e.detail);
      }
    };

    window.addEventListener('cinestream-show-sort-toast', showToast);
    window.addEventListener('cinestream-open-duplicate-scanner', openDuplicateScanner);
    window.addEventListener('cinestream-close-duplicate-scanner', closeDuplicateScanner);
    window.addEventListener('cinestream-kill-switch-status', handleKillSwitchEvent as EventListener);

    // Run initial remote kill switch / update check
    checkRemoteConfig().then(config => setRemoteConfig(config));

    // Periodic check every 10 minutes
    const interval = setInterval(() => {
      checkRemoteConfig().then(config => setRemoteConfig(config));
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener('cinestream-show-sort-toast', showToast);
      window.removeEventListener('cinestream-open-duplicate-scanner', openDuplicateScanner);
      window.removeEventListener('cinestream-close-duplicate-scanner', closeDuplicateScanner);
      window.removeEventListener('cinestream-kill-switch-status', handleKillSwitchEvent as EventListener);
      clearInterval(interval);
    };
  }, []);

  const handleOpenUpdateUrl = (url: string) => {
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const isKilled = remoteConfig.killed || isVersionOutdated(CURRENT_APP_VERSION, remoteConfig.minVersion);
  const isUpdateAvailable = isVersionOutdated(CURRENT_APP_VERSION, remoteConfig.latestVersion) || remoteConfig.updateRequired;

  return (
    <>
      {/* Toast Notification */}
      {showSortToast && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-[150] animate-in fade-in slide-in-from-bottom-5">
          Files organized ✓
        </div>
      )}

      {/* Duplicate Scanner Overlay */}
      {showDuplicateScanner && (
        <div className="fixed inset-0 flex items-start justify-center z-[200] p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#121212] z-10">
              <h3 className="font-bold text-lg text-white">Duplicate Scanner</h3>
              <button
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => window.dispatchEvent(new CustomEvent('cinestream-close-duplicate-scanner'))}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <DuplicateScanner onClose={() => window.dispatchEvent(new CustomEvent('cinestream-close-duplicate-scanner'))} />
            </div>
          </div>
        </div>
      )}

      {/* Non-blocking Update Available Banner */}
      {isUpdateAvailable && !isKilled && !dismissUpdateBanner && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] max-w-xl w-full px-4">
          <div className="bg-gradient-to-r from-red-950/90 via-zinc-900/95 to-black/95 backdrop-blur-xl border border-red-500/30 rounded-2xl p-4 shadow-2xl shadow-red-950/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">Update v{remoteConfig.latestVersion} Available</h4>
                  <span className="text-[10px] bg-red-600/30 text-red-300 font-semibold px-2 py-0.5 rounded-full border border-red-500/30">
                    New Release
                  </span>
                </div>
                <p className="text-xs text-gray-300 truncate max-w-md mt-0.5">
                  {remoteConfig.updateNotes || 'A new update with fixes & features is available.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleOpenUpdateUrl(remoteConfig.updateUrl)}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-0 text-xs px-3 py-1.5 font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Update
              </Button>
              <button
                onClick={() => setDismissUpdateBanner(true)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KILL SWITCH FULLSCREEN OVERLAY (Self-Destruct / Update Enforced Lock Screen) */}
      {isKilled && (
        <div className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 select-none">
          {/* Background Ambient Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/15 rounded-full blur-[140px] animate-pulse" />
          </div>

          <div className="relative max-w-lg w-full bg-[#0d0d0d] border border-red-500/40 rounded-3xl p-8 shadow-2xl shadow-red-950/80 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-red-600/20 to-red-900/40 border border-red-500/50 rounded-3xl flex items-center justify-center text-red-500 shadow-xl shadow-red-950/60 animate-bounce">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold uppercase tracking-wider">
                <AlertOctagon className="w-3.5 h-3.5" />
                App Disabled / Update Enforced
              </div>
              <h2 className="text-2xl font-black text-white">THEORA System Notice</h2>
            </div>

            <div className="bg-black/60 border border-white/10 rounded-2xl p-4 text-left">
              <p className="text-gray-200 text-sm leading-relaxed font-medium">
                {remoteConfig.killMessage || 'This version of the application has been remotely deactivated by the administrator. Please update to continue.'}
              </p>

              {remoteConfig.updateNotes && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Update Notes</span>
                  <p className="text-xs text-gray-400 italic">{remoteConfig.updateNotes}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-white/5 p-3 rounded-xl border border-white/5 font-mono text-gray-400">
              <div>Installed Version: <span className="text-red-400 font-bold">{CURRENT_APP_VERSION}</span></div>
              <div>Required Min Version: <span className="text-green-400 font-bold">{remoteConfig.minVersion}</span></div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={() => handleOpenUpdateUrl(remoteConfig.updateUrl)}
                className="w-full bg-gradient-to-r from-red-600 via-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 text-base transition-all transform hover:scale-[1.02]"
              >
                <Download className="w-5 h-5" />
                Download Required Update
                <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
              </Button>

              <button
                onClick={() => checkRemoteConfig().then(config => setRemoteConfig(config))}
                className="text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-check Server Status
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalOverlays;
