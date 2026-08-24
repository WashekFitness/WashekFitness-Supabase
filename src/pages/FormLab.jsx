import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crown, Eye, Sparkles, Video, Scissors, RotateCcw } from 'lucide-react';
import VideoInput from '@/components/formlab/VideoInput';
import AnalysisResults from '@/components/formlab/AnalysisResults';
import { Input } from '@/components/ui/input';
import { FORM_EXERCISES, buildFormAnalysisPrompt } from '@/lib/formAnalysis';

export default function FormLab() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [exercise, setExercise] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [autoDetected, setAutoDetected] = useState(false);
  const videoRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const step = searchParams.get('step') || 'select';

  useEffect(() => { supabaseApi.auth.me().then(setUser); }, []);

  const plan = user?.subscription_plan || 'free';
  const isElite = plan === 'elite';
  const selectedEx = FORM_EXERCISES.find(e => e.name === exercise);
  const exCategory = selectedEx?.category || 'dynamic';

  // ── Lock screens ──
  if (!user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!isElite) {
    return (
      <div className="px-5 pt-12 pb-24 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <div className="w-20 h-20 rounded-3xl bg-chart-4/15 flex items-center justify-center mb-5 border border-chart-4/20">
          <Crown className="w-10 h-10 text-chart-4" />
        </div>
        <h1 className="font-heading text-2xl font-bold mb-2">Form Analysis is Elite-only</h1>
        <p className="text-muted-foreground text-sm max-w-xs mb-6">
          AI-powered form analysis with frame-level precision. Record any calisthenics movement and get a score, rep/hold count, and corrective drills. Works with any training program — analyze your calisthenics skills here. Unlock with the Elite plan.
        </p>
        <Button onClick={() => navigate('/profile')} className="h-12 px-8 font-heading font-semibold">
          <Crown className="w-4 h-4" /> Upgrade to Elite
        </Button>
      </div>
    );
  }

  // ── Handle video selection ──
  const handleVideoSelected = async (file) => {
    setUploading(true);
    setResult(null);
    setAutoDetected(false);
    try {
      const { file_url } = await supabaseApi.storage.uploadFile({ file });
      setVideoUrl(file_url);
      const n = new URLSearchParams(searchParams);
      n.set('step', 'preview');
      setSearchParams(n);
    } catch {
      // failed upload
    }
    setUploading(false);
  };

  // ── Video metadata loaded ──
  const handleMetadata = () => {
    const dur = videoRef.current?.duration || 0;
    setVideoDuration(dur);
    setTrimStart(0);
    setTrimEnd(dur);
  };

  // ── Seek to trim start when slider changes ──
  const handleTrimStart = (val) => {
    setTrimStart(val);
    if (videoRef.current && val < trimEnd) videoRef.current.currentTime = val;
  };
  const handleTrimEnd = (val) => {
    setTrimEnd(val);
    if (videoRef.current && val > trimStart) videoRef.current.currentTime = val;
  };

  // ── Analyze ──
  const handleAnalyze = async () => {
    if (!videoUrl || !exercise || analyzing) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const prompt = buildFormAnalysisPrompt(exercise, exCategory, user, trimStart, trimEnd);
      const res = await supabaseApi.ai.invoke({
        prompt,
        file_urls: [videoUrl],
        type: 'form_analysis',
        response_json_schema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            rep_count: { type: 'number' },
            hold_time_seconds: { type: 'number' },
            active_range_start: { type: 'number' },
            active_range_end: { type: 'number' },
            overall_assessment: { type: 'string' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string' },
                  problem: { type: 'string' },
                  severity: { type: 'string' },
                  fix: { type: 'string' },
                  corrective_exercises: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            priority_focus: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      setResult(res);
      const n = new URLSearchParams(searchParams);
      n.set('step', 'results');
      setSearchParams(n);

      // Auto-set trim to detected active range
      if (res.active_range_start != null && res.active_range_end != null && res.active_range_end > res.active_range_start) {
        setTrimStart(res.active_range_start);
        setTrimEnd(res.active_range_end);
        setAutoDetected(true);
      }

      // Save to entity
      const today = new Date().toISOString().split('T')[0];
      supabaseApi.entities.FormAnalysis.create({
        video_url: videoUrl,
        exercise_name: exercise,
        exercise_category: exCategory,
        score: res.score,
        rep_count: res.rep_count,
        hold_time_seconds: res.hold_time_seconds,
        analysis: res.overall_assessment,
        issues: res.issues,
        date: today,
      });
    } catch {
      // analysis failed
    }
    setAnalyzing(false);
  };

  const reset = () => {
    setVideoUrl(null);
    setResult(null);
    setExercise('');
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setAutoDetected(false);
    setSearchParams({});
  };

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="px-5 safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/20">
          <Eye className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold leading-tight">Form Analysis</h1>
          <p className="text-xs text-muted-foreground">AI form analysis · Elite feature</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Record or upload any calisthenics movement — from push-ups and pull-ups to handstands and planches. AI counts your reps/hold time, scores your form 1-100, and tells you exactly what to fix.
      </p>

      {/* Step 1: Exercise selection */}
      {(step === 'select' || !videoUrl) && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Step 1: What are you analyzing?</p>
            <Input
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              placeholder="e.g. Push-ups, Pull-ups, Handstand hold…"
              className="h-12 text-base"
            />
          </Card>

          <Card className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Step 2: Record or upload video</p>
            <VideoInput onVideoSelected={handleVideoSelected} disabled={!exercise} />
            {!exercise && <p className="text-xs text-muted-foreground mt-2 text-center">Select an exercise first</p>}
            {uploading && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Uploading video…
              </div>
            )}
          </Card>

          {/* Tips */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Tips for best results</p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Film from the <span className="font-semibold text-foreground">side</span> at torso height — this is the best angle</li>
              <li>• Make sure your <span className="font-semibold text-foreground">full body is in frame</span> for the entire movement</li>
              <li>• Good lighting, no shadows across your body</li>
              <li>• For holds, hold for at least 2-3 seconds</li>
              <li>• For reps, do 3-5 clean reps — quality over quantity</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 3: Video preview + trim + analyze */}
      {videoUrl && step !== 'select' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              <span className="font-heading font-bold text-sm">{exercise}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              <RotateCcw className="w-3.5 h-3.5" /> New video
            </Button>
          </div>

          {/* Video player */}
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            className="w-full rounded-2xl border border-border bg-black"
            onLoadedMetadata={handleMetadata}
          />

          {/* Trim controls */}
          {videoDuration > 1 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Scissors className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold uppercase tracking-wider">Trim analysis window</p>
                {autoDetected && <span className="text-[10px] text-accent font-medium ml-auto">Auto-detected by AI</span>}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Start</span>
                    <span className="font-bold text-foreground">{fmtTime(trimStart)}</span>
                  </div>
                  <input
                    aria-label="Trim start time"
                    type="range"
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => handleTrimStart(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>End</span>
                    <span className="font-bold text-foreground">{fmtTime(trimEnd)}</span>
                  </div>
                  <input
                    aria-label="Trim end time"
                    type="range"
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => handleTrimEnd(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  AI auto-detects the hold/reps and sets this window. Adjust if needed — only this section gets analyzed.
                </p>
              </div>
            </Card>
          )}

          {/* Analyze button */}
          {(step !== 'results' || !result) && (
            <Button
              className="w-full h-12 font-heading font-semibold"
              disabled={analyzing}
              onClick={handleAnalyze}
            >
              {analyzing ? (
                <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Analyzing form…</>
              ) : (
                <><Eye className="w-4 h-4" /> Analyze my form</>
              )}
            </Button>
          )}

          {analyzing && (step !== 'results' || !result) && (
            <div className="text-center text-xs text-muted-foreground px-4">
              This takes 10-30 seconds. AI is watching frame by frame — checking joints, alignment, scapular position, and form quality.
            </div>
          )}

          {/* Results */}
          {result && step === 'results' && (
            <>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-base">Analysis Results</h3>
              </div>
              <AnalysisResults result={result} exercise={exercise} />
              <Button variant="outline" className="w-full h-11" onClick={() => { setResult(null); setAutoDetected(false); const n = new URLSearchParams(searchParams); n.set('step', 'preview'); setSearchParams(n); }}>
                <RotateCcw className="w-4 h-4" /> Re-analyze with new trim
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}