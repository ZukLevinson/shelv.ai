declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;
declare const __BUILD_TIME__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : import.meta.env.VITE_APP_VERSION || '1.0.0';

export const COMMIT_SHA: string =
  typeof __COMMIT_SHA__ !== 'undefined'
    ? __COMMIT_SHA__
    : import.meta.env.VITE_COMMIT_SHA || 'dev';

export const BUILD_TIME: string =
  typeof __BUILD_TIME__ !== 'undefined'
    ? __BUILD_TIME__
    : import.meta.env.VITE_BUILD_TIME || '';

export const GITHUB_COMMIT_URL: string | null =
  COMMIT_SHA && COMMIT_SHA !== 'dev'
    ? `https://github.com/ZukLevinson/shelv.ai/commit/${COMMIT_SHA}`
    : null;

export const getFormattedBuildTime = (): string => {
  if (!BUILD_TIME) return 'זמן פיתוח';
  try {
    const d = new Date(BUILD_TIME);
    if (isNaN(d.getTime())) return BUILD_TIME;
    return d.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return BUILD_TIME;
  }
};

export const getFullVersionSummary = (): string => {
  const time = getFormattedBuildTime();
  return `shelv.ai v${APP_VERSION} (commit: ${COMMIT_SHA}) | נבנה: ${time}`;
};

export const copyVersionToClipboard = async (): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(getFullVersionSummary());
    return true;
  } catch (err) {
    console.error('Failed to copy version to clipboard:', err);
    return false;
  }
};
