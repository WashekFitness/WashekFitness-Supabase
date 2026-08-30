import { useState, useEffect, useRef } from 'react';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  canAccess,
} from '@/lib/subscription';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  Card,
} from '@/components/ui/card';

import {
  Button,
} from '@/components/ui/button';

import {
  Input,
} from '@/components/ui/input';

import {
  Camera,
  Image,
  Scan,
  Trash2,
  Weight,
  TrendingDown,
  Sparkles,
  Lock,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import {
  toast,
} from 'sonner';

import {
  cn,
} from '@/lib/utils';

import {
  useAppSettings,
  displayWeight,
  weightUnit,
} from '@/lib/AppSettingsContext';

import {
  getProgressPhotoPrompt,
} from '@/lib/trainingTypes';

import PageHeader from '@/components/layout/PageHeader';

/*
 * ============================================================
 * PROGRESS PHOTO ANALYSIS SCHEMA
 * ============================================================
 *
 * Keep this intentionally simple because the free OpenRouter
 * vision model returns JSON_OBJECT rather than strict
 * JSON-schema enforcement.
 */

const PROGRESS_PHOTO_SCHEMA = {
  type: 'object',

  additionalProperties: false,

  properties: {
    body_fat_range: {
      type: 'string',
    },

    body_fat_numeric: {
      type: 'number',
    },

    insights: {
      type: 'string',
    },
  },

  required: [
    'body_fat_range',
    'body_fat_numeric',
    'insights',
  ],
};

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function ProgressPhotos() {
  const queryClient =
    useQueryClient();

  const {
    settings,
  } =
    useAppSettings();

  const unit =
    settings.unit ||
    'imperial';

  const today =
    new Date()
      .toISOString()
      .split('T')[0];

  const [
    user,
    setUser,
  ] =
    useState(null);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const cameraInputRef =
    useRef(null);

  const galleryInputRef =
    useRef(null);

  const [
    analyzing,
    setAnalyzing,
  ] =
    useState(null);

  const [
    analysisError,
    setAnalysisError,
  ] =
    useState({});

  const [
    pendingWeight,
    setPendingWeight,
  ] =
    useState({});

  const [
    lightboxUrl,
    setLightboxUrl,
  ] =
    useState(null);

  /*
   * ==========================================================
   * LOAD USER
   * ==========================================================
   */

  useEffect(() => {
    let mounted = true;

    supabaseApi.auth
      .me()
      .then(
        (
          currentUser
        ) => {
          if (
            mounted
          ) {
            setUser(
              currentUser
            );
          }
        }
      )
      .catch(
        (
          error
        ) => {
          console.error(
            '[ProgressPhotos] User load failed:',
            error
          );
        }
      );

    return () => {
      mounted =
        false;
    };
  }, []);

  /*
   * ==========================================================
   * PLAN
   * ==========================================================
   */

  const plan =
    user?.subscription_plan ||
    'free';

  const firstName =
    user?.first_name ||
    user?.full_name
      ?.split(' ')[0] ||
    'there';

  const canAnalyze =
    canAccess(
      plan,
      'ai_body_analysis'
    );

  const canSeeGraph =
    canAccess(
      plan,
      'progress_graph'
    );

  /*
   * ==========================================================
   * PHOTOS
   * ==========================================================
   */

  const {
    data: photos = [],
  } =
    useQuery({
      queryKey: [
        'progress-photos',
        user?.email,
      ],

      queryFn:
        () =>
          supabaseApi.entities.ProgressPhoto.filter(
            {
              created_by:
                user.email,
            },
            '-date',
            100
          ),

      enabled:
        !!user?.email,
    });

  /*
   * ==========================================================
   * CREATE
   * ==========================================================
   */

  const createMutation =
    useMutation({
      mutationFn:
        (
          data
        ) =>
          supabaseApi.entities.ProgressPhoto.create(
            data
          ),

      onSuccess:
        () => {
          queryClient.invalidateQueries(
            {
              queryKey: [
                'progress-photos',
              ],
            }
          );

          toast.success(
            'Photo saved!'
          );
        },
    });

  /*
   * ==========================================================
   * DELETE
   * ==========================================================
   */

  const deleteMutation =
    useMutation({
      mutationFn:
        (
          id
        ) =>
          supabaseApi.entities.ProgressPhoto.delete(
            id
          ),

      onSuccess:
        () =>
          queryClient.invalidateQueries(
            {
              queryKey: [
                'progress-photos',
              ],
            }
          ),
    });

  /*
   * ==========================================================
   * UPDATE
   * ==========================================================
   */

  const updateMutation =
    useMutation({
      mutationFn:
        ({
          id,
          data,
        }) =>
          supabaseApi.entities.ProgressPhoto.update(
            id,
            data
          ),

      onSuccess:
        () =>
          queryClient.invalidateQueries(
            {
              queryKey: [
                'progress-photos',
              ],
            }
          ),
    });

  /*
   * ==========================================================
   * UPLOAD PHOTO
   * ==========================================================
   */

  const handleFileUpload =
    async (
      e
    ) => {
      const file =
        e.target
          ?.files?.[0];

      if (
        !file
      ) {
        return;
      }

      setUploading(
        true
      );

      try {
        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Please select an image file.'
          );
        }

        const uploaded =
          await supabaseApi.storage.uploadFile(
            {
              file,
            }
          );

        if (
          !uploaded?.file_url
        ) {
          throw new Error(
            'The photo uploaded, but no photo URL was returned.'
          );
        }

        await createMutation.mutateAsync(
          {
            photo_url:
              uploaded.file_url,

            date:
              today,
          }
        );
      } catch (
        error
      ) {
        console.error(
          '[ProgressPhotos] Upload failed:',
          error
        );

        toast.error(
          error?.message ||
            'The photo could not be uploaded.'
        );
      } finally {
        setUploading(
          false
        );

        e.target.value =
          '';
      }
    };

  /*
   * ==========================================================
   * ANALYZE PHOTO
   * ==========================================================
   */

  const handleAnalyze =
    async (
      photo
    ) => {
      /*
       * Prevent duplicate clicks.
       */

      if (
        analyzing
      ) {
        return;
      }

      /*
       * Start loading.
       */

      setAnalyzing(
        photo.id
      );

      /*
       * Clear old error for this photo.
       */

      setAnalysisError(
        prev => ({
          ...prev,

          [photo.id]:
            '',
        })
      );

      try {
        /*
         * ------------------------------------------------------
         * SORT PHOTOS
         * ------------------------------------------------------
         */

        const sortedPhotos =
          [
            ...photos,
          ].sort(
            (
              a,
              b
            ) =>
              String(
                a.date ||
                  ''
              ).localeCompare(
                String(
                  b.date ||
                    ''
                )
              )
          );

        /*
         * ------------------------------------------------------
         * PREVIOUS PHOTO
         * ------------------------------------------------------
         */

        const prevPhoto =
          sortedPhotos.find(
            (
              p
            ) =>
              p.date <
                photo.date &&
              p.body_fat_estimate
          );

        const prevContext =
          prevPhoto
            ? `Previous estimate from ${prevPhoto.date}: ${prevPhoto.body_fat_estimate}.`
            : '';

        /*
         * ------------------------------------------------------
         * ATHLETE CONTEXT
         * ------------------------------------------------------
         */

        const trainingType =
          user?.training_type ||
          'calisthenics';

        const equipment =
          user?.available_equipment ||
          '';

        /*
         * ------------------------------------------------------
         * PROMPT
         * ------------------------------------------------------
         */

        const prompt =
          `${getProgressPhotoPrompt(
            trainingType,
            firstName,
            prevContext,
            equipment
          )}

IMPORTANT OUTPUT REQUIREMENT:

Return ONLY this JSON object:

{
  "body_fat_range": "14-17%",
  "body_fat_numeric": 15.5,
  "insights": "Your detailed coaching observations..."
}

body_fat_range must be a range, not an exact percentage.
body_fat_numeric must be the numeric midpoint of the range.
insights must contain the personalized coaching analysis.
`;

        /*
         * ------------------------------------------------------
         * VALIDATE IMAGE URL
         * ------------------------------------------------------
         */

        if (
          !photo?.photo_url
        ) {
          throw new Error(
            'This progress photo does not have a valid image URL.'
          );
        }

        /*
         * ------------------------------------------------------
         * AI REQUEST
         * ------------------------------------------------------
         */

        console.log(
          '[ProgressPhotos] Starting AI analysis:',
          {
            photoId:
              photo.id,

            plan,

            model:
              'openrouter/free',

            hasImage:
              true,
          }
        );

        const result =
          await supabaseApi.ai.invoke(
            {
              type:
                'progress_photo',

              prompt,

              file_urls: [
                photo.photo_url,
              ],

              response_json_schema:
                PROGRESS_PHOTO_SCHEMA,
            }
          );

        /*
         * ------------------------------------------------------
         * VALIDATE RESULT
         * ------------------------------------------------------
         */

        if (
          !result
        ) {
          throw new Error(
            'The AI returned no analysis.'
          );
        }

        const bodyFatRange =
          String(
            result.body_fat_range ||
              ''
          ).trim();

        const bodyFatNumeric =
          Number(
            result.body_fat_numeric
          );

        const insights =
          String(
            result.insights ||
              ''
          ).trim();

        if (
          !bodyFatRange
        ) {
          throw new Error(
            'The AI did not return a body-fat range.'
          );
        }

        if (
          !Number.isFinite(
            bodyFatNumeric
          )
        ) {
          throw new Error(
            'The AI did not return a valid body-fat estimate.'
          );
        }

        if (
          !insights
        ) {
          throw new Error(
            'The AI did not return coaching insights.'
          );
        }

        /*
         * ------------------------------------------------------
         * SAVE ANALYSIS
         * ------------------------------------------------------
         */

        await updateMutation.mutateAsync(
          {
            id:
              photo.id,

            data: {
              body_fat_estimate:
                bodyFatRange,

              body_fat_numeric:
                bodyFatNumeric,

              ai_insights:
                insights,
            },
          }
        );

        /*
         * ------------------------------------------------------
         * SUCCESS
         * ------------------------------------------------------
         */

        setAnalysisError(
          prev => ({
            ...prev,

            [photo.id]:
              '',
          })
        );

        toast.success(
          'Analysis complete!'
        );
      } catch (
        error
      ) {
        /*
         * ------------------------------------------------------
         * IMPORTANT:
         *
         * ALWAYS CLEAR THE ANALYZING STATE.
         * This is the bug in the old version.
         * ------------------------------------------------------
         */

        console.error(
          '[ProgressPhotos] AI analysis failed:',
          error
        );

        setAnalysisError(
          prev => ({
            ...prev,

            [photo.id]:
              error?.message ||
              'AI analysis failed. Please try again.',
          })
        );

        toast.error(
          error?.message ||
            'AI analysis failed. Please try again.'
        );
      } finally {
        /*
         * ------------------------------------------------------
         * NEVER LEAVE THE SPINNER STUCK.
         * ------------------------------------------------------
         */

        setAnalyzing(
          null
        );
      }
    };

  /*
   * ==========================================================
   * LOG WEIGHT
   * ==========================================================
   */

  const handleLogWeight =
    async (
      photo
    ) => {
      const raw =
        parseFloat(
          pendingWeight[
            photo.id
          ]
        );

      if (
        !Number.isFinite(
          raw
        ) ||
        raw <= 0
      ) {
        return;
      }

      /*
       * Store as pounds internally.
       */

      const weightLbs =
        unit ===
        'metric'
          ? raw /
            0.453592
          : raw;

      try {
        await updateMutation.mutateAsync(
          {
            id:
              photo.id,

            data: {
              weight_lbs:
                weightLbs,
            },
          }
        );

        setPendingWeight(
          prev => ({
            ...prev,

            [photo.id]:
              '',
          })
        );

        toast.success(
          'Weight logged!'
        );
      } catch (
        error
      ) {
        toast.error(
          error?.message ||
            'Weight could not be saved.'
        );
      }
    };

  /*
   * ==========================================================
   * GROUP PHOTOS
   * ==========================================================
   */

  const grouped =
    photos.reduce(
      (
        acc,
        p
      ) => {
        if (
          !acc[p.date]
        ) {
          acc[p.date] =
            [];
        }

        acc[p.date].push(
          p
        );

        return acc;
      },
      {}
    );

  /*
   * ==========================================================
   * BODY FAT GRAPH
   * ==========================================================
   */

  const bfGraphData =
    photos
      .filter(
        p =>
          p.body_fat_numeric &&
          p.date
      )
      .sort(
        (
          a,
          b
        ) =>
          a.date.localeCompare(
            b.date
          )
      )
      .map(
        p => ({
          date:
            p.date.slice(
              5
            ),

          bf:
            p.body_fat_numeric,
        })
      );

  /*
   * ==========================================================
   * WEIGHT GRAPH
   * ==========================================================
   */

  const weightGraphData =
    photos
      .filter(
        p =>
          p.weight_lbs &&
          p.date
      )
      .sort(
        (
          a,
          b
        ) =>
          a.date.localeCompare(
            b.date
          )
      )
      .map(
        p => ({
          date:
            p.date.slice(
              5
            ),

          weight:
            unit ===
            'metric'
              ? parseFloat(
                  (
                    p.weight_lbs *
                    0.453592
                  ).toFixed(
                    1
                  )
                )
              : p.weight_lbs,
        })
      );

  /*
   * ==========================================================
   * LOADING USER
   * ==========================================================
   */

  if (
    !user
  ) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">

        <Loader2 className="w-7 h-7 animate-spin text-primary" />

      </div>
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div className="px-5 safe-bottom">

      {/* ---------------------------------------------------- */}
      {/* LIGHTBOX */}
      {/* ---------------------------------------------------- */}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() =>
            setLightboxUrl(
              null
            )
          }
        >

          <button
            type="button"
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            onClick={() =>
              setLightboxUrl(
                null
              )
            }
          >

            <X className="w-5 h-5" />

          </button>

          <img
            src={
              lightboxUrl
            }
            alt="Progress"
            className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            onClick={e =>
              e.stopPropagation()
            }
          />

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* HEADER */}
      {/* ---------------------------------------------------- */}

      <PageHeader
        title="Progress Photos"
        subtitle="Track your transformation visually"
      />

      <div className="mb-5" />

      {/* ---------------------------------------------------- */}
      {/* TIER BADGES */}
      {/* ---------------------------------------------------- */}

      <div className="flex flex-wrap gap-2 mb-5">

        <span
          className={cn(
            'text-[10px] font-bold px-2.5 py-1 rounded-full border',

            canAnalyze
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground'
          )}
        >

          {canAnalyze
            ? '✓'
            : '🔒'}{' '}

          AI Analysis —
          Performance+

        </span>

        <span
          className={cn(
            'text-[10px] font-bold px-2.5 py-1 rounded-full border',

            canSeeGraph
              ? 'border-chart-4/40 bg-chart-4/10 text-chart-4'
              : 'border-border bg-muted text-muted-foreground'
          )}
        >

          {canSeeGraph
            ? '✓'
            : '🔒'}{' '}

          Progress Graph —
          Elite

        </span>

      </div>

      {/* ---------------------------------------------------- */}
      {/* UPLOAD */}
      {/* ---------------------------------------------------- */}

      <div className="mb-5">

        {uploading ? (

          <div className="flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border bg-card">

            <Loader2 className="w-5 h-5 animate-spin text-primary" />

            <span className="font-medium text-sm">
              Uploading…
            </span>

          </div>

        ) : (

          <div className="grid grid-cols-2 gap-3">

            <button
              type="button"
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/50 transition-colors"
              onClick={() =>
                cameraInputRef.current?.click()
              }
            >

              <Camera className="w-5 h-5 text-primary" />

              <span className="font-medium text-sm">
                Take Photo
              </span>

            </button>

            <button
              type="button"
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/50 transition-colors"
              onClick={() =>
                galleryInputRef.current?.click()
              }
            >

              <Image className="w-5 h-5 text-accent" />

              <span className="font-medium text-sm">
                Upload Photo
              </span>

            </button>

          </div>
        )}

        <input
          ref={
            cameraInputRef
          }
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={
            handleFileUpload
          }
          disabled={
            uploading
          }
        />

        <input
          ref={
            galleryInputRef
          }
          type="file"
          accept="image/*"
          className="hidden"
          onChange={
            handleFileUpload
          }
          disabled={
            uploading
          }
        />

      </div>

      {/* ---------------------------------------------------- */}
      {/* GRAPHS */}
      {/* ---------------------------------------------------- */}

      {canSeeGraph &&
        (
          bfGraphData.length >=
            2 ||
          weightGraphData.length >=
            2
        ) && (

          <div className="space-y-4 mb-6">

            {bfGraphData.length >=
              2 && (

              <Card className="p-4">

                <div className="flex items-center gap-2 mb-1">

                  <TrendingDown className="w-4 h-4 text-primary" />

                  <p className="font-heading font-bold text-sm">
                    Body Fat % Over Time
                  </p>

                </div>

                <p className="text-[10px] text-muted-foreground italic mb-3">
                  AI estimates — approximate only
                </p>

                <ResponsiveContainer
                  width="100%"
                  height={
                    140
                  }
                >

                  <LineChart
                    data={
                      bfGraphData
                    }
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />

                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize:
                          10,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />

                    <YAxis
                      domain={[
                        'auto',
                        'auto',
                      ]}
                      tick={{
                        fontSize:
                          10,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                      tickFormatter={v =>
                        `${v}%`
                      }
                    />

                    <Tooltip
                      formatter={v => [
                        `${v}%`,
                        'Body Fat',
                      ]}
                      contentStyle={{
                        background:
                          'hsl(var(--card))',

                        border:
                          '1px solid hsl(var(--border))',

                        borderRadius:
                          12,

                        fontSize:
                          12,
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="bf"
                      stroke="hsl(var(--primary))"
                      strokeWidth={
                        2
                      }
                      dot={{
                        fill:
                          'hsl(var(--primary))',
                        r: 4,
                      }}
                    />

                  </LineChart>

                </ResponsiveContainer>

              </Card>

            )}

            {weightGraphData.length >=
              2 && (

              <Card className="p-4">

                <div className="flex items-center gap-2 mb-3">

                  <Weight className="w-4 h-4 text-accent" />

                  <p className="font-heading font-bold text-sm">
                    Weight Over Time
                  </p>

                </div>

                <ResponsiveContainer
                  width="100%"
                  height={
                    140
                  }
                >

                  <LineChart
                    data={
                      weightGraphData
                    }
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />

                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize:
                          10,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />

                    <YAxis
                      domain={[
                        'auto',
                        'auto',
                      ]}
                      tick={{
                        fontSize:
                          10,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                      tickFormatter={v =>
                        `${v}${
                          unit ===
                          'metric'
                            ? 'kg'
                            : 'lb'
                        }`
                      }
                    />

                    <Tooltip
                      formatter={v => [
                        `${v} ${
                          unit ===
                          'metric'
                            ? 'kg'
                            : 'lbs'
                        }`,
                        'Weight',
                      ]}
                      contentStyle={{
                        background:
                          'hsl(var(--card))',

                        border:
                          '1px solid hsl(var(--border))',

                        borderRadius:
                          12,

                        fontSize:
                          12,
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--accent))"
                      strokeWidth={
                        2
                      }
                      dot={{
                        fill:
                          'hsl(var(--accent))',
                        r: 4,
                      }}
                    />

                  </LineChart>

                </ResponsiveContainer>

              </Card>

            )}

          </div>

        )}

      {/* ---------------------------------------------------- */}
      {/* LOCKED GRAPH TEASER */}
      {/* ---------------------------------------------------- */}

      {!canSeeGraph &&
        photos.some(
          p =>
            p.body_fat_numeric
        ) && (

          <Card className="p-4 mb-5 border-chart-4/20 bg-chart-4/5">

            <div className="flex items-center gap-3">

              <Lock className="w-5 h-5 text-chart-4 shrink-0" />

              <div>

                <p className="text-sm font-semibold text-chart-4">
                  Progress Graph — Elite
                </p>

                <p className="text-xs text-muted-foreground mt-0.5">
                  Upgrade to Elite to unlock your body fat & weight trend graph over time.
                </p>

              </div>

            </div>

          </Card>

        )}

      {/* ---------------------------------------------------- */}
      {/* EMPTY STATE */}
      {/* ---------------------------------------------------- */}

      {photos.length ===
        0 && (

        <div className="text-center py-16 text-muted-foreground">

          <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />

          <p className="text-sm">
            No photos yet. Add your first one!
          </p>

        </div>

      )}

      {/* ---------------------------------------------------- */}
      {/* PHOTO LIST */}
      {/* ---------------------------------------------------- */}

      <div className="space-y-6">

        {Object.entries(
          grouped
        )
          .sort(
            (
              [a],
              [b]
            ) =>
              b.localeCompare(
                a
              )
          )
          .map(
            (
              [
                date,
                dayPhotos,
              ]
            ) => (

              <div
                key={
                  date
                }
              >

                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">

                  {new Date(
                    `${date}T12:00:00`
                  ).toLocaleDateString(
                    'en',
                    {
                      weekday:
                        'long',

                      month:
                        'long',

                      day:
                        'numeric',

                      year:
                        'numeric',
                    }
                  )}

                </p>

                <div className="space-y-4">

                  {dayPhotos.map(
                    photo => (

                    <Card
                      key={
                        photo.id
                      }
                      className="overflow-hidden"
                    >

                      <img
                        src={
                          photo.photo_url
                        }
                        alt="Progress"
                        className="w-full object-contain bg-black max-h-64 cursor-zoom-in"
                        onClick={() =>
                          setLightboxUrl(
                            photo.photo_url
                          )
                        }
                      />

                      <div className="p-4 space-y-3">

                        {/* Weight */}

                        {photo.weight_lbs ? (

                          <div className="flex items-center gap-2 text-sm">

                            <Weight className="w-4 h-4 text-primary" />

                            <span className="font-semibold">

                              {displayWeight(
                                photo.weight_lbs,
                                unit
                              )}

                            </span>

                          </div>

                        ) : (

                          <div className="flex gap-2">

                            <Input
                              type="number"
                              placeholder={`Log weight (${weightUnit(unit)})`}
                              className="h-9 text-sm"
                              value={
                                pendingWeight[
                                  photo.id
                                ] ||
                                ''
                              }
                              onChange={e =>
                                setPendingWeight(
                                  prev => ({
                                    ...prev,

                                    [photo.id]:
                                      e.target
                                        .value,
                                  })
                                )
                              }
                            />

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleLogWeight(
                                  photo
                                )
                              }
                            >
                              Save
                            </Button>

                          </div>

                        )}

                        {/* Analysis */}

                        {canAnalyze ? (

                          photo.ai_insights ? (

                            <div className="bg-primary/8 rounded-xl p-3 space-y-2 border border-primary/15">

                              <div className="flex items-center gap-2">

                                <Sparkles className="w-3.5 h-3.5 text-primary" />

                                <p className="text-xs font-bold text-primary uppercase tracking-wider">
                                  Kael's Take
                                </p>

                                {photo.body_fat_estimate && (

                                  <span className="ml-auto text-xs font-semibold text-muted-foreground">

                                    ~
                                    {
                                      photo.body_fat_estimate
                                    }{' '}
                                    BF

                                  </span>

                                )}

                              </div>

                              <p className="text-sm leading-relaxed">
                                {
                                  photo.ai_insights
                                }
                              </p>

                              <p className="text-[10px] text-muted-foreground italic">
                                ⚠️ AI estimate only — not medically precise
                              </p>

                            </div>

                          ) : (

                            <div className="space-y-2">

                              {analysisError[
                                photo.id
                              ] && (

                                <div className="flex items-start gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/5">

                                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />

                                  <p className="text-xs text-destructive leading-relaxed">

                                    {
                                      analysisError[
                                        photo.id
                                      ]
                                    }

                                  </p>

                                </div>

                              )}

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                disabled={
                                  analyzing ===
                                  photo.id
                                }
                                onClick={() =>
                                  handleAnalyze(
                                    photo
                                  )
                                }
                              >

                                {analyzing ===
                                photo.id ? (

                                  <>

                                    <Loader2 className="w-4 h-4 animate-spin" />

                                    Analyzing…

                                  </>

                                ) : (

                                  <>

                                    <Scan className="w-4 h-4" />

                                    {analysisError[
                                      photo.id
                                    ]
                                      ? 'Try Analysis Again'
                                      : 'Get Kael\'s Analysis'}

                                  </>

                                )}

                              </Button>

                            </div>

                          )

                        ) : (

                          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">

                            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />

                            <p className="text-xs text-muted-foreground">

                              AI body analysis is available on the{' '}

                              <span className="font-semibold text-primary">
                                Performance
                              </span>{' '}

                              plan and above.

                            </p>

                          </div>

                        )}

                        {/* Delete */}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive gap-2"
                          onClick={() =>
                            deleteMutation.mutate(
                              photo.id
                            )
                          }
                          disabled={
                            deleteMutation.isPending
                          }
                        >

                          <Trash2 className="w-4 h-4" />

                          Delete

                        </Button>

                      </div>

                    </Card>

                  ))}
                </div>

              </div>

            )
          )}

      </div>

    </div>
  );
}
