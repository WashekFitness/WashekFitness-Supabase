import { useState } from 'react';

import {
  Settings,
  X,
  Sun,
  Moon,
  Globe,
  Languages,
  Ruler,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

import {
  useAppSettings,
} from '@/lib/AppSettingsContext';

import {
  COUNTRIES,
  LANGUAGES,
  getCountryDefaults,
} from '@/lib/countries';

import {
  cn,
} from '@/lib/utils';


function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState('');


  const filtered =
    options
      .filter(
        (option) =>
          option
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
      )
      .slice(
        0,
        200
      );


  return (
    <div className="
      relative
      z-10
    ">

      <button
        type="button"
        onClick={() => {
          setOpen(
            (current) =>
              !current
          );

          setSearch(
            ''
          );
        }}
        className="
          relative
          z-10
          w-full
          h-11
          px-3
          rounded-xl
          border
          border-border
          bg-muted/50
          text-sm
          text-left
          flex
          items-center
          justify-between
          hover:border-primary/40
          transition-all
          pointer-events-auto
          touch-manipulation
        "
      >

        <span
          className={
            value
              ? 'text-foreground'
              : 'text-muted-foreground'
          }
        >
          {
            value ||
            placeholder
          }
        </span>

        <span className="
          text-muted-foreground
          text-xs
        ">
          ▾
        </span>

      </button>


      {open && (
        <div className="
          absolute
          z-[1050]
          top-full
          mt-1
          w-full
          bg-card
          border
          border-border
          rounded-xl
          shadow-xl
          overflow-hidden
        ">

          <div className="
            p-2
            border-b
            border-border
          ">

            <input
              autoFocus
              value={
                search
              }
              onChange={
                (event) =>
                  setSearch(
                    event.target.value
                  )
              }
              placeholder="Search..."
              className="
                w-full
                h-8
                px-3
                text-sm
                bg-muted
                rounded-lg
                outline-none
              "
            />

          </div>


          <div className="
            max-h-52
            overflow-y-auto
          ">

            {filtered.map(
              (option) => (

                <button
                  type="button"
                  key={
                    option
                  }
                  onClick={() => {
                    onChange(
                      option
                    );

                    setOpen(
                      false
                    );

                    setSearch(
                      ''
                    );
                  }}
                  className={cn(
                    `
                      w-full
                      px-3
                      py-2
                      text-sm
                      text-left
                      hover:bg-muted/80
                      transition-all
                      pointer-events-auto
                    `,

                    option ===
                      value &&
                      `
                        bg-primary/10
                        text-primary
                        font-semibold
                      `
                  )}
                >
                  {
                    option
                  }
                </button>

              )
            )}


            {filtered.length ===
              0 && (
              <p className="
                px-3
                py-3
                text-xs
                text-muted-foreground
              ">
                No results
              </p>
            )}

          </div>

        </div>
      )}

    </div>
  );
}


