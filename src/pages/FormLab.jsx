import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  Button,
} from '@/components/ui/button';

import {
  Card,
} from '@/components/ui/card';

import {
  Crown,
  Eye,
  Sparkles,
  Video,
  Scissors,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import VideoInput from '@/components/formlab/VideoInput';

import AnalysisResults from '@/components/formlab/AnalysisResults';

import {
  Input,
} from '@/components/ui/input';

import {
  FORM_EXERCISES,
  buildFormAnalysisPrompt,
} from '@/lib/formAnalysis';

export default function FormLab() {
  const navigate =
    useNavigate();

  const [
    user,
    setUser,
  ] =
    useState(null);

  const [
    exercise,
    setExercise,
  ] =
    useState('');

  const [
    videoUrl,
    setVideoUrl,
  ] =
    useState(null);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    analyzing,
    setAnalyzing,
  ] =
    useState(false);

  const [
    result,
    setResult,
  ] =
    useState(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('');

  const [
    videoDuration,
    setVideoDuration,
  ] =
    useState(0);

  const [
    trimStart,
    setTrimStart,
  ] =
    useState(0);

  const [
    trimEnd,
    setTrimEnd,
  ] =
    useState(0);

  const [
    autoDetected,
    setAutoDetected,
  ] =
    useState(false);

  const videoRef =
    useRef(null);

  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();

  const step =
    searchParams.get(
      'step'
    ) ||
    'select';

  /*
   * ==========================================================
   * LOAD USER
   * ==========================================================
   */

  useEffect(() => {
    let mounted =
      true;

    supabaseApi.auth
      .me()
      .then(
        (currentUser) => {
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
        (error) => {
          console.error(
            '[FormLab] User load failed:',
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
   * USER / PLAN
   * ==========================================================
   */

  const plan =
    user?.subscription_plan ||
    'free';

  const isElite =
    plan ===
    'elite';

  const selectedEx =
    FORM_EXERCISES.find(
      (item) =>
        item.name ===
        exercise
    );

  const exCategory =
    selectedEx?.category ||
    'dynamic';

  /*
   * ==========================================================
   * LOCK SCREEN
   * ==========================================================
   */

  if (
    !user
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (
    !isElite
  ) {
    return (
      <div className="px-5 pt-12 pb-24 flex flex-col items-center justify-center min-h-[80vh] text-center">

        <div className="w-20 h-20 rounded-3xl bg-chart-4/15 flex items-center justify-center mb-5 border border-chart-4/20">

          <Crown className="w-10 h-10 text-chart-4" />

        </div>

        <h1 className="font-heading text-2xl font-bold mb-2">
          Form Analysis is Elite-only
        </h1>

        <p className="text-muted-foreground text-sm max-w-xs mb-6">
          AI-powered form analysis with
          video analysis, form scoring,
          rep/hold counting, and corrective
          drills. Unlock it with the Elite
          plan.
        </p>

        <Button
          type="button"
          onClick={() =>
            navigate(
              '/profile'
            )
          }
          className="h-12 px-8 font-heading font-semibold"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade to Elite
        </Button>

      </div>
    );
  }

  /*
   * ==========================================================
   * VIDEO SELECTED
   * ==========================================================
   */

  const handleVideoSelected =
    async (
      file
    ) => {
      if (
        !file
      ) {
        return;
      }

      setUploading(
        true
      );

      setErrorMessage(
        ''
      );

      setResult(
        null
      );

      setAutoDetected(
        false
      );

      try {
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
            'The video uploaded, but no video URL was returned.'
          );
        }

        setVideoUrl(
          uploaded.file_url
        );

        const nextParams =
          new URLSearchParams(
            searchParams
          );

        nextParams.set(
          'step',
          'preview'
        );

        setSearchParams(
          nextParams
        );
      } catch (
        error
      ) {
        console.error(
          '[FormLab] Video upload failed:',
          error
        );

        setErrorMessage(
          error?.message ||
            'The video could not be uploaded.'
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  /*
   * ==========================================================
   * VIDEO METADATA
   * ==========================================================
   */

  const handleMetadata =
    () => {
      const duration =
        videoRef.current
          ?.duration ||
        0;

      setVideoDuration(
        duration
      );

      setTrimStart(
        0
      );

      setTrimEnd(
        duration
      );
    };

  /*
   * ==========================================================
   * TRIM START
   * ==========================================================
   */

  const handleTrimStart =
    (
      value
    ) => {
      setTrimStart(
        value
      );

      if (
        videoRef.current &&
        value <
          trimEnd
      ) {
        videoRef.current.currentTime =
          value;
      }
    };

  /*
   * ==========================================================
   * TRIM END
   * ==========================================================
   */

  const handleTrimEnd =
    (
      value
    ) => {
      setTrimEnd(
        value
      );

      if (
        videoRef.current &&
        value >
          trimStart
      ) {
        videoRef.current.currentTime =
          value;
      }
    };

  /*
   * ==========================================================
   * ANALYZE
   * ==========================================================
   */

  const handleAnalyze =
    async () => {
      if (
        !videoUrl ||
        !exercise ||
        analyzing
      ) {
        return;
      }

      /*
       * Clear previous result/error.
       */
      setErrorMessage(
        ''
      );

      setResult(
        null
      );

      setAnalyzing(
        true
      );

      try {
        /*
         * Build the specialist form-analysis prompt.
         */
        const prompt =
          buildFormAnalysisPrompt(
            exercise,
            exCategory,
            user,
            trimStart,
            trimEnd
          );

        /*
         * Ask the AI to produce exactly the fields
         * required by AnalysisResults.jsx.
         */
        const response =
          await supabaseApi.ai.invoke(
            {
              prompt,

              file_urls: [
                videoUrl,
              ],

              type:
                'form_analysis',

              response_json_schema: {
                type:
                  'object',

                additionalProperties:
                  false,

                properties: {
                  camera_angle_ok: {
                    type:
                      'boolean',
                  },

                  camera_angle_note: {
                    type:
                      'string',
                  },

                  score: {
                    type:
                      'number',
                  },

                  rep_count: {
                    type:
                      [
                        'number',
                        'null',
                      ],
                  },

                  hold_time_seconds: {
                    type:
                      [
                        'number',
                        'null',
                      ],
                  },

                  active_range_start: {
                    type:
                      [
                        'number',
                        'null',
                      ],
                  },

                  active_range_end: {
                    type:
                      [
                        'number',
                        'null',
                      ],
                  },

                  overall_assessment: {
                    type:
                      'string',
                  },

                  issues: {
                    type:
                      'array',

                    items: {
                      type:
                        'object',

                      additionalProperties:
                        false,

                      properties: {
                        area: {
                          type:
                            'string',
                        },

                        problem: {
                          type:
                            'string',
                        },

                        severity: {
                          type:
                            'string',

                          enum: [
                            'minor',
                            'moderate',
                            'major',
                            'critical',
                          ],
                        },

                        fix: {
                          type:
                            'string',
                        },

                        corrective_exercises: {
                          type:
                            'array',

                          items: {
                            type:
                              'string',
                          },
                        },
                      },

                      required: [
                        'area',
                        'problem',
                        'severity',
                        'fix',
                        'corrective_exercises',
                      ],
                    },
                  },

                  priority_focus: {
                    type:
                      'array',

                    items: {
                      type:
                        'string',
                    },
                  },
                },

                required: [
                  'camera_angle_ok',
                  'camera_angle_note',
                  'score',
                  'rep_count',
                  'hold_time_seconds',
                  'active_range_start',
                  'active_range_end',
                  'overall_assessment',
                  'issues',
                  'priority_focus',
                ],
              },
            }
          );

        /*
         * Defensive validation.
         */
        if (
          !response
        ) {
          throw new Error(
            'The AI returned no analysis.'
          );
        }

        if (
          typeof response.score !==
            'number'
        ) {
          throw new Error(
            'The AI response did not contain a valid form score.'
          );
        }

        if (
          typeof response.overall_assessment !==
            'string'
        ) {
          throw new Error(
            'The AI response did not contain an overall assessment.'
          );
        }

        /*
         * Put result on screen immediately.
         */
        setResult(
          response
        );

        /*
         * Switch to results view.
         */
        const nextParams =
          new URLSearchParams(
            searchParams
          );

        nextParams.set(
          'step',
          'results'
        );

        setSearchParams(
          nextParams
        );

        /*
         * Auto-set detected active range when valid.
         */
        if (
          response.active_range_start !=
            null &&
          response.active_range_end !=
            null &&
          response.active_range_end >
            response.active_range_start
        ) {
          setTrimStart(
            response.active_range_start
          );

          setTrimEnd(
            response.active_range_end
          );

          setAutoDetected(
            true
          );
        }

        /*
         * Save analysis.
         *
         * This should NOT prevent the user from seeing the result.
         */
        try {
          const today =
            new Date()
              .toISOString()
              .split('T')[0];

          await supabaseApi.entities.FormAnalysis.create(
            {
              video_url:
                videoUrl,

              exercise_name:
                exercise,

              exercise_category:
                exCategory,

              score:
                response.score,

              rep_count:
                response.rep_count,

              hold_time_seconds:
                response.hold_time_seconds,

              analysis:
                response.overall_assessment,

              issues:
                response.issues,

              date:
                today,
            }
          );
        } catch (
          saveError
        ) {
          /*
           * Saving history failing should not make
           * a successful AI analysis disappear.
           */
          console.error(
            '[FormLab] Could not save analysis history:',
            saveError
          );
        }
      } catch (
        error
      ) {
        console.error(
          '[FormLab] Form analysis failed:',
          error
        );

        setErrorMessage(
          error?.message ||
            'Form analysis failed. Please try again.'
        );
      } finally {
        setAnalyzing(
          false
        );
      }
    };

  /*
   * ==========================================================
   * RESET
   * ==========================================================
   */

  const reset =
    () => {
      setVideoUrl(
        null
      );

      setResult(
        null
      );

      setErrorMessage(
        ''
      );

      setExercise(
        ''
      );

      setTrimStart(
        0
      );

      setTrimEnd(
        0
      );

      setVideoDuration(
        0
      );

      setAutoDetected(
        false
      );

      setSearchParams(
        {}
      );
    };

  /*
   * ==========================================================
   * TIME FORMAT
   * ==========================================================
   */

  const fmtTime =
    (
      seconds
    ) => {
      const safe =
        Number.isFinite(
          seconds
        )
          ? Math.max(
              0,
              seconds
            )
          : 0;

      const minutes =
        Math.floor(
          safe / 60
        );

      const secondsPart =
        Math.floor(
          safe % 60
        );

      return `${minutes}:${secondsPart
        .toString()
        .padStart(
          2,
          '0'
        )}`;
    };

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div className="px-5 safe-bottom">

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">

        <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/20">

          <Eye className="w-5 h-5 text-primary" />

        </div>

        <div>

          <h1 className="font-heading text-2xl font-bold leading-tight">
            Form Analysis
          </h1>

          <p className="text-xs text-muted-foreground">
            AI form analysis · Elite feature
          </p>

        </div>

      </div>

      <p className="text-sm text-muted-foreground mb-5">
        Record or upload any calisthenics
        movement. Kael analyzes your
        technique, counts reps or hold
        time, scores your form, and gives
        you specific corrections.
      </p>

      {/* Error */}
      {errorMessage && (
        <Card className="mb-4 p-4 border-destructive/30 bg-destructive/5">

          <div className="flex items-start gap-3">

            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />

            <div className="flex-1">

              <p className="font-heading font-bold text-sm text-destructive">
                Form analysis couldn't be completed
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                {errorMessage}
              </p>

            </div>

          </div>

        </Card>
      )}

      {/* Step 1 */}
      {(step === 'select' ||
        !videoUrl) && (
        <div className="space-y-4">

          <Card className="p-4">

            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Step 1: What are you analyzing?
            </p>

            <Input
              value={
                exercise
              }
              onChange={(
                event
              ) =>
                setExercise(
                  event.target.value
                )
              }
              placeholder="e.g. Push-up, Pull-up, Handstand…"
              className="h-12 text-base"
              disabled={
                uploading ||
                analyzing
              }
            />

          </Card>

          <Card className="p-4">

            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Step 2: Record or upload video
            </p>

            <VideoInput
              onVideoSelected={
                handleVideoSelected
              }
              disabled={
                !exercise ||
                uploading ||
                analyzing
              }
            />

            {!exercise && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Select an exercise first
              </p>
            )}

            {uploading && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">

                <Loader2 className="w-4 h-4 animate-spin" />

                Uploading video…

              </div>
            )}

          </Card>

          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">

            <div className="flex items-center gap-2 mb-1">

              <Sparkles className="w-4 h-4 text-primary" />

              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Tips for best results
              </p>

            </div>

            <ul className="text-xs text-muted-foreground space-y-1">

              <li>
                • Film from the
                <span className="font-semibold text-foreground">
                  side
                </span>
                at torso height
              </li>

              <li>
                • Keep your
                <span className="font-semibold text-foreground">
                  full body in frame
                </span>
              </li>

              <li>
                • Use good lighting
              </li>

              <li>
                • Holds: 2-3+ seconds
              </li>

              <li>
                • Reps: 3-5 clean reps
              </li>

            </ul>

          </div>

        </div>
      )}

      {/* Preview / analysis */}
      {videoUrl &&
        step !==
          'select' && (
        <div className="space-y-4">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <Video className="w-4 h-4 text-primary" />

              <span className="font-heading font-bold text-sm">
                {exercise}
              </span>

            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={
                reset
              }
              disabled={
                analyzing
              }
              className="text-muted-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              New video
            </Button>

          </div>

          {/* Video */}
          <video
            ref={
              videoRef
            }
            src={
              videoUrl
            }
            controls
            playsInline
            className="w-full rounded-2xl border border-border bg-black"
            onLoadedMetadata={
              handleMetadata
            }
          />

          {/* Trim */}
          {videoDuration >
            1 && (
            <Card className="p-4">

              <div className="flex items-center gap-2 mb-3">

                <Scissors className="w-4 h-4 text-primary" />

                <p className="text-xs font-bold uppercase tracking-wider">
                  Trim analysis window
                </p>

                {autoDetected && (
                  <span className="text-[10px] text-accent font-medium ml-auto">
                    Auto-detected by AI
                  </span>
                )}

              </div>

              <div className="space-y-3">

                <div>

                  <div className="flex justify-between text-xs text-muted-foreground mb-1">

                    <span>
                      Start
                    </span>

                    <span className="font-bold text-foreground">
                      {
                        fmtTime(
                          trimStart
                        )
                      }
                    </span>

                  </div>

                  <input
                    aria-label="Trim start time"
                    type="range"
                    min={0}
                    max={
                      videoDuration
                    }
                    step={0.1}
                    value={
                      trimStart
                    }
                    onChange={(
                      event
                    ) =>
                      handleTrimStart(
                        parseFloat(
                          event.target.value
                        )
                      )
                    }
                    disabled={
                      analyzing
                    }
                    className="w-full accent-primary"
                  />

                </div>

                <div>

                  <div className="flex justify-between text-xs text-muted-foreground mb-1">

                    <span>
                      End
                    </span>

                    <span className="font-bold text-foreground">
                      {
                        fmtTime(
                          trimEnd
                        )
                      }
                    </span>

                  </div>

                  <input
                    aria-label="Trim end time"
                    type="range"
                    min={0}
                    max={
                      videoDuration
                    }
                    step={0.1}
                    value={
                      trimEnd
                    }
                    onChange={(
                      event
                    ) =>
                      handleTrimEnd(
                        parseFloat(
                          event.target.value
                        )
                      )
                    }
                    disabled={
                      analyzing
                    }
                    className="w-full accent-primary"
                  />

                </div>

                <p className="text-[11px] text-muted-foreground">
                  Kael analyzes only this
                  section of the video.
                </p>

              </div>

            </Card>
          )}

          {/* Analyze */}
          {step !==
            'results' ||
            !result ? (
            <Button
              type="button"
              className="w-full h-12 font-heading font-semibold"
              disabled={
                analyzing ||
                uploading ||
                !videoUrl ||
                !exercise
              }
              onClick={
                handleAnalyze
              }
            >

              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing your form…
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Analyze my form
                </>
              )}

            </Button>
          ) : null}

          {analyzing && (
            <div className="text-center text-xs text-muted-foreground px-4">

              Kael is analyzing your video
              for alignment, joint position,
              range of motion, scapular
              mechanics, and exercise-specific
              technique.

            </div>
          )}

          {/* Results */}
          {result &&
            step ===
              'results' && (
            <>

              <div className="flex items-center gap-2">

                <Sparkles className="w-4 h-4 text-accent" />

                <h3 className="font-heading font-bold text-base">
                  Analysis Results
                </h3>

              </div>

              <AnalysisResults
                result={
                  result
                }
                exercise={
                  exercise
                }
              />

              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={() => {
                  setResult(
                    null
                  );

                  setErrorMessage(
                    ''
                  );

                  setAutoDetected(
                    false
                  );

                  const nextParams =
                    new URLSearchParams(
                      searchParams
                    );

                  nextParams.set(
                    'step',
                    'preview'
                  );

                  setSearchParams(
                    nextParams
                  );
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Re-analyze with new trim
              </Button>

            </>
          )}

        </div>
      )}

    </div>
  );
}
