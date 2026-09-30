/**
 * Kill Switch & Remote Update Service
 * Enables remote administrative shutdown, targeted device bans, and update rollout enforcement.
 */

import { getOrCreateDeviceId } from './telemetry';

export interface RemoteConfig {
  killed: boolean;
  killedDevices?: string[]; // List of targeted Device IDs to block (e.g. ["THEORA-8F92A1"])
  killMessage: string;
  minVersion: string;
  latestVersion: string;
  updateRequired: boolean;
  updateUrl: string;
  updateNotes: string;
  lastChecked?: number;
}

export interface KillSwitchSettings {
  remoteUrl: string;
  simulatedKilled: boolean;
  autoCheckIntervalMinutes: number;
}

const STORAGE_KEY_SETTINGS = 'theora_killswitch_settings';
const STORAGE_KEY_CONFIG = 'theora_remote_config_cache';
export const CURRENT_APP_VERSION = '1.0.0';

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  killed: false,
  killedDevices: [],
  killMessage: 'Notice: This version of THEORA has been deactivated by the system administrator. Please install the latest update to continue watching.',
  minVersion: '1.0.0',
  latestVersion: '1.0.0',
  updateRequired: false,
  updateUrl: 'https://github.com/Benjaminax/cinema-stream/releases',
  updateNotes: 'Performance enhancements, security updates, and bug fixes.',
};

export const DEFAULT_KILLSWITCH_SETTINGS: KillSwitchSettings = {
  remoteUrl: 'https://gist.githubusercontent.com/Benjaminax/54b62912f1457d1911ee41b66c292c0d/raw/cinema_stream_config.json',
  simulatedKilled: false,
  autoCheckIntervalMinutes: 15,
};

export const getKillSwitchSettings = (): KillSwitchSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_KILLSWITCH_SETTINGS;
    return { ...DEFAULT_KILLSWITCH_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to parse kill switch settings:', err);
    return DEFAULT_KILLSWITCH_SETTINGS;
  }
};

export const saveKillSwitchSettings = (settings: Partial<KillSwitchSettings>) => {
  try {
    const current = getKillSwitchSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    // Immediately trigger status re-check
    checkRemoteConfig();
    return updated;
  } catch (err) {
    console.error('Failed to save kill switch settings:', err);
    return DEFAULT_KILLSWITCH_SETTINGS;
  }
};

export const getCachedRemoteConfig = (): RemoteConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_REMOTE_CONFIG;
    return { ...DEFAULT_REMOTE_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REMOTE_CONFIG;
  }
};

/**
 * Compare semantic versions (returns true if version A is smaller than version B)
 */
export const isVersionOutdated = (current: string, required: string): boolean => {
  if (!current || !required) return false;
  const partsA = current.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = required.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const a = partsA[i] || 0;
    const b = partsB[i] || 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
};

/**
 * Checks the remote endpoint for remote kill switch, targeted device bans, or update instructions
 */
export const checkRemoteConfig = async (): Promise<RemoteConfig> => {
  const settings = getKillSwitchSettings();
  let config: RemoteConfig = getCachedRemoteConfig();

  // If local developer simulation is enabled, override killed state
  if (settings.simulatedKilled) {
    config = {
      ...config,
      killed: true,
      killMessage: '[SIMULATED KILL SWITCH] App access has been blocked for testing update enforcement.',
    };
    emitKillSwitchEvent(config);
    return config;
  }

  if (settings.remoteUrl) {
    try {
      console.log('📡 Checking remote kill switch & update config from:', settings.remoteUrl);
      const res = await fetch(`${settings.remoteUrl}?_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const remoteData = await res.json();
        config = {
          ...DEFAULT_REMOTE_CONFIG,
          ...remoteData,
          lastChecked: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
        console.log('✅ Remote kill switch check complete:', config);
      } else {
        console.warn('⚠️ Remote config endpoint returned status:', res.status);
      }
    } catch (err) {
      console.error('❌ Failed to fetch remote config:', err);
    }
  }

  // Check targeted device ban list (e.g. killedDevices: ["THEORA-8F92A1"])
  const currentDeviceId = getOrCreateDeviceId();
  if (Array.isArray(config.killedDevices) && config.killedDevices.includes(currentDeviceId)) {
    config.killed = true;
    config.killMessage = `Device access (${currentDeviceId}) has been remotely deactivated by the administrator.`;
  }

  // Check if current version is below minVersion requirement
  if (isVersionOutdated(CURRENT_APP_VERSION, config.minVersion)) {
    config.killed = true;
    config.killMessage = `Version ${CURRENT_APP_VERSION} is no longer supported. Please update to version ${config.minVersion} or higher to continue.`;
  }

  emitKillSwitchEvent(config);
  return config;
};

const emitKillSwitchEvent = (config: RemoteConfig) => {
  try {
    window.dispatchEvent(
      new CustomEvent('cinestream-kill-switch-status', {
        detail: config,
      })
    );
  } catch (err) {
    console.error('Error dispatching kill switch event:', err);
  }
};

/**
 * Sample JSON schema helper for developers to host on GitHub Gist
 */
export const getSampleGistJson = (): string => {
  return JSON.stringify(
    {
      killed: false,
      killedDevices: ["THEORA-EXAMPLE-ID"],
      killMessage: 'Notice: This version of THEORA has been disabled by the administrator. Please download the latest update.',
      minVersion: '1.0.0',
      latestVersion: '1.0.1',
      updateRequired: false,
      updateUrl: 'https://github.com/Benjaminax/cinema-stream/releases',
      updateNotes: 'New streaming improvements, bug fixes, and feature updates.'
    },
    null,
    2
  );
};
