import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Settings as SettingsIcon,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileVideo,
  Tv,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  Zap,
  HardDrive,
  Mail,
  ShieldAlert,
  Send,
  Copy,
  Check,
  ExternalLink,
  Code,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  Shield,
  X
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { getTelemetryConfig, saveTelemetryConfig, notifyWatchEvent, TelemetryConfig } from '../utils/telemetry';
import { getKillSwitchSettings, saveKillSwitchSettings, checkRemoteConfig, getSampleGistJson, KillSwitchSettings, CURRENT_APP_VERSION } from '../utils/killSwitch';
import { verifyAdminCredentials, isAdminAuthenticated, logoutAdmin, updateAdminCredentials } from '../utils/adminAuth';

interface SortProgress {
  current: number;
  total: number;
  status: string;
}

interface SortResults {
  moved: number;
  skipped: number;
  skippedDownloading?: number;
  errors: string[];
}

const Settings: React.FC = () => {
  // Admin Authentication State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => isAdminAuthenticated());
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminEmailInput, setAdminEmailInput] = useState<string>('');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Change Admin Credentials Modal State
  const [showChangeCredsModal, setShowChangeCredsModal] = useState<boolean>(false);
  const [currentEmailVal, setCurrentEmailVal] = useState<string>('');
  const [currentPassVal, setCurrentPassVal] = useState<string>('');
  const [newEmailVal, setNewEmailVal] = useState<string>('');
  const [newPassVal, setNewPassVal] = useState<string>('');
  const [changeCredsStatus, setChangeCredsStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Normal Settings: Library & File Sorting State
  const [downloadsFolders, setDownloadsFolders] = useState<string[]>(['']);
  const [moviesFolder, setMoviesFolder] = useState<string>('');
  const [seriesFolder, setSeriesFolder] = useState<string>('');
  const [mediaExtensions] = useState<string[]>(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']);
  const [excludeDownloading, setExcludeDownloading] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theora_exclude_downloading');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [isSorting, setIsSorting] = useState(false);
  const [sortProgress, setSortProgress] = useState<SortProgress | null>(null);
  const [sortResults, setSortResults] = useState<SortResults | null>(null);

  // Telemetry & Watch Notification State
  const [telemetry, setTelemetry] = useState<TelemetryConfig>(() => getTelemetryConfig());
  const [testNotificationStatus, setTestNotificationStatus] = useState<{ loading: boolean; message?: string; success?: boolean } | null>(null);

  // Kill Switch State
  const [killSwitch, setKillSwitch] = useState<KillSwitchSettings>(() => getKillSwitchSettings());
  const [copiedGistJson, setCopiedGistJson] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [remoteCheckStatus, setRemoteCheckStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    initializeDefaultPaths();

    const handleProgress = (_event: any, progress: SortProgress) => {
      setSortProgress(progress);
    };

    if (window.electronAPI) {
      window.electronAPI.on('sorting-progress', handleProgress);
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeListener('sorting-progress', handleProgress);
      }
    };
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const success = await verifyAdminCredentials(adminEmailInput, adminPasswordInput);
      if (success) {
        setIsAdminUnlocked(true);
        setShowAdminLoginModal(false);
        setAdminEmailInput('');
        setAdminPasswordInput('');
        setAuthError(null);
      } else {
        setAuthError('Invalid admin email or password.');
      }
    } catch (err) {
      setAuthError('Authentication error occurred.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    setIsAdminUnlocked(false);
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeCredsStatus(null);

    const res = await updateAdminCredentials(
      currentEmailVal,
      currentPassVal,
      newEmailVal || undefined,
      newPassVal || undefined
    );

    setChangeCredsStatus(res);

    if (res.success) {
      setCurrentEmailVal('');
      setCurrentPassVal('');
      setNewEmailVal('');
      setNewPassVal('');
      setTimeout(() => setShowChangeCredsModal(false), 1500);
    }
  };

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('cinestream-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.downloadsFolders) setDownloadsFolders(settings.downloadsFolders);
        if (settings.moviesFolder) setMoviesFolder(settings.moviesFolder);
        if (settings.seriesFolder) setSeriesFolder(settings.seriesFolder);
        if (typeof settings.excludeDownloading === 'boolean') setExcludeDownloading(settings.excludeDownloading);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      const settings = {
        downloadsFolders,
        moviesFolder,
        seriesFolder,
        excludeDownloading
      };
      localStorage.setItem('cinestream-settings', JSON.stringify(settings));
      localStorage.setItem('theora_exclude_downloading', JSON.stringify(excludeDownloading));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  useEffect(() => {
    saveSettings();
  }, [downloadsFolders, moviesFolder, seriesFolder, excludeDownloading]);

  // Handle telemetry updates
  const handleUpdateTelemetry = (updated: Partial<TelemetryConfig>) => {
    const newConfig = saveTelemetryConfig(updated);
    setTelemetry(newConfig);
  };

  // Handle kill switch updates
  const handleUpdateKillSwitch = (updated: Partial<KillSwitchSettings>) => {
    const newSettings = saveKillSwitchSettings(updated);
    setKillSwitch(newSettings);
  };

  const handleSendTestNotification = async () => {
    setTestNotificationStatus({ loading: true });
    const res = await notifyWatchEvent(
      {
        title: 'Inception (Test Stream)',
        type: 'movie',
        path: 'C:\\Videos\\Movies\\Inception.2010.1080p.mkv',
      },
      true // force send
    );
    setTestNotificationStatus({ loading: false, message: res.message, success: res.success });
  };

  const handleManualKillCheck = async () => {
    setRemoteCheckStatus('Checking remote endpoint...');
    try {
      const config = await checkRemoteConfig();
      setRemoteCheckStatus(`Checked! Status: ${config.killed ? 'KILLED' : 'ACTIVE'} (Min version: v${config.minVersion})`);
    } catch (err) {
      setRemoteCheckStatus('Error checking remote config');
    }
  };

  const handleCopyGistJson = () => {
    navigator.clipboard.writeText(getSampleGistJson());
    setCopiedGistJson(true);
    setTimeout(() => setCopiedGistJson(false), 2000);
  };

  const initializeDefaultPaths = async () => {
    try {
      if (!window.electronAPI) return;

      const videosPath = await window.electronAPI.getVideosPath();
      const downloadsInfo = await window.electronAPI.getDownloadsPath();

      setMoviesFolder(prev => prev || `${videosPath}\\Movies`);
      setSeriesFolder(prev => prev || `${videosPath}\\Series`);

      setDownloadsFolders(prev => {
        if (prev.length > 0 && prev[0] !== '') return prev;
        const defaultFolders = [];
        if (downloadsInfo.downloads) defaultFolders.push(downloadsInfo.downloads);
        if (downloadsInfo.telegram) defaultFolders.push(downloadsInfo.telegram);
        return defaultFolders.length > 0 ? defaultFolders : [''];
      });
    } catch (error) {
      console.error('Error initializing paths:', error);
    }
  };

  const handleAddDownloadsFolder = () => {
    setDownloadsFolders([...downloadsFolders, '']);
  };

  const handleRemoveDownloadsFolder = (index: number) => {
    setDownloadsFolders(downloadsFolders.filter((_, i) => i !== index));
  };

  const handleDownloadsFolderChange = (index: number, value: string) => {
    const updated = [...downloadsFolders];
    updated[index] = value;
    setDownloadsFolders(updated);
  };

  const handleBrowseFolder = async (type: 'downloads' | 'movies' | 'series', index?: number) => {
    if (!window.electronAPI) return;

    try {
      const selectedFolder = await window.electronAPI.selectFolder();
      if (selectedFolder) {
        if (type === 'downloads' && index !== undefined) {
          const updated = [...downloadsFolders];
          updated[index] = selectedFolder;
          setDownloadsFolders(updated);
        } else if (type === 'movies') {
          setMoviesFolder(selectedFolder);
        } else if (type === 'series') {
          setSeriesFolder(selectedFolder);
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleSortFiles = async () => {
    if (!window.electronAPI) return;

    setIsSorting(true);
    setSortProgress(null);
    setSortResults(null);

    try {
      const options = {
        downloadsFolders: downloadsFolders.filter(f => f.trim() !== ''),
        moviesFolder: moviesFolder.trim(),
        seriesFolder: seriesFolder.trim(),
        mediaExtensions,
        excludeDownloading
      };

      const results = await window.electronAPI.sortFiles(options);

      const filteredErrors = (results?.errors || []).filter((msg: string) => {
        return !/ENOENT.*rename/i.test(msg);
      });

      setSortResults({
        ...results,
        errors: filteredErrors,
      });
    } catch (error) {
      console.error('Error sorting files:', error);
      setSortResults({ moved: 0, skipped: 0, errors: [error instanceof Error ? error.message : String(error)] });
    } finally {
      setIsSorting(false);
      setSortProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-12 overflow-x-hidden relative">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-red-900/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-900/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-900 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/30">
                <SettingsIcon className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
            </div>
            <p className="text-gray-400 text-sm ml-13">Configure media library folders, automation, and system options</p>
          </div>

          {/* ACCESS ADMIN CONTROLS BUTTON / ADMIN UNLOCKED STATUS */}
          {!isAdminUnlocked ? (
            <Button
              onClick={() => {
                setAuthError(null);
                setShowAdminLoginModal(true);
              }}
              className="bg-gradient-to-r from-red-600 via-red-700 to-red-900 hover:from-red-500 hover:to-red-800 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-red-900/40 text-xs flex items-center gap-2 border border-red-500/30 transition-all hover:scale-[1.02]"
            >
              <Shield className="w-4 h-4 text-white" />
              Access Admin Controls
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span>Admin Unlocked</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowChangeCredsModal(true)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs px-3 py-1.5 text-gray-300"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Credentials
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAdminLogout}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Lock Admin Controls
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* ADMIN-ONLY UNLOCKED SECTIONS */}
          {isAdminUnlocked && (
            <>
              {/* SECTION: WATCH TELEMETRY & EMAIL ALERTS */}
              <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
                  <div className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <Mail className="h-4 w-4 text-red-500" />
                  </div>
                  Watch Telemetry & Email Notifications (Admin Only)
                </h2>

                <div className="bg-[#121212]/80 backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Watch Tracking Email Alerts</h3>
                      <p className="text-xs text-gray-400">Receive instant email/webhook notifications whenever anyone watches content</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={telemetry.enabled}
                        onChange={(e) => handleUpdateTelemetry({ enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-300">Recipient Email Address</label>
                      <Input
                        value={telemetry.recipientEmail}
                        onChange={(e) => handleUpdateTelemetry({ recipientEmail: e.target.value })}
                        placeholder="kojoben29@gmail.com"
                        icon={<Mail className="h-3.5 w-3.5" />}
                        className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-300">Resend API Key (for Direct Email Sending)</label>
                      <Input
                        type="password"
                        value={telemetry.resendApiKey}
                        onChange={(e) => handleUpdateTelemetry({ resendApiKey: e.target.value })}
                        placeholder="re_a5Z4DRA8_..."
                        icon={<Key className="h-3.5 w-3.5" />}
                        className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-medium text-gray-300">Webhook URL (Discord / Formspree / Custom API - Optional)</label>
                    <Input
                      value={telemetry.webhookUrl}
                      onChange={(e) => handleUpdateTelemetry({ webhookUrl: e.target.value })}
                      placeholder="https://discord.com/api/webhooks/... or Formspree endpoint"
                      icon={<Zap className="h-3.5 w-3.5" />}
                      className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-gray-400">
                      Rate Limit: <span className="text-white font-medium">{telemetry.rateLimitMinutes} min</span> between repeated watch alerts for the same item.
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSendTestNotification}
                      isLoading={testNotificationStatus?.loading}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs px-4 py-2 flex items-center gap-1.5 text-white"
                    >
                      <Send className="h-3.5 w-3.5 text-red-500" />
                      Send Test Notification
                    </Button>
                  </div>

                  {testNotificationStatus?.message && (
                    <div className={`p-3 rounded-lg text-xs border ${testNotificationStatus.success ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                      {testNotificationStatus.message}
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION: KILL SWITCH & REMOTE UPDATES */}
              <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
                  <div className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                  </div>
                  Kill Switch & Remote Update Enforcer (Admin Only)
                </h2>

                <div className="bg-[#121212]/80 backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div>
                    <h3 className="text-sm font-bold text-white">Remote Admin Endpoint</h3>
                    <p className="text-xs text-gray-400">
                      Host a JSON file (e.g., on raw GitHub Gist or custom URL) to remotely block app usage or enforce updates instantly.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-300">Remote Config URL (Raw GitHub Gist / JSON Bin)</label>
                    <div className="flex gap-2">
                      <Input
                        value={killSwitch.remoteUrl}
                        onChange={(e) => handleUpdateKillSwitch({ remoteUrl: e.target.value })}
                        placeholder="https://gist.githubusercontent.com/.../raw/remote_config.json"
                        icon={<ExternalLink className="h-3.5 w-3.5" />}
                        className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2"
                      />
                      <Button
                        variant="secondary"
                        onClick={handleManualKillCheck}
                        className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-4 py-2 text-xs text-white"
                      >
                        Check Now
                      </Button>
                    </div>
                  </div>

                  {remoteCheckStatus && (
                    <p className="text-xs text-red-400 font-mono">{remoteCheckStatus}</p>
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={killSwitch.simulatedKilled}
                        onChange={(e) => handleUpdateKillSwitch({ simulatedKilled: e.target.checked })}
                        className="rounded border-gray-700 bg-white/5 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer accent-red-600"
                      />
                      <span className="font-semibold text-red-400">Simulate Local Kill Switch Lock Screen</span>
                    </label>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowJsonModal(true)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs px-3 py-1.5 text-gray-300 flex items-center gap-1.5"
                      >
                        <Code className="h-3.5 w-3.5 text-red-500" />
                        View Gist Template
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyGistJson}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs px-3 py-1.5 text-gray-300 flex items-center gap-1.5"
                      >
                        {copiedGistJson ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedGistJson ? 'Copied!' : 'Copy JSON'}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* NORMAL SETTINGS SECTION 1: LIBRARY LOCATIONS (ALWAYS VISIBLE TO EVERYONE) */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <HardDrive className="h-4 w-4 text-red-500" />
              </div>
              Library Locations
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Movies Library</label>
                  <div className="flex gap-2">
                    <Input
                      value={moviesFolder}
                      onChange={(e) => setMoviesFolder(e.target.value)}
                      placeholder="Select movies folder..."
                      icon={<FileVideo className="h-3.5 w-3.5" />}
                      readOnly
                      onClick={() => handleBrowseFolder('movies')}
                      className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2 cursor-pointer hover:bg-black/60 transition-colors"
                    />
                    <Button
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleBrowseFolder('movies'); }}
                      className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-2 text-xs"
                    >
                      Browse
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Series Library</label>
                  <div className="flex gap-2">
                    <Input
                      value={seriesFolder}
                      onChange={(e) => setSeriesFolder(e.target.value)}
                      placeholder="Select series folder..."
                      icon={<Tv className="h-3.5 w-3.5" />}
                      readOnly
                      onClick={() => handleBrowseFolder('series')}
                      className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2 cursor-pointer hover:bg-black/60 transition-colors"
                    />
                    <Button
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleBrowseFolder('series'); }}
                      className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-2 text-xs"
                    >
                      Browse
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* NORMAL SETTINGS SECTION 2: SOURCE FOLDERS (ALWAYS VISIBLE TO EVERYONE) */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <Download className="h-4 w-4 text-red-500" />
              </div>
              Source Folders
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-3">
              <div className="space-y-2">
                {downloadsFolders.map((folder, index) => (
                  <div key={index} className="flex gap-2 group/row">
                    <Input
                      value={folder}
                      onChange={(e) => handleDownloadsFolderChange(index, e.target.value)}
                      placeholder="e.g. Downloads folder path"
                      icon={<FolderOpen className="h-3.5 w-3.5" />}
                      className="flex-1 bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2"
                      rightElement={
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleBrowseFolder('downloads', index)}
                          className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-xs mr-1 py-1"
                        >
                          Browse
                        </Button>
                      }
                    />
                    {downloadsFolders.length > 1 && (
                      <Button
                        variant="danger"
                        onClick={() => handleRemoveDownloadsFolder(index)}
                        className="px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 opacity-0 group-hover/row:opacity-100 transition-all"
                        aria-label="Remove folder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={handleAddDownloadsFolder}
                className="w-full border-dashed border border-white/10 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded-lg py-2.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Another Source</span>
                </div>
              </Button>
            </div>
          </section>

          {/* NORMAL SETTINGS SECTION 3: AUTOMATION (ALWAYS VISIBLE TO EVERYONE) */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <Zap className="h-4 w-4 text-red-500" />
              </div>
              Automation
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1">Organize Library</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Scans source folders and organizes media into your library
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer mt-2.5 text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={excludeDownloading}
                      onChange={(e) => setExcludeDownloading(e.target.checked)}
                      className="rounded border-gray-700 bg-white/5 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer accent-red-600"
                    />
                    <span>Exclude files that are still downloading (active torrents, .part, .crdownload, locked files)</span>
                  </label>
                </div>
                <Button
                  onClick={handleSortFiles}
                  isLoading={isSorting}
                  disabled={isSorting || !moviesFolder || !seriesFolder}
                  className="w-full md:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-0 shadow-lg shadow-red-900/40 rounded-lg py-2.5 px-6 font-semibold text-sm"
                >
                  {isSorting ? 'Processing...' : 'Start Organization'}
                </Button>
              </div>

              {sortProgress && (
                <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5">
                  <div className="flex justify-between text-xs mb-2 font-medium">
                    <span className="text-gray-300 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3 animate-spin text-red-500" />
                      {sortProgress.status}
                    </span>
                    <span className="text-white font-mono">
                      {Math.round((sortProgress.current / sortProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800/50 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-600 to-red-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(sortProgress.current / sortProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {sortResults && (
                <div className={`mt-4 p-4 rounded-xl border ${sortResults.errors.length > 0
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-green-500/5 border-green-500/20'
                  }`}>
                  <div className="flex items-start gap-3">
                    {sortResults.errors.length > 0 ? (
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-bold text-sm mb-2 ${sortResults.errors.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {sortResults.errors.length > 0 ? 'Completed with Issues' : 'Success'}
                      </h4>
                      <div className="flex gap-6 text-xs text-gray-300 mb-2 flex-wrap">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-[10px] uppercase">Moved</span>
                          <span className="text-lg font-bold text-white">{sortResults.moved}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-[10px] uppercase">Skipped</span>
                          <span className="text-lg font-bold text-white">{sortResults.skipped}</span>
                        </div>
                        {sortResults.skippedDownloading !== undefined && sortResults.skippedDownloading > 0 && (
                          <div className="flex flex-col">
                            <span className="text-amber-500 text-[10px] uppercase font-semibold">Still Downloading</span>
                            <span className="text-lg font-bold text-amber-400">{sortResults.skippedDownloading}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* NORMAL SETTINGS SECTION 4: MAINTENANCE (ALWAYS VISIBLE TO EVERYONE) */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              Maintenance
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">Duplicate Scanner</h3>
                <p className="text-gray-400 text-xs">Find and remove duplicate media files</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => window.dispatchEvent(new CustomEvent('cinestream-open-duplicate-scanner'))}
                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-5 py-2 text-sm"
              >
                Open Scanner
              </Button>
            </div>
          </section>

          {/* App Info Footer */}
          <div className="pt-6 border-t border-white/5 text-center text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded overflow-hidden bg-black border border-white/15 flex items-center justify-center shadow">
                <img src="/logo.png" alt="THEORA" className="w-full h-full object-cover" />
              </div>
              <span className="font-semibold text-gray-400">THEORA <span className="font-normal text-gray-600">v{CURRENT_APP_VERSION}</span></span>
            </div>
            <span>© 2026 <strong className="text-gray-400 font-medium">Benjamin Inc.</strong> All rights reserved.</span>
          </div>
        </div>
      </div>

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[#121212] border border-red-500/30 rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl shadow-red-950/50">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600/20 border border-red-500/30 rounded-2xl text-red-500">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Access Admin Controls</h3>
                  <p className="text-xs text-gray-400">Enter your admin credentials to unlock</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdminLoginModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Admin Email</label>
                <Input
                  type="email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="Enter admin email..."
                  icon={<Mail className="h-4 w-4" />}
                  required
                  autoFocus
                  className="bg-black/50 border-white/10 focus:border-red-500/50 rounded-xl text-sm py-2.5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Admin Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter admin password..."
                    icon={<Lock className="h-4 w-4" />}
                    required
                    className="bg-black/50 border-white/10 focus:border-red-500/50 rounded-xl text-sm py-2.5 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2.5 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isLoggingIn}
                  className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  Unlock Controls
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JSON Schema Template Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#121212] border border-white/10 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Code className="h-5 w-5 text-red-500" />
                Remote Config JSON Template
              </h3>
              <button onClick={() => setShowJsonModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-300">
              Create a raw Gist file on GitHub (or host on a server) with this exact JSON format. Paste the raw URL in the settings above to remotely control app access and rollout updates.
            </p>
            <pre className="bg-black/80 border border-white/10 p-4 rounded-xl text-xs font-mono text-green-400 overflow-x-auto max-h-60 select-all">
              {getSampleGistJson()}
            </pre>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyGistJson}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs px-4 py-2"
              >
                {copiedGistJson ? 'Copied to Clipboard!' : 'Copy Template JSON'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Credentials Modal */}
      {showChangeCredsModal && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#121212] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                Update Admin Credentials
              </h3>
              <button onClick={() => setShowChangeCredsModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeCredentials} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Current Admin Email</label>
                <Input
                  type="email"
                  value={currentEmailVal}
                  onChange={(e) => setCurrentEmailVal(e.target.value)}
                  placeholder="Enter current email"
                  required
                  className="bg-black/40 border-white/10 rounded-lg text-sm py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Current Admin Password</label>
                <Input
                  type="password"
                  value={currentPassVal}
                  onChange={(e) => setCurrentPassVal(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="bg-black/40 border-white/10 rounded-lg text-sm py-2"
                />
              </div>

              <div className="border-t border-white/10 pt-3 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">New Admin Email (Optional)</label>
                  <Input
                    type="email"
                    value={newEmailVal}
                    onChange={(e) => setNewEmailVal(e.target.value)}
                    placeholder="Enter new email (or leave blank)"
                    className="bg-black/40 border-white/10 rounded-lg text-sm py-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">New Admin Password (Optional)</label>
                  <Input
                    type="password"
                    value={newPassVal}
                    onChange={(e) => setNewPassVal(e.target.value)}
                    placeholder="Enter new password (or leave blank)"
                    className="bg-black/40 border-white/10 rounded-lg text-sm py-2"
                  />
                </div>
              </div>

              {changeCredsStatus && (
                <div className={`p-3 rounded-lg text-xs border ${changeCredsStatus.success ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                  {changeCredsStatus.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowChangeCredsModal(false)}
                  className="bg-white/5 text-gray-300 text-xs px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-xs px-4 py-2"
                >
                  Save Credentials
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
