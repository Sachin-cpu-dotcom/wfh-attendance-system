import { fetchOrgSettingsRemote, updateOrgSettingsRemote } from "../services/googleService";

const KEY = "wfh_org_settings_cache";

const DEFAULTS = {
  idleTimeoutMinutes: 10,
};

// Synchronous read of the last-known settings (used for instant render).
// This is a CACHE — the source of truth is the backend Google Sheet, so the
// value here gets refreshed by syncOrgSettings() below.
export function getOrgSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function setCache(settings) {
  const merged = { ...getOrgSettings(), ...settings };
  localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

// Pulls the latest settings from the backend and refreshes the local cache.
// Call this on app/page load. Falls back silently to the cached/default
// value if the backend call fails (e.g. offline, or backend not updated yet).
export async function syncOrgSettings() {
  try {
    const remote = await fetchOrgSettingsRemote();
    if (remote && remote.success !== false) {
      return setCache(remote);
    }
  } catch (err) {
    console.warn("Couldn't sync org settings from backend, using cached value.", err);
  }
  return getOrgSettings();
}

// Saves settings to the backend so every device/browser sees the same value,
// and updates the local cache immediately for instant feedback.
export async function saveOrgSettings(partial) {
  setCache(partial); // optimistic local update
  try {
    const res = await updateOrgSettingsRemote(partial);
    if (res?.success === false) throw new Error(res.message || "Save failed");
    return { ok: true, settings: setCache(partial) };
  } catch (err) {
    console.error("Couldn't save org settings to backend:", err);
    return { ok: false, settings: getOrgSettings(), error: err };
  }
}