function CountryDropdown({
  value,
  onChange,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState('');


  const selected =
    COUNTRIES.find(
      (country) =>
        country.code ===
        value
    );


  const filtered =
    COUNTRIES.filter(
      (country) =>
        country.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );


  return (
    <div className="
      relative
      z-10
    ">

      <button
        type="button"
        onClick={() => {
          setOpen(
            (current) =>
              !current
          );

          setSearch(
            ''
          );
        }}
        className="
          relative
          z-10
          w-full
          h-11
          px-3
          rounded-xl
          border
          border-border
          bg-muted/50
          text-sm
          text-left
          flex
          items-center
          justify-between
          hover:border-primary/40
          transition-all
          pointer-events-auto
          touch-manipulation
        "
      >

        <span
          className={
            selected
              ? 'text-foreground'
              : 'text-muted-foreground'
          }
        >
          {
            selected?.name ||
            'Select country…'
          }
        </span>

        <span className="
          text-muted-foreground
          text-xs
        ">
          ▾
        </span>

      </button>


      {open && (
        <div className="
          absolute
          z-[1050]
          top-full
          mt-1
          w-full
          bg-card
          border
          border-border
          rounded-xl
          shadow-xl
          overflow-hidden
        ">

          <div className="
            p-2
            border-b
            border-border
          ">

            <input
              autoFocus
              value={
                search
              }
              onChange={
                (event) =>
                  setSearch(
                    event.target.value
                  )
              }
              placeholder="Search country..."
              className="
                w-full
                h-8
                px-3
                text-sm
                bg-muted
                rounded-lg
                outline-none
              "
            />

          </div>


          <div className="
            max-h-52
            overflow-y-auto
          ">

            {filtered.map(
              (country) => (

                <button
                  type="button"
                  key={
                    country.code
                  }
                  onClick={() => {
                    onChange(
                      country.code
                    );

                    setOpen(
                      false
                    );

                    setSearch(
                      ''
                    );
                  }}
                  className={cn(
                    `
                      w-full
                      px-3
                      py-2
                      text-sm
                      text-left
                      hover:bg-muted/80
                      transition-all
                      pointer-events-auto
                    `,

                    country.code ===
                      value &&
                      `
                        bg-primary/10
                        text-primary
                        font-semibold
                      `
                  )}
                >
                  {
                    country.name
                  }
                </button>

              )
            )}


            {filtered.length ===
              0 && (
              <p className="
                px-3
                py-3
                text-xs
                text-muted-foreground
              ">
                No results
              </p>
            )}

          </div>

        </div>
      )}

    </div>
  );
}


export default function AppSettingsModal() {
  const {
    settings,
    updateSettings,
  } =
    useAppSettings();


  const [
    open,
    setOpen,
  ] = useState(false);


  const [
    local,
    setLocal,
  ] = useState(
    settings
  );


  const openModal =
    () => {
      setLocal(
        settings
      );

      setOpen(
        true
      );
    };


  const closeModal =
    () => {
      setLocal(
        settings
      );

      setOpen(
        false
      );
    };


  const handleCountryChange =
    (
      code
    ) => {
      const defaults =
        getCountryDefaults(
          code
        );

      setLocal(
        (previous) => ({
          ...previous,

          country:
            code,

          language:
            defaults.language,

          unit:
            defaults.unit,
        })
      );
    };


  const save =
    () => {
      updateSettings(
        local
      );

      setOpen(
        false
      );
    };


  return (
    <>

      {/* ===================================================
          SETTINGS BUTTON
          =================================================== */}

      <button
        type="button"
        onClick={
          openModal
        }
        aria-label="App Settings"
        className="
          relative
          z-[110]
          flex
          items-center
          justify-center
          w-11
          h-11
          min-w-11
          min-h-11
          rounded-xl
          bg-muted/60
          border
          border-border
          hover:bg-muted
          active:bg-muted
          transition-all
          pointer-events-auto
          touch-manipulation
          shrink-0
        "
      >

        <Settings className="
          w-5
          h-5
          text-muted-foreground
          pointer-events-none
        " />

      </button>


      {open && (
        <div
          className="
            fixed
            inset-0
            z-[1000]
            pointer-events-auto
            flex
            items-end
            sm:items-center
            justify-center
          "
          role="dialog"
          aria-modal="true"
        >

          {/* Backdrop */}

          <button
            type="button"
            aria-label="Close settings"
            className="
              absolute
              inset-0
              z-0
              bg-black/60
              backdrop-blur-sm
              pointer-events-auto
            "
            onClick={
              closeModal
            }
          />


          {/* Panel */}

          <div
            className="
              relative
              z-10
              w-full
              max-w-sm
              bg-card
              border
              border-border
              rounded-t-3xl
              sm:rounded-2xl
              shadow-2xl
              px-6
              pt-5
              pb-[calc(1rem+env(safe-area-inset-bottom))]
              max-h-[calc(100dvh-1rem)]
              sm:max-h-[90vh]
              overflow-y-auto
              overscroll-contain
              pointer-events-auto
            "
          >

            {/* Header */}

            <div className="
              flex
              items-center
              justify-between
              mb-5
            ">

              <h2 className="
                font-heading
                font-bold
                text-lg
              ">
                App Settings
              </h2>


              <button
                type="button"
                onClick={
                  closeModal
                }
                aria-label="Close settings"
                className="
                  relative
                  z-20
                  flex
                  items-center
                  justify-center
                  w-9
                  h-9
                  rounded-xl
                  bg-muted
                  hover:bg-muted/80
                  pointer-events-auto
                  touch-manipulation
                "
              >

                <X className="
                  w-4
                  h-4
                  pointer-events-none
                " />

              </button>

            </div>


            <div className="space-y-5">

              {/* Appearance */}

              <div>

                <p className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-wider
                  text-muted-foreground
                  mb-2
                ">
                  Appearance
                </p>


                <div className="
                  grid
                  grid-cols-2
                  gap-2
                ">

                  {[
                    {
                      value:
                        'dark',
                      label:
                        'Dark',
                      icon:
                        Moon,
                    },

                    {
                      value:
                        'light',
                      label:
                        'Light',
                      icon:
                        Sun,
                    },
                  ].map(
                    ({
                      value,
                      label,
                      icon:
                        Icon,
                    }) => (

                      <button
                        type="button"
                        key={
                          value
                        }
                        onClick={() =>
                          setLocal(
                            (
                              previous
                            ) => ({
                              ...previous,
                              theme:
                                value,
                            })
                          )
                        }
                        className={cn(
                          `
                            h-12
                            rounded-xl
                            border-2
                            flex
                            items-center
                            justify-center
                            gap-2
                            text-sm
                            font-semibold
                            transition-all
                            pointer-events-auto
                            touch-manipulation
                          `,

                          local.theme ===
                            value
                            ? `
                              border-primary
                              bg-primary/10
                              text-foreground
                            `
                            : `
                              border-border
                              bg-muted/30
                              text-muted-foreground
                            `
                        )}
                      >

                        <Icon className="w-4 h-4 pointer-events-none" />

                        {
                          label
                        }

                      </button>

                    )
                  )}

                </div>

              </div>


              {/* Country */}

              <div>

                <p className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-wider
                  text-muted-foreground
                  mb-2
                  flex
                  items-center
                  gap-1.5
                ">

                  <Globe className="w-3 h-3" />

                  Country

                </p>


                <CountryDropdown
                  value={
                    local.country
                  }
                  onChange={
                    handleCountryChange
                  }
                />

              </div>


              {/* Language */}

              <div>

                <p className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-wider
                  text-muted-foreground
                  mb-2
                  flex
                  items-center
                  gap-1.5
                ">

                  <Languages className="w-3 h-3" />

                  Language

                </p>


                <SearchableDropdown
                  value={
                    local.language
                  }
                  onChange={
                    (value) =>
                      setLocal(
                        (
                          previous
                        ) => ({
                          ...previous,
                          language:
                            value,
                        })
                      )
                  }
                  options={
                    LANGUAGES
                  }
                  placeholder="Select language…"
                />

              </div>


              {/* Units */}

              <div>

                <p className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-wider
                  text-muted-foreground
                  mb-2
                  flex
                  items-center
                  gap-1.5
                ">

                  <Ruler className="w-3 h-3" />

                  Measurement System

                </p>


                <div className="
                  grid
                  grid-cols-2
                  gap-2
                ">

                  {[
                    {
                      value:
                        'metric',
                      label:
                        'Metric (kg, cm)',
                    },

                    {
                      value:
                        'imperial',
                      label:
                        'Imperial (lbs, ft)',
                    },
                  ].map(
                    ({
                      value,
                      label,
                    }) => (

                      <button
                        type="button"
                        key={
                          value
                        }
                        onClick={() =>
                          setLocal(
                            (
                              previous
                            ) => ({
                              ...previous,
                              unit:
                                value,
                            })
                          )
                        }
                        className={cn(
                          `
                            h-12
                            rounded-xl
                            px-2
                            text-xs
                            font-semibold
                            border-2
                            transition-all
                            pointer-events-auto
                            touch-manipulation
                          `,

                          local.unit ===
                            value
                            ? `
                              border-primary
                              bg-primary/10
                              text-foreground
                            `
                            : `
                              border-border
                              bg-muted/30
                              text-muted-foreground
                            `
                        )}
                      >
                        {
                          label
                        }
                      </button>

                    )
                  )}

                </div>

              </div>

            </div>


            {/* =================================================
                SAVE FOOTER
                ================================================= */}

            <div
              className="
                sticky
                bottom-0
                z-20
                mt-5
                pt-3
                bg-card
              "
            >

              <Button
                type="button"
                onClick={
                  save
                }
                className="
                  relative
                  z-30
                  w-full
                  h-12
                  min-h-12
                  font-heading
                  font-semibold
                  pointer-events-auto
                  touch-manipulation
                "
              >
                Save Settings
              </Button>

            </div>

          </div>

        </div>
      )}

    </>
  );
}
