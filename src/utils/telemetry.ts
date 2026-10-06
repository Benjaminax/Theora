/**
 * Watch Telemetry & Email Notification Service
 * Sends notification details via Resend API and/or Webhook endpoints whenever a user launches the app or streams media.
 */

export interface TelemetryConfig {
  enabled: boolean;
  recipientEmail: string;
  resendApiKey: string;
  webhookUrl: string;
  rateLimitMinutes: number;
}

export interface WatchMediaPayload {
  title: string;
  type?: string;
  path?: string;
  season?: number;
  episode?: number;
  poster_path?: string;
  at?: number;
}

const STORAGE_KEY = 'theora_telemetry_settings';
const RECENT_NOTIFICATIONS_KEY = 'theora_telemetry_recent';
const DEVICE_ID_KEY = 'theora_device_installation_id';
const LAST_LAUNCH_PING_KEY = 'theora_last_launch_ping';

const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: true,
  recipientEmail: 'kojoben29@gmail.com',
  resendApiKey: (import.meta.env?.VITE_RESEND_API_KEY as string) || '',
  webhookUrl: '',
  rateLimitMinutes: 3,
};

export const getOrCreateDeviceId = (): string => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
      id = `THEORA-${randomStr}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'THEORA-DEV-UNKNOWN';
  }
};

export const getExtractedUserName = async (): Promise<string> => {
  try {
    if (window.electronAPI && typeof window.electronAPI.getUserName === 'function') {
      const name = await window.electronAPI.getUserName();
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }
  } catch (err) {
    console.error('Error fetching extracted user name:', err);
  }
  return 'User Profile';
};

export const getTelemetryConfig = (): TelemetryConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to parse telemetry settings:', err);
    return DEFAULT_CONFIG;
  }
};

export const saveTelemetryConfig = (config: Partial<TelemetryConfig>) => {
  try {
    const current = getTelemetryConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save telemetry settings:', err);
    return DEFAULT_CONFIG;
  }
};

/**
 * Checks if media was recently notified to avoid spamming multiple emails/webhooks
 */
const shouldRateLimit = (title: string, rateLimitMinutes: number): boolean => {
  try {
    const raw = localStorage.getItem(RECENT_NOTIFICATIONS_KEY);
    const recent: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();

    if (recent[title] && now - recent[title] < rateLimitMinutes * 60 * 1000) {
      return true; // Should rate limit
    }

    recent[title] = now;
    localStorage.setItem(RECENT_NOTIFICATIONS_KEY, JSON.stringify(recent));
    return false;
  } catch {
    return false;
  }
};

/**
 * Fetch device and environment context for telemetry
 */
const getDeviceContext = (username: string) => {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';

  return {
    deviceId: getOrCreateDeviceId(),
    username,
    os,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    appVersion: '1.0.0',
    platform: window.electronAPI ? 'Desktop (Electron)' : 'Web Browser',
    timestamp: new Date().toISOString(),
  };
};

/**
 * Dispatch email via Resend API (https://resend.com)
 */
export const sendResendEmail = async (
  subject: string,
  text: string,
  toEmail?: string,
  apiKey?: string
): Promise<{ success: boolean; message?: string }> => {
  const config = getTelemetryConfig();
  const key = apiKey || config.resendApiKey || (import.meta.env?.VITE_RESEND_API_KEY as string) || '';
  const recipient = toEmail || config.recipientEmail || 'kojoben29@gmail.com';

  if (!key) {
    return { success: false, message: 'No Resend API key configured' };
  }

  try {
    console.log(`📧 Dispatching email to ${recipient} via Resend API...`);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'THEORA Telemetry <onboarding@resend.dev>',
        to: [recipient],
        subject: subject,
        text: text,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log('✅ Resend Email dispatched successfully:', data);
      return { success: true, message: `Email sent to ${recipient} via Resend!` };
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn('⚠️ Resend API returned status:', res.status, errData);
      return { success: false, message: `Resend error (${res.status}): ${errData.message || res.statusText}` };
    }
  } catch (err) {
    console.error('❌ Failed to dispatch Resend email:', err);
    return { success: false, message: err instanceof Error ? err.message : 'Network error sending email via Resend' };
  }
};

/**
 * Sends an activation alert whenever a user launches the app on their PC
 */
export const notifyAppLaunch = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const lastPing = localStorage.getItem(LAST_LAUNCH_PING_KEY);
    const now = Date.now();

    // Ping at most once per 6 hours per device instance to avoid spamming
    if (lastPing && now - parseInt(lastPing, 10) < 6 * 60 * 60 * 1000) {
      return { success: false, message: 'Launch already logged recently' };
    }

    const config = getTelemetryConfig();
    const username = await getExtractedUserName();
    const device = getDeviceContext(username);

    const subject = `🚀 [THEORA Activation] App Launched by Profile: ${device.username}`;
    const message = `🚀 [THEORA App Active]\n` +
                    `User Profile: ${device.username}\n` +
                    `Device ID: ${device.deviceId}\n` +
                    `Platform: ${device.platform} (${device.os})\n` +
                    `Resolution: ${device.screenResolution}\n` +
                    `Timestamp: ${device.timestamp}`;

    const payload = {
      event: 'APP_LAUNCHED',
      device,
      message,
      embeds: [
        {
          title: subject,
          color: 3066993, // Blue/Green
          fields: [
            { name: 'Profile / PC User', value: device.username, inline: true },
            { name: 'Device ID', value: device.deviceId, inline: true },
            { name: 'OS / Platform', value: `${device.platform} (${device.os})`, inline: true },
            { name: 'Screen Resolution', value: device.screenResolution, inline: true },
            { name: 'Timestamp', value: device.timestamp, inline: false },
          ],
          footer: { text: `THEORA v${device.appVersion} • Device Activation Telemetry` }
        }
      ]
    };

    console.log('📡 Dispatching App Launch Activation:', payload);

    let emailSent = false;
    let webhookSent = false;

    // Dispatch Resend Email if API key exists
    if (config.resendApiKey) {
      const emailRes = await sendResendEmail(subject, message);
      emailSent = emailRes.success;
    }

    // Dispatch Webhook if URL exists
    if (config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        webhookSent = true;
      } catch (e) {
        console.error('Webhook error:', e);
      }
    }

    localStorage.setItem(LAST_LAUNCH_PING_KEY, now.toString());
    return {
      success: emailSent || webhookSent || true,
      message: `App launch logged (Email: ${emailSent ? 'OK' : 'Skipped'}, Webhook: ${webhookSent ? 'OK' : 'Skipped'})`
    };
  } catch (err) {
    console.error('Error logging app launch:', err);
    return { success: false, message: 'Launch logging failed' };
  }
};

/**
 * Main function to notify when a user watches content
 */
export const notifyWatchEvent = async (item: WatchMediaPayload, force: boolean = false): Promise<{ success: boolean; message?: string }> => {
  const config = getTelemetryConfig();

  if (!config.enabled && !force) {
    return { success: false, message: 'Telemetry is disabled' };
  }

  const title = item.title || item.path || 'Unknown Title';

  if (!force && shouldRateLimit(title, config.rateLimitMinutes)) {
    console.log('⏳ Telemetry rate-limited for:', title);
    return { success: false, message: 'Rate limited (notification sent recently)' };
  }

  const username = await getExtractedUserName();
  const device = getDeviceContext(username);
  const mediaType = item.type ? item.type.toUpperCase() : 'MEDIA';
  const episodeStr = item.season && item.episode ? ` (S${item.season}E${item.episode})` : '';

  const emailSubject = `🎬 [THEORA Watch Alert] Profile "${device.username}" (${device.deviceId}) watched ${title}${episodeStr}`;
  const emailMessage = `User Profile "${device.username}" on Device "${device.deviceId}" has started watching "${title}${episodeStr}" on ${device.platform} (${device.os}).\n\n` +
                       `Details:\n` +
                       `- Media Title: ${title}${episodeStr}\n` +
                       `- Type: ${mediaType}\n` +
                       `- Device ID: ${device.deviceId}\n` +
                       `- Platform: ${device.platform} (${device.os})\n` +
                       `- Timestamp: ${device.timestamp}\n` +
                       `- File / Source: ${item.path || 'TMDB Stream'}\n`;

  const payload = {
    event: 'MEDIA_WATCHED',
    media: {
      title,
      type: mediaType,
      season: item.season,
      episode: item.episode,
      path: item.path,
      watchedAt: device.timestamp
    },
    device,
    recipientEmail: config.recipientEmail || 'kojoben29@gmail.com',
    subject: emailSubject,
    message: emailMessage,
    embeds: [
      {
        title: `🎬 Profile "${device.username}" Watching: ${title}${episodeStr}`,
        color: 15158332, // Red
        fields: [
          { name: 'Profile / PC User', value: device.username, inline: true },
          { name: 'Media Title', value: title, inline: true },
          { name: 'Type', value: mediaType, inline: true },
          { name: 'Device ID', value: device.deviceId, inline: true },
          { name: 'Platform', value: `${device.platform} (${device.os})`, inline: true },
          { name: 'Timestamp', value: device.timestamp, inline: false },
          { name: 'Path/Source', value: item.path || 'TMDB / Web Stream', inline: false }
        ],
        footer: { text: `THEORA v${device.appVersion} • Watch Telemetry` }
      }
    ]
  };

  console.log('📡 Sending watch notification:', payload);

  let emailResult = { success: false, message: '' };

  // Dispatch email via Resend API
  if (config.resendApiKey) {
    const res = await sendResendEmail(emailSubject, emailMessage, config.recipientEmail, config.resendApiKey);
    emailResult = { success: res.success, message: res.message || '' };
  }

  // Also dispatch to Webhook URL if set
  if (config.webhookUrl) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log('✅ Watch notification delivered successfully to Webhook');
      } else {
        console.warn('⚠️ Webhook server responded with status:', res.status);
      }
    } catch (err) {
      console.error('❌ Failed to dispatch telemetry webhook:', err);
    }
  }

  if (emailResult.success) {
    return emailResult;
  }

  return { success: true, message: emailResult.message || 'Notification dispatched' };
};
