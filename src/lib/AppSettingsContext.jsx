
import { createContext, useContext, useState, useEffect } from 'react';

const SETTINGS_KEY = 'washek_app_settings';

const defaultSettings = {
  country: 'US',
  language: 'English',
  unit: 'imperial', // 'metric' | 'imperial'
  theme: 'dark',    // 'dark' | 'light'
};

function getInitialSettings() {
  const fallback = { ...defaultSettings };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return {
      ...fallback,
      ...parsed,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return fallback;
  }
}

/*
 * Apply the saved theme immediately, before React renders.
 *
 * This is important because otherwise the browser can briefly render the
 * system/light theme before AppSettingsProvider's useEffect runs.
 *
 * Saved user preference always wins.
 */
if (typeof document !== 'undefined') {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);

    let theme = defaultSettings.theme;

    if (raw) {
      const parsed = JSON.parse(raw);

      if (parsed?.theme === 'light') {
        theme = 'light';
      } else if (parsed?.theme === 'dark') {
        theme = 'dark';
      }
    }

    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors so changing settings never breaks the UI.
  }
}

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(getInitialSettings);

  // Apply theme whenever the setting changes.
  useEffect(() => {
    const root = document.documentElement;
    const isLight = settings.theme === 'light';

    root.classList.toggle('light', isLight);
    root.classList.toggle('dark', !isLight);
  }, [settings.theme]);

  // Apply language to <html> lang attribute.
  useEffect(() => {
    document.documentElement.lang = settings.language || 'en';
  }, [settings.language]);

  const updateSettings = (patch) => {
    setSettings((previous) => {
      const next = {
        ...previous,
        ...patch,
      };

      if (patch.theme === 'light' || patch.theme === 'dark') {
        next.theme = patch.theme;
      }

      saveSettings(next);

      return next;
    });
  };

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        updateSettings,
      }}
    >
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

  if (unit === 'metric') {
    return `${(parseFloat(value) * 0.453592).toFixed(1)} kg`;
  }

  return `${value} lbs`;
}

/** Convert a weight INPUT: if user is in metric, they typed kg — convert to lbs for storage */
export function inputWeightToLbs(value, unit) {
  if (unit === 'metric') {
    return (parseFloat(value) / 0.453592).toFixed(1);
  }

  return parseFloat(value);
}

/** Convert stored lbs to display input value */
export function lbsToInputWeight(lbs, unit) {
  if (unit === 'metric') {
    return (parseFloat(lbs) * 0.453592).toFixed(1);
  }

  return lbs;
}

/** Convert stored inches to display string */
export function displayHeight(inches, unit) {
  if (!inches && inches !== 0) return '—';

  if (unit === 'metric') {
    return `${(parseFloat(inches) * 2.54).toFixed(0)} cm`;
  }

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
