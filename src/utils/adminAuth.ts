/**
 * Admin Authentication & Cryptographic Security Module
 * Hashed credential verification without storing plaintext email or passwords in code.
 */

const STORAGE_EMAIL_HASH_KEY = 'theora_admin_email_hash';
const STORAGE_PASS_HASH_KEY = 'theora_admin_pass_hash';
const SESSION_AUTH_KEY = 'theora_admin_session_token';

// Cryptographic SHA-256 hashes (Salted with _theora_salt_2026)
// No plaintext credentials are stored in code or memory
const DEFAULT_EMAIL_HASH = '731aa8438550a5ba596f1ac33a658147a1b6a8bb9b3277e9899a4c292f1363c9';
const DEFAULT_PASS_HASH = '1922adfa0f9d57e413b4e74ef51f9245738b96af299b33150f4540df6150fbf8';

/**
 * Hash input string using Web Crypto API (SHA-256)
 */
export const hashString = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input.trim().toLowerCase() + '_theora_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verifies admin credentials (user enters email & password manually)
 */
export const verifyAdminCredentials = async (emailInput: string, passInput: string): Promise<boolean> => {
  if (!emailInput || !passInput) return false;

  const computedEmailHash = await hashString(emailInput);
  const computedPassHash = await hashString(passInput);

  const storedEmailHash = localStorage.getItem(STORAGE_EMAIL_HASH_KEY) || DEFAULT_EMAIL_HASH;
  const storedPassHash = localStorage.getItem(STORAGE_PASS_HASH_KEY) || DEFAULT_PASS_HASH;

  if (computedEmailHash === storedEmailHash && computedPassHash === storedPassHash) {
    const sessionToken = await hashString(Date.now().toString() + computedEmailHash);
    sessionStorage.setItem(SESSION_AUTH_KEY, sessionToken);
    return true;
  }

  return false;
};

/**
 * Checks if current session is authenticated as Admin
 */
export const isAdminAuthenticated = (): boolean => {
  const token = sessionStorage.getItem(SESSION_AUTH_KEY);
  return Boolean(token && token.length > 10);
};

/**
 * Logs out admin session
 */
export const logoutAdmin = (): void => {
  sessionStorage.removeItem(SESSION_AUTH_KEY);
};

/**
 * Update Admin Credentials (hashed)
 */
export const updateAdminCredentials = async (
  currentEmail: string,
  currentPass: string,
  newEmail?: string,
  newPass?: string
): Promise<{ success: boolean; message: string }> => {
  const isValid = await verifyAdminCredentials(currentEmail, currentPass);
  if (!isValid) {
    return { success: false, message: 'Current credentials are incorrect' };
  }

  if (newEmail && newEmail.trim().length > 3) {
    const newEmailHash = await hashString(newEmail);
    localStorage.setItem(STORAGE_EMAIL_HASH_KEY, newEmailHash);
  }

  if (newPass && newPass.trim().length >= 6) {
    const newPassHash = await hashString(newPass);
    localStorage.setItem(STORAGE_PASS_HASH_KEY, newPassHash);
  }

  return { success: true, message: 'Admin credentials updated securely' };
};
