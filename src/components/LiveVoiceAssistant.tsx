import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Send, Sparkles, Volume2 } from 'lucide-react';
import { base64Pcm16ToFloat32, float32ToPcm16Base64 } from '../utils/audioPcm.ts';

interface LiveVoiceAssistantProps {
  applianceCategory: string;
  initialContext?: string;
  getAuthToken: () => Promise<string | null>;
  disabled?: boolean;
  onApplyTranscript: (summary: string, details: string) => void;
}

interface TranscriptTurn {
  id: string;
  speaker: 'user' | 'agent';
  text: string;
}

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

const VOICE_OPTIONS = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const;

export function LiveVoiceAssistant({
  applianceCategory,
  initialContext = '',
  getAuthToken,
  disabled = false,
  onApplyTranscript,
}: LiveVoiceAssistantProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [selectedVoice, setSelectedVoice] = useState<(typeof VOICE_OPTIONS)[number]>('Zephyr');
  const [micMuted, setMicMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [typedPrompt, setTypedPrompt] = useState('');
  const [appliedNotice, setAppliedNotice] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micMutedRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [turns]);

  const stopPlaybackQueue = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore stopped source errors
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const disconnectSession = useCallback(() => {
    stopPlaybackQueue();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      void inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      void outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'Client ended session');
        }
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    if (mountedRef.current) {
      setStatus((prev) => (prev === 'error' ? prev : 'idle'));
      setMicMuted(false);
    }
  }, [stopPlaybackQueue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnectSession();
    };
  }, [disconnectSession]);

  const appendTranscriptChunk = useCallback((speaker: 'user' | 'agent', chunk: string) => {
    const cleaned = chunk.replace(/\s+/g, ' ');
    if (!cleaned.trim()) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        const needsSpace =
          last.text.length > 0 &&
          !last.text.endsWith(' ') &&
          !cleaned.startsWith(' ') &&
          !/^[.,!?;:'")]/.test(cleaned);
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text}${needsSpace ? ' ' : ''}${cleaned.trimStart()}` },
        ];
      }
      return [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text: cleaned.trimStart(),
        },
      ];
    });
  }, []);

  const scheduleOutputAudio = useCallback((base64Pcm24k: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    const float32 = base64Pcm16ToFloat32(base64Pcm24k);
    if (float32.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
    source.start(startAt);
  }, []);

  const startSession = async () => {
    if (disabled || status === 'connecting' || status === 'live') return;
    setError(null);
    setAppliedNotice(false);
    setStatus('connecting');

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Sign in with a verified email account to use Live Voice Assistant.');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      await inputCtx.resume();
      await outputCtx.resume();
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams({
        token,
        voice: selectedVoice,
        category: applianceCategory,
        context: initialContext.slice(0, 400),
      });
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live-voice?${qs.toString()}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            audio?: string;
            text?: string;
            error?: string;
          };

          if (msg.type === 'ready') {
            setStatus('live');
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            sourceRef.current = source;
            processorRef.current = processor;

            processor.onaudioprocess = (audioEvent) => {
              if (micMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
              const samples = audioEvent.inputBuffer.getChannelData(0);
              const base64Audio = float32ToPcm16Base64(samples);
              ws.send(JSON.stringify({ audio: base64Audio }));
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          } else if (msg.type === 'audio' && msg.audio) {
            scheduleOutputAudio(msg.audio);
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendTranscriptChunk('user', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendTranscriptChunk('agent', msg.text);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
          } else if (msg.type === 'error') {
            setError(msg.error || 'Live voice session encountered an error.');
            setStatus('error');
            disconnectSession();
          }
        } catch (parseErr) {
          console.warn('Live voice message parse error:', parseErr);
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setError('WebSocket connection error while connecting to Live Voice.');
        setStatus('error');
        disconnectSession();
      };

      ws.onclose = (closeEvt) => {
        if (!mountedRef.current) return;
        if (closeEvt.code !== 1000 && closeEvt.reason && closeEvt.code !== 1005) {
          setError((prev) => prev || closeEvt.reason);
        }
        disconnectSession();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Live Voice session.');
      setStatus('error');
      disconnectSession();
    }
  };

  const handleSendTypedNote = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = typedPrompt.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: trimmed }));
    appendTranscriptChunk('user', trimmed);
    setTypedPrompt('');
  };

  const handleApplyToForm = () => {
    const userLines = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    const agentLines = turns.filter((t) => t.speaker === 'agent').map((t) => t.text);
    const summaryCandidate =
      userLines[0]?.slice(0, 140) ||
      `${applianceCategory.replace(/_/g, ' ')} issue described during Live Voice call`;
    const detailsCombined = [
      userLines.length > 0 ? `User voice intake: ${userLines.join(' ')}` : '',
      agentLines.length > 0 ? `Assistant voice observations: ${agentLines.slice(-2).join(' ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 2800);

    onApplyTranscript(summaryCandidate, detailsCombined);
    setAppliedNotice(true);
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-blue-400" />
            <h3 className="font-display text-sm font-bold tracking-tight">
              Live Voice Troubleshooting Assistant
            </h3>
            {status === 'live' && (
              <span className="text-[11px] font-mono font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded">
                LIVE AUDIO
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Speak naturally about sounds, error codes, or behavior. Apply your voice summary directly into the structured diagnostic pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Assistant voice"
            disabled={status === 'live' || status === 'connecting'}
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value as (typeof VOICE_OPTIONS)[number])}
            className="px-2.5 py-2 text-xs bg-slate-800 border border-slate-700 text-slate-100 rounded-lg disabled:opacity-60"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                Voice: {v}
              </option>
            ))}
          </select>

          {status === 'live' || status === 'connecting' ? (
            <>
              <button
                type="button"
                disabled={status === 'connecting'}
                onClick={() => setMicMuted((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-100"
              >
                {micMuted ? <MicOff className="w-3.5 h-3.5 text-amber-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                {status === 'connecting' ? 'Connecting...' : micMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={disconnectSession}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                End Voice
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void startSession()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Start Live Voice
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
          {error}
        </div>
      )}

      {turns.length > 0 && (
        <div className="space-y-3">
          <div
            ref={transcriptBoxRef}
            className="max-h-48 overflow-y-auto rounded-lg bg-slate-950/80 border border-slate-800 p-3 space-y-2 text-xs"
          >
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`p-2 rounded-md ${
                  turn.speaker === 'user'
                    ? 'bg-slate-800/80 text-slate-100'
                    : 'bg-blue-950/60 border border-blue-900/60 text-blue-100'
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mr-2">
                  {turn.speaker === 'user' ? 'You' : `FixMate (${selectedVoice})`}:
                </span>
                <span>{turn.text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleApplyToForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Apply Voice Notes to Diagnosis Form
            </button>
            {appliedNotice && (
              <span className="text-xs text-emerald-300">
                Voice notes copied into Symptom Summary & Observable Details below.
              </span>
            )}
          </div>
        </div>
      )}

      {status === 'live' && (
        <form onSubmit={handleSendTypedNote} className="flex gap-2">
          <input
            type="text"
            value={typedPrompt}
            onChange={(e) => setTypedPrompt(e.target.value)}
            placeholder="Optional: send an error code or text note into the live voice call..."
            className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!typedPrompt.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg border border-slate-700"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
      )}
    </div>
  );
}
