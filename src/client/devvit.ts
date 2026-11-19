// Thin wrapper around the Devvit client SDK.
//
// The game also runs as a plain web page for the local demo, where the SDK
// is absent, so the module is loaded lazily and every call has a fallback.

// The Reddit webview sets a global `devvit` object before the app loads.
// A plain browser tab has no such global, which is how the local demo is
// detected. The SDK calls below only post messages to a parent window, so
// without this check they would silently do nothing outside Reddit.
const inDevvitWebView = (): boolean =>
  typeof globalThis !== 'undefined' && 'devvit' in globalThis;

type DevvitClientModule = typeof import('@devvit/web/client');

let cached: DevvitClientModule | null | undefined;

const loadClient = async (): Promise<DevvitClientModule | null> => {
  if (cached !== undefined) return cached;
  try {
    cached = await import('@devvit/web/client');
  } catch {
    cached = null;
  }
  return cached;
};

export const showToast = async (text: string): Promise<void> => {
  if (!inDevvitWebView()) return;
  const client = await loadClient();
  if (!client) return;
  try {
    client.showToast(text);
  } catch {
    // Not running inside Reddit; the UI shows the same message inline.
  }
};

// Opens the expanded game view. Returns true when Reddit handled it.
export const expandToGame = async (event: MouseEvent): Promise<boolean> => {
  if (!inDevvitWebView()) return false;
  const client = await loadClient();
  if (!client) return false;
  try {
    client.requestExpandedMode(event, 'game');
    return true;
  } catch {
    return false;
  }
};
