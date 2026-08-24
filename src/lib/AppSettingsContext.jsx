import { createContext, useContext, useState, useEffect } from 'react';

const SETTINGS_KEY = 'washek_app_settings';

// Apply the dark class before React renders so the light system theme cannot
// flash on first paint. Dark is the app default.
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
  document.documentElement.classList.remove('light');
}

const defaultSettings = {
  country: 'US',
  language: 'English',
  unit: 'imperial', // 'metric' | 'imperial'
  theme: 'dark',    // 'dark' | 'light'
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const stored = raw ? { ...defaultSettings, ...JSON.parse(raw) } : null;
    if (stored) return stored;
    // No stored settings — use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return { ...defaultSettings, theme: 'dark' };
  } catch {
    return defaultSettings;
  }
}

// Check if the user has manually set a theme preference
function hasManualThemePreference() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.theme != null;
  } catch {
    return false;
  }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [settings.theme]);

  // Apply language to <html> lang attribute
  useEffect(() => {
    document.documentElement.lang = settings.language || 'en';
  }, [settings.language]);

  // Listen for system theme changes — only if no manual preference set
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (!hasManualThemePreference()) {
        updateSettings({ theme: e.matches ? 'dark' : 'light' });
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const updateSettings = (patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

// ── Unit display helpers ──────────────────────────────────

/** Convert a weight value stored in lbs to display string */
export function displayWeight(value, unit) {
  if (!value && value !== 0) return '—';
  if (unit === 'metric') return `${(parseFloat(value) * 0.453592).toFixed(1)} kg`;
  return `${value} lbs`;
}

/** Convert a weight INPUT: if user is in metric, they typed kg — convert to lbs for storage */
export function inputWeightToLbs(value, unit) {
  if (unit === 'metric') return (parseFloat(value) / 0.453592).toFixed(1);
  return parseFloat(value);
}

/** Convert stored lbs to display input value */
export function lbsToInputWeight(lbs, unit) {
  if (unit === 'metric') return (parseFloat(lbs) * 0.453592).toFixed(1);
  return lbs;
}

/** Convert stored inches to display string */
export function displayHeight(inches, unit) {
  if (!inches && inches !== 0) return '—';
  if (unit === 'metric') return `${(parseFloat(inches) * 2.54).toFixed(0)} cm`;
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches % 12);
  return `${ft}'${inch}"`;
}

/** Weight unit label */
export function weightUnit(unit) {
  return unit === 'metric' ? 'kg' : 'lbs';
}

/** Height unit label */
export function heightUnit(unit) {
  return unit === 'metric' ? 'cm' : 'ft / in';
}