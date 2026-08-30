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

/*
 * ============================================================
 * FORM ANALYSIS SCHEMA
 * ============================================================
 */

const FORM_ANALYSIS_SCHEMA = {
  type: 'object',

  additionalProperties: false,

  properties: {
    camera_angle_ok: {
      type: 'boolean',
    },

    camera_angle_note: {
      type: 'string',
    },

    score: {
      type: 'number',
    },

    rep_count: {
      type: [
        'number',
        'null',
      ],
    },

    hold_time_seconds: {
      type: [
        'number',
        'null',
      ],
    },

    active_range_start: {
      type: [
        'number',
        'null',
      ],
    },

    active_range_end: {
      type: [
        'number',
        'null',
      ],
    },

    overall_assessment: {
      type: 'string',
    },

    issues: {
      type: 'array',

      items: {
        type: 'object',

        additionalProperties: false,

        properties: {
          area: {
            type: 'string',
          },

          problem: {
            type: 'string',
          },

          severity: {
            type: 'string',

            enum: [
              'minor',
              'moderate',
              'major',
              'critical',
            ],
          },

          fix: {
            type: 'string',
          },

          corrective_exercises: {
            type: 'array',

            items: {
              type: 'string',
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
      type: 'array',

      items: {
        type: 'string',
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
};

/*
 * ============================================================
 * VIDEO → STILL FRAMES
 * ============================================================
 *
 * IMPORTANT:
 *
 * The video itself is NOT sent to OpenRouter.
 *
 * This creates JPEG frames in the browser and uploads those
 * images instead. That avoids the $1 video-balance requirement
 * on your zero-balance OpenRouter account.
 */

async function videoFileToFrames(
  file,
  startTime,
  endTime
) {
  if (
    !file
  ) {
    throw new Error(
      'No video file was provided.'
    );
  }

  const blobUrl =
    URL.createObjectURL(
      file
    );

  const video =
    document.createElement(
      'video'
    );

  video.preload =
    'auto';

  video.muted =
    true;

  video.playsInline =
    true;

  video.src =
    blobUrl;

  try {
    /*
     * --------------------------------------------------------
     * LOAD VIDEO
     * --------------------------------------------------------
     */

    await new Promise(
      (
        resolve,
        reject
      ) => {
        const handleLoaded =
          () =>
            resolve();

        const handleError =
          () =>
            reject(
              new Error(
                'The video could not be read by the browser.'
              )
            );

        video.addEventListener(
          'loadedmetadata',
          handleLoaded,
          {
            once: true,
          }
        );

        video.addEventListener(
          'error',
          handleError,
          {
            once: true,
          }
        );

        video.load();
      }
    );

    /*
     * --------------------------------------------------------
     * DURATION
     * --------------------------------------------------------
     */

    const duration =
      Number.isFinite(
        video.duration
      )
        ? video.duration
        : 0;

    if (
      duration <=
      0
    ) {
      throw new Error(
        'The video duration could not be determined.'
      );
    }

    /*
     * --------------------------------------------------------
     * ANALYSIS WINDOW
     * --------------------------------------------------------
     */

    const start =
      Math.max(
        0,
        Math.min(
          Number(
            startTime
          ) || 0,
          duration
        )
      );

    const end =
      Math.max(
        start,
        Math.min(
          Number(
            endTime
          ) || duration,
          duration
        )
      );

    const windowDuration =
      Math.max(
        0.1,
        end - start
      );

    /*
     * --------------------------------------------------------
     * NUMBER OF FRAMES
     * --------------------------------------------------------
     *
     * Keep this reasonable so the request remains small enough
     * for free AI.
     */

    let frameCount;

    if (
      windowDuration <=
      3
    ) {
      frameCount =
        8;
    } else if (
      windowDuration <=
      6
    ) {
      frameCount =
        10;
    } else if (
      windowDuration <=
      10
    ) {
      frameCount =
        12;
    } else if (
      windowDuration <=
      15
    ) {
      frameCount =
        14;
    } else {
      frameCount =
        16;
    }

    /*
     * --------------------------------------------------------
     * TIMESTAMPS
     * --------------------------------------------------------
     */

    const timestamps =
      [];

    if (
      frameCount ===
      1
    ) {
      timestamps.push(
        start
      );
    } else {
      for (
        let i = 0;
        i <
        frameCount;
        i += 1
      ) {
        const ratio =
          i /
          (
            frameCount -
            1
          );

        const timestamp =
          start +
          (
            windowDuration *
            ratio
          );

        timestamps.push(
          Math.max(
            start,
            Math.min(
              end,
              timestamp
            )
          )
        );
      }
    }

    /*
     * --------------------------------------------------------
     * CANVAS
     * --------------------------------------------------------
     *
     * Limit width to keep images reasonably small.
     */

    const maxWidth =
      1280;

    const videoWidth =
      video.videoWidth ||
      1280;

    const videoHeight =
      video.videoHeight ||
      720;

    const scale =
      videoWidth >
      maxWidth
        ? maxWidth /
          videoWidth
        : 1;

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      Math.max(
        1,
        Math.round(
          videoWidth *
            scale
        )
      );

    canvas.height =
      Math.max(
        1,
        Math.round(
          videoHeight *
            scale
        )
      );

    const ctx =
      canvas.getContext(
        '2d'
      );

    if (
      !ctx
    ) {
      throw new Error(
        'Your browser could not prepare video frames.'
      );
    }

    /*
     * --------------------------------------------------------
     * EXTRACT FRAMES
     * --------------------------------------------------------
     */

    const frames =
      [];

    for (
      let i = 0;
      i <
      timestamps.length;
      i += 1
    ) {
      const timestamp =
        timestamps[i];

      video.currentTime =
        timestamp;

      await new Promise(
        (
          resolve,
          reject
        ) => {
          let settled =
            false;

          const cleanup =
            () => {
              video.removeEventListener(
                'seeked',
                handleSeeked
              );

              video.removeEventListener(
                'error',
                handleError
              );
            };

          const handleSeeked =
            () => {
              if (
                settled
              ) {
                return;
              }

              settled =
                true;

              cleanup();
              resolve();
            };

          const handleError =
            () => {
              if (
                settled
              ) {
                return;
              }

              settled =
                true;

              cleanup();

              reject(
                new Error(
                  `Frame ${i + 1} could not be read from the video.`
                )
              );
            };

          video.addEventListener(
            'seeked',
            handleSeeked,
            {
              once: true,
            }
          );

          video.addEventListener(
            'error',
            handleError,
            {
              once: true,
            }
          );
        }
      );

      ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob =
        await new Promise(
          (
            resolve,
            reject
          ) => {
            canvas.toBlob(
              output => {
                if (
                  output
                ) {
                  resolve(
                    output
                  );
                } else {
                  reject(
                    new Error(
                      `Frame ${i + 1} could not be encoded.`
                    )
                  );
                }
              },
              'image/jpeg',
              0.78
            );
          }
        );

      const frameFile =
        new File(
          [
            blob,
          ],
          `form-frame-${String(
            i + 1
          ).padStart(
            2,
            '0'
          )}.jpg`,
          {
            type:
              'image/jpeg',
          }
        );

      frames.push({
        index:
          i + 1,

        timestamp,

        file:
          frameFile,
      });
    }

    return {
      frames,

      duration,

      start,

      end,
    };
  } finally {
    URL.revokeObjectURL(
      blobUrl
    );
  }
}

/*
 * ============================================================
 * MAIN COMPONENT
 * ============================================================
 */

export default function FormLab() {
  const navigate =
    useNavigate();

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

  /*
   * Keep BOTH the original video File and uploaded URL.
   *
   * The File is required later to extract frames.
   */

  const [
    videoFile,
    setVideoFile,
  ] =
    useState(null);

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
    progressText,
    setProgressText,
  ] =
    useState('');

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

  /*
   * ==========================================================
   * LOAD USER
   * ==========================================================
   */

  useEffect(
    () => {
      let mounted =
        true;

      supabaseApi.auth
        .me()
        .then(
          currentUser => {
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
          error => {
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
    },
    []
  );

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
      ex =>
        ex.name ===
        exercise
    );

  const exCategory =
    selectedEx?.category ||
    'dynamic';

  /*
   * ==========================================================
   * LOADING USER
   * ==========================================================
   */

  if (
    !user
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">

        <Loader2 className="w-8 h-8 animate-spin text-primary" />

      </div>
    );
  }

  /*
   * ==========================================================
   * ELITE LOCK
   * ==========================================================
   */

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
          frame-level precision. Record any
          calisthenics movement and get a
          score, rep/hold assessment, and
          corrective drills.
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
    async file => {
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

      setVideoFile(
        file
      );

      try {
        if (
          !file.type.startsWith(
            'video/'
          )
        ) {
          throw new Error(
            'Please choose a video file.'
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

        setVideoFile(
          null
        );

        setVideoUrl(
          null
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

      if (
        !Number.isFinite(
          duration
        ) ||
        duration <=
          0
      ) {
        return;
      }

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
   * TRIM CONTROLS
   * ==========================================================
   */

  const handleTrimStart =
    value => {
      const next =
        Math.min(
          Math.max(
            0,
            Number(
              value
            ) || 0
          ),
          Math.max(
            0,
            trimEnd -
              0.1
          )
        );

      setTrimStart(
        next
      );

      if (
        videoRef.current
      ) {
        videoRef.current.currentTime =
          next;
      }
    };

  const handleTrimEnd =
    value => {
      const next =
        Math.max(
          Math.min(
            videoDuration,
            Number(
              value
            ) ||
              videoDuration
          ),
          Math.min(
            videoDuration,
            trimStart +
              0.1
          )
        );

      setTrimEnd(
        next
      );

      if (
        videoRef.current
      ) {
        videoRef.current.currentTime =
          next;
      }
    };

  /*
   * ==========================================================
   * ANALYZE FORM
   * ==========================================================
   */

  const handleAnalyze =
    async () => {
      if (
        !videoFile ||
        !videoUrl ||
        !exercise ||
        analyzing
      ) {
        return;
      }

      setAnalyzing(
        true
      );

      setResult(
        null
      );

      setErrorMessage(
        ''
      );

      try {
        /*
         * ------------------------------------------------------
         * STEP 1 — EXTRACT FRAMES
         * ------------------------------------------------------
         */

        setProgressText(
          'Preparing video frames…'
        );

        const {
          frames,
          duration,
          start,
          end,
        } =
          await videoFileToFrames(
            videoFile,
            trimStart,
            trimEnd ||
              videoDuration
          );

        /*
         * ------------------------------------------------------
         * STEP 2 — UPLOAD FRAMES
         * ------------------------------------------------------
         */

        setProgressText(
          `Uploading ${frames.length} analysis frames…`
        );

        const uploadedFrames =
          [];

        for (
          let i = 0;
          i <
          frames.length;
          i += 1
        ) {
          const frame =
            frames[i];

          const uploaded =
            await supabaseApi.storage.uploadFile(
              {
                file:
                  frame.file,

                folder:
                  'form-analysis-frames',
              }
            );

          if (
            !uploaded?.file_url
          ) {
            throw new Error(
              `Analysis frame ${frame.index} could not be uploaded.`
            );
          }

          uploadedFrames.push({
            url:
              uploaded.file_url,

            timestamp:
              frame.timestamp,

            index:
              frame.index,
          });
        }

        /*
         * ------------------------------------------------------
         * STEP 3 — BUILD TIMELINE
         * ------------------------------------------------------
         */

        setProgressText(
          'Kael is analyzing your movement…'
        );

        const frameTimeline =
          uploadedFrames
            .map(
              frame =>
                `Frame ${frame.index}: ${frame.timestamp.toFixed(
                  2
                )} seconds`
            )
            .join(
              '\n'
            );

        const prompt =
          `${buildFormAnalysisPrompt(
            exercise,
            exCategory,
            user,
            start,
            end
          )}

IMPORTANT:
The original video is NOT being sent to the AI.

Instead, the AI receives chronological still frames extracted from the selected analysis window.

FULL VIDEO DURATION:
${duration.toFixed(
  2
)} seconds

SELECTED WINDOW:
${start.toFixed(
  2
)}s to ${end.toFixed(
  2
)}s

FRAME TIMELINE:
${frameTimeline}

Analyze all supplied frames together as ONE chronological movement.

Use the supplied frame timestamps when estimating the active range.

Do not claim continuous-frame precision that the sampled images cannot support.

Return ONLY the requested JSON object.
`;

        /*
         * ------------------------------------------------------
         * STEP 4 — AI
         * ------------------------------------------------------
         */

        const frameUrls =
          uploadedFrames.map(
            frame =>
              frame.url
          );

        const response =
          await supabaseApi.ai.invoke(
            {
              prompt,

              file_urls:
                frameUrls,

              type:
                'form_analysis',

              response_json_schema:
                FORM_ANALYSIS_SCHEMA,
            }
          );

        /*
         * ------------------------------------------------------
         * STEP 5 — VALIDATE RESULT
         * ------------------------------------------------------
         */

        if (
          !response
        ) {
          throw new Error(
            'Kael returned no form analysis.'
          );
        }

        if (
          typeof response.score !==
          'number'
        ) {
          throw new Error(
            'Kael did not return a valid form score.'
          );
        }

        if (
          typeof response.overall_assessment !==
          'string'
        ) {
          throw new Error(
            'Kael did not return an overall assessment.'
          );
        }

        /*
         * ------------------------------------------------------
         * STEP 6 — CLEAN RESULT
         * ------------------------------------------------------
         */

        const cleanedResult =
          {
            camera_angle_ok:
              Boolean(
                response.camera_angle_ok
              ),

            camera_angle_note:
              String(
                response.camera_angle_note ||
                  ''
              ),

            score:
              Math.max(
                1,
                Math.min(
                  100,
                  Number(
                    response.score
                  )
                )
              ),

            rep_count:
              response.rep_count ==
              null
                ? null
                : Number(
                    response.rep_count
                  ),

            hold_time_seconds:
              response.hold_time_seconds ==
              null
                ? null
                : Number(
                    response.hold_time_seconds
                  ),

            active_range_start:
              response.active_range_start ==
              null
                ? start
                : Number(
                    response.active_range_start
                  ),

            active_range_end:
              response.active_range_end ==
              null
                ? end
                : Number(
                    response.active_range_end
                  ),

            overall_assessment:
              String(
                response.overall_assessment
              ),

            issues:
              Array.isArray(
                response.issues
              )
                ? response.issues
                : [],

            priority_focus:
              Array.isArray(
                response.priority_focus
              )
                ? response.priority_focus
                : [],
          };

        /*
         * ------------------------------------------------------
         * STEP 7 — SHOW RESULT
         * ------------------------------------------------------
         */

        setResult(
          cleanedResult
        );

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
         * Auto-set active range when valid.
         */

        if (
          cleanedResult.active_range_start !=
            null &&
          cleanedResult.active_range_end !=
            null &&
          cleanedResult.active_range_end >
            cleanedResult.active_range_start
        ) {
          setTrimStart(
            cleanedResult.active_range_start
          );

          setTrimEnd(
            cleanedResult.active_range_end
          );

          setAutoDetected(
            true
          );
        }

        /*
         * ------------------------------------------------------
         * STEP 8 — SAVE ANALYSIS
         * ------------------------------------------------------
         *
         * History saving should never make an already-successful
         * analysis disappear.
         */

        setProgressText(
          'Saving your analysis…'
        );

        try {
          const today =
            new Date()
              .toISOString()
              .split(
                'T'
              )[0];

          await supabaseApi.entities.FormAnalysis.create(
            {
              video_url:
                videoUrl,

              exercise_name:
                exercise,

              exercise_category:
                exCategory,

              score:
                cleanedResult.score,

              rep_count:
                cleanedResult.rep_count,

              hold_time_seconds:
                cleanedResult.hold_time_seconds,

              analysis:
                cleanedResult.overall_assessment,

              issues:
                cleanedResult.issues,

              date:
                today,
            }
          );
        } catch (
          saveError
        ) {
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
        /*
         * ALWAYS clear loading state.
         */

        setAnalyzing(
          false
        );

        setProgressText(
          ''
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
      setVideoFile(
        null
      );

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

      setProgressText(
        ''
      );

      setSearchParams(
        {}
      );
    };

  /*
   * ==========================================================
   * FORMAT TIME
   * ==========================================================
   */

  const fmtTime =
    seconds => {
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
          safe /
            60
        );

      const secs =
        Math.floor(
          safe %
            60
        );

      return `${minutes}:${secs
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

      {/* HEADER */}
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
        movement. Kael extracts chronological
        frames from your selected video section
        and analyzes your technique, form score,
        visible reps or hold quality, and
        corrective priorities.
      </p>

      {/* ERROR */}
      {errorMessage && (
        <Card className="mb-4 p-4 border-destructive/30 bg-destructive/5">

          <div className="flex items-start gap-3">

            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />

            <div className="flex-1">

              <p className="font-heading font-bold text-sm text-destructive">
                Form analysis couldn't be completed
              </p>

              <p className="text-xs text-muted-foreground mt-1 break-words">
                {
                  errorMessage
                }
              </p>

            </div>

          </div>

        </Card>
      )}

      {/* SELECT STEP */}
      {(step ===
        'select' ||
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
              onChange={e =>
                setExercise(
                  e.target
                    .value
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
                • Film from the{' '}
                <span className="font-semibold text-foreground">
                  side
                </span>{' '}
                at torso height
              </li>

              <li>
                • Keep your{' '}
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

      {/* PREVIEW / RESULTS */}
      {videoUrl &&
        step !==
          'select' && (
        <div className="space-y-4">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <Video className="w-4 h-4 text-primary" />

              <span className="font-heading font-bold text-sm">
                {
                  exercise
                }
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

          {/* VIDEO */}
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

          {/* TRIM */}
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
                    max={Math.max(
                      0,
                      trimEnd -
                        0.1
                    )}
                    step={0.1}
                    value={
                      trimStart
                    }
                    onChange={e =>
                      handleTrimStart(
                        parseFloat(
                          e.target
                            .value
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
                    min={Math.min(
                      videoDuration,
                      trimStart +
                        0.1
                    )}
                    max={
                      videoDuration
                    }
                    step={0.1}
                    value={
                      trimEnd
                    }
                    onChange={e =>
                      handleTrimEnd(
                        parseFloat(
                          e.target
                            .value
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
                  The selected video section is
                  converted into chronological
                  still frames before AI analysis.
                  This keeps Form Analysis compatible
                  with your free AI setup.
                </p>

              </div>

            </Card>
          )}

          {/* ANALYZE */}
          {(step !==
            'results' ||
            !result) && (
            <Button
              type="button"
              className="w-full h-12 font-heading font-semibold"
              disabled={
                analyzing ||
                !videoFile
              }
              onClick={
                handleAnalyze
              }
            >

              {analyzing ? (
                <>

                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />

                  {
                    progressText ||
                    'Analyzing your form…'
                  }

                </>
              ) : (
                <>

                  <Eye className="w-4 h-4 mr-2" />

                  Analyze my form

                </>
              )}

            </Button>
          )}

          {analyzing && (
            <div className="text-center text-xs text-muted-foreground px-4">

              {
                progressText ||
                'Preparing your analysis…'
              }

            </div>
          )}

          {/* RESULTS */}
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
