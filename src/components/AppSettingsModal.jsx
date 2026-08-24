import { useState } from 'react';
import { Settings, X, Sun, Moon, Globe, Languages, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/lib/AppSettingsContext';
import { COUNTRIES, LANGUAGES, getCountryDefaults } from '@/lib/countries';
import { cn } from '@/lib/utils';

function SearchableDropdown({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 200);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full h-11 px-3 rounded-xl border border-border bg-muted/50 text-sm text-left flex items-center justify-between hover:border-primary/40 transition-all"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || placeholder}</span>
        <span className="text-muted-foreground text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full h-8 px-3 text-sm bg-muted rounded-lg outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left hover:bg-muted/80 transition-all',
                  opt === value && 'bg-primary/10 text-primary font-semibold'
                )}
              >
                {opt}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No results</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = COUNTRIES.find(c => c.code === value);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full h-11 px-3 rounded-xl border border-border bg-muted/50 text-sm text-left flex items-center justify-between hover:border-primary/40 transition-all"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>{selected?.name || 'Select country…'}</span>
        <span className="text-muted-foreground text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full h-8 px-3 text-sm bg-muted rounded-lg outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.code}
                onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left hover:bg-muted/80 transition-all',
                  c.code === value && 'bg-primary/10 text-primary font-semibold'
                )}
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No results</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppSettingsModal() {
  const { settings, updateSettings } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(settings);

  const openModal = () => {
    setLocal(settings);
    setOpen(true);
  };

  const handleCountryChange = (code) => {
    const defaults = getCountryDefaults(code);
    setLocal(prev => ({ ...prev, country: code, language: defaults.language, unit: defaults.unit }));
  };

  const save = () => {
    updateSettings(local);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={openModal}
        className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/60 hover:bg-muted transition-all border border-border"
        aria-label="App Settings"
      >
        <Settings className="w-4.5 h-4.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative w-full max-w-sm bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg">App Settings</h2>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Theme */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Appearance</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'light', label: 'Light', icon: Sun },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setLocal(p => ({ ...p, theme: value }))}
                      className={cn(
                        'h-12 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-semibold transition-all',
                        local.theme === value
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Country
                </p>
                <CountryDropdown value={local.country} onChange={handleCountryChange} />
                <p className="text-[10px] text-muted-foreground mt-1">Changing country auto-sets language & units</p>
              </div>

              {/* Language */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Languages className="w-3 h-3" /> Language
                </p>
                <SearchableDropdown
                  value={local.language}
                  onChange={(v) => setLocal(p => ({ ...p, language: v }))}
                  options={LANGUAGES}
                  placeholder="Select language…"
                />
              </div>

              {/* Units */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Ruler className="w-3 h-3" /> Measurement System
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'metric', label: 'Metric (kg, cm)' },
                    { value: 'imperial', label: 'Imperial (lbs, ft)' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setLocal(p => ({ ...p, unit: value }))}
                      className={cn(
                        'h-12 rounded-xl border-2 px-2 text-xs font-semibold transition-all',
                        local.unit === value
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button className="w-full h-12 font-heading font-semibold mt-6" onClick={save}>
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </>
  );
}