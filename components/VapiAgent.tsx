'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import Vapi from '@vapi-ai/web';

import { createFeedback } from '@/lib/actions/general.action';

interface VapiAgentProps {
  interviewId: string;
  userId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  questions?: string[];
  feedbackId?: string;
}

function parseVapiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    const nested = o.error;
    if (nested && typeof nested === 'object') {
      const e = nested as { message?: string; msg?: string };
      if (e.message) return e.message;
      if (e.msg) return e.msg;
    }
  }
  return 'Failed to connect. Please try again.';
}

function appendFinalTranscriptLine(
  transcriptRef: MutableRefObject<{ role: string; content: string }[]>,
  message: unknown
) {
  if (!message || typeof message !== 'object') return;
  const m = message as Record<string, unknown>;
  const type = m.type;
  if (typeof type !== 'string' || !type.startsWith('transcript')) return;
  if (m.transcriptType === 'partial') return;
  if (m.transcriptType !== 'final' && m.transcriptType !== undefined) return;
  if (m.role !== 'user' && m.role !== 'assistant') return;
  const text = String(m.transcript ?? '').trim();
  if (!text) return;
  transcriptRef.current.push({ role: m.role as string, content: text });
}

/** Ensures Gemini always receives a usable transcript (incl. “I don’t know” when nothing was captured). */
function buildVoiceFeedbackTranscript(
  captured: { role: string; content: string }[],
  ctx: { questions: string[]; role: string; level: string; type: string }
): { role: string; content: string }[] {
  const qs = ctx.questions.map((q) => q.trim()).filter(Boolean);
  const userTurns = captured.filter((l) => l.role === 'user');

  const meta = {
    role: 'system',
    content: `Voice mock interview — ${ctx.role} (${ctx.level}, ${ctx.type}). Prepared questions: ${qs.length}.`,
  };

  if (captured.length === 0) {
    const lines: { role: string; content: string }[] = [meta];
    if (qs.length > 0) {
      for (const q of qs) {
        lines.push({ role: 'assistant', content: q });
        lines.push({ role: 'user', content: "I don't know." });
      }
    } else {
      lines.push(
        { role: 'assistant', content: 'Please share your background for this role.' },
        { role: 'user', content: "I don't know — no verbal response was captured." }
      );
    }
    return lines;
  }

  const out: { role: string; content: string }[] = [meta, ...captured];
  if (userTurns.length === 0) {
    out.push({
      role: 'system',
      content:
        'No user speech was transcribed; evaluate as minimal/no participation unless assistant-only turns imply otherwise.',
    });
  } else if (qs.length > 0) {
    out.push({
      role: 'system',
      content:
        'For any prepared question not clearly answered in the dialogue, treat the candidate answer as “I don’t know” / no substantive response when scoring.',
    });
  }
  return out;
}

export default function VapiAgent({
  interviewId,
  userId,
  role,
  level,
  type,
  techstack,
  questions = [],
  feedbackId,
}: VapiAgentProps) {
  const router = useRouter();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);

  const vapiRef = useRef<Vapi | null>(null);
  /** Refs avoid re-subscribing Vapi when call state / route params change (fixes Daily “ejection”). */
  const interviewIdRef = useRef(interviewId);
  const routerRef = useRef(router);
  const userIdRef = useRef(userId);
  const feedbackIdRef = useRef(feedbackId);
  const transcriptRef = useRef<{ role: string; content: string }[]>([]);
  const hasFinalizedFeedbackRef = useRef(false);
  const suppressFeedbackOnUnmountRef = useRef(false);
  const isCallActiveRef = useRef(false);
  const runFinalizeFeedbackRef = useRef<() => Promise<void>>(async () => {});

  const roleRef = useRef(role);
  const levelRef = useRef(level);
  const typeRef = useRef(type);
  const questionsRef = useRef(questions);

  useEffect(() => {
    interviewIdRef.current = interviewId;
  }, [interviewId]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    feedbackIdRef.current = feedbackId;
  }, [feedbackId]);

  useEffect(() => {
    roleRef.current = role;
    levelRef.current = level;
    typeRef.current = type;
    questionsRef.current = questions;
  }, [role, level, type, questions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    suppressFeedbackOnUnmountRef.current = false;

    const token = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
    if (!token) {
      setError('Vapi token not configured. Set NEXT_PUBLIC_VAPI_WEB_TOKEN.');
      return;
    }

    const vapi = new Vapi(token);
    vapiRef.current = vapi;

    const handleCallStart = () => {
      isCallActiveRef.current = true;
      setStatus('connected');
      setIsCallActive(true);
      setError(null);
    };

    const finalizeVoiceFeedback = async () => {
      if (suppressFeedbackOnUnmountRef.current || hasFinalizedFeedbackRef.current) return;
      hasFinalizedFeedbackRef.current = true;

      const uid = userIdRef.current?.trim();
      const id = interviewIdRef.current;
      if (!uid) {
        hasFinalizedFeedbackRef.current = false;
        setError('You must be signed in to save feedback. Open the interview again after signing in.');
        setIsSavingFeedback(false);
        return;
      }

      setIsSavingFeedback(true);
      setError(null);

      const transcript = buildVoiceFeedbackTranscript(transcriptRef.current, {
        questions: questionsRef.current ?? [],
        role: roleRef.current,
        level: levelRef.current,
        type: typeRef.current,
      });

      try {
        const { success, feedbackId: savedId } = await createFeedback({
          interviewId: id,
          userId: uid,
          transcript,
          feedbackId: feedbackIdRef.current,
        });

        if (!success || !savedId) {
          hasFinalizedFeedbackRef.current = false;
          setError('Could not generate feedback from this call. Try again or use the text interview.');
          setIsSavingFeedback(false);
          return;
        }

        routerRef.current.push(`/interview/${id}/feedback`);
      } catch (e) {
        console.error('createFeedback after Vapi:', e);
        hasFinalizedFeedbackRef.current = false;
        setError('Could not save feedback. Please try again.');
        setIsSavingFeedback(false);
      }
    };

    runFinalizeFeedbackRef.current = finalizeVoiceFeedback;

    const handleCallEnd = () => {
      isCallActiveRef.current = false;
      setStatus('ended');
      setIsCallActive(false);
      void finalizeVoiceFeedback();
    };

    const handleMessage = (message: unknown) => {
      appendFinalTranscriptLine(transcriptRef, message);
    };

    const handleError = (err: unknown) => {
      console.error('Vapi error:', err);
      isCallActiveRef.current = false;
      setError(parseVapiError(err));
      setStatus('idle');
      setIsCallActive(false);
    };

    vapi.on('call-start', handleCallStart);
    vapi.on('call-end', handleCallEnd);
    vapi.on('message', handleMessage);
    vapi.on('error', handleError);

    return () => {
      suppressFeedbackOnUnmountRef.current = true;
      vapi.off('call-start', handleCallStart);
      vapi.off('call-end', handleCallEnd);
      vapi.off('message', handleMessage);
      vapi.off('error', handleError);
      try {
        void vapi.stop();
      } catch {
        /* ignore */
      }
      if (vapiRef.current === vapi) {
        vapiRef.current = null;
      }
    };
  }, []);

  const startCall = useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi) {
      setError('Vapi SDK not initialized');
      return;
    }

    if (!userId?.trim()) {
      setError('You must be signed in to run a voice interview and save feedback.');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);
      transcriptRef.current = [];
      hasFinalizedFeedbackRef.current = false;
      isCallActiveRef.current = false;

      const assistantId = (process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '').trim();

      if (!assistantId) {
        throw new Error(
          'Set NEXT_PUBLIC_VAPI_ASSISTANT_ID to your Vapi assistant ID in .env.local (Dashboard → Assistants → copy ID).'
        );
      }

      const interviewContext = {
        role,
        level,
        type,
        techstack: techstack.join(', '),
        questions: questions.join('\n'),
        interviewId,
        userId,
      };

      const variableValues = {
        interviewRole: role,
        interviewLevel: level,
        interviewType: type,
        techStack: techstack.join(', '),
        questions: questions.join('\n'),
        interviewContext: JSON.stringify(interviewContext),
      };

      const first = questions[0]?.trim();
      const firstMessage = first
        ? `Hello! I'm your interviewer for the ${role} role. Let's begin with this question: ${first}`
        : `Hello! I'm your interviewer for this ${level} level ${type} interview for the ${role} role. I'll ask you several questions — answer clearly, and ask if you need a question repeated.`;

      await vapi.start(assistantId, {
        variableValues,
        firstMessage,
        firstMessageMode: 'assistant-speaks-first',
      });
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setStatus('idle');
    }
  }, [interviewId, userId, role, level, type, techstack, questions]);

  const endCall = async () => {
    const vapi = vapiRef.current;
    if (!vapi || !isCallActiveRef.current) return;
    try {
      await vapi.stop();
    } catch {
      /* ignore */
    }
    isCallActiveRef.current = false;
    setStatus('ended');
    setIsCallActive(false);
    await runFinalizeFeedbackRef.current();
  };

  const toggleMute = () => {
    const vapi = vapiRef.current;
    if (vapi) {
      const next = !isMuted;
      vapi.setMuted(next);
      setIsMuted(next);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerMuted(!isSpeakerMuted);
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Voice Interview with{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Vapi AI
              </span>
            </h1>
            <p className="text-gray-400">
              {role} Interview • {level} Level • {type}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10">
                <div
                  className={`w-3 h-3 rounded-full ${
                    status === 'connected'
                      ? 'bg-green-500 animate-pulse'
                      : status === 'connecting'
                        ? 'bg-yellow-500 animate-pulse'
                        : status === 'ended'
                          ? 'bg-red-500'
                          : 'bg-gray-500'
                  }`}
                />
                <span className="text-white font-medium capitalize">
                  {isSavingFeedback
                    ? 'Saving feedback…'
                    : status === 'connected'
                      ? 'Connected'
                      : status === 'connecting'
                        ? 'Connecting...'
                        : status === 'ended'
                          ? 'Call Ended'
                          : 'Ready to Start'}
                </span>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-300 rounded-xl"
              >
                <p className="text-sm font-semibold mb-1">Connection Error</p>
                <p className="text-sm">{error}</p>
                <p className="text-xs text-red-400/80 mt-2">
                  Check NEXT_PUBLIC_VAPI_WEB_TOKEN and NEXT_PUBLIC_VAPI_ASSISTANT_ID in .env.local — both must
                  come from the same Vapi project. Restart the dev server after changing env.
                </p>
              </motion.div>
            )}

            <div className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Interview Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Role:</span>
                  <span className="text-white ml-2 font-medium">{role}</span>
                </div>
                <div>
                  <span className="text-gray-400">Level:</span>
                  <span className="text-white ml-2 font-medium capitalize">{level}</span>
                </div>
                <div>
                  <span className="text-gray-400">Type:</span>
                  <span className="text-white ml-2 font-medium capitalize">{type}</span>
                </div>
                <div>
                  <span className="text-gray-400">Tech Stack:</span>
                  <span className="text-white ml-2 font-medium">{techstack.join(', ')}</span>
                </div>
              </div>
              {questions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <span className="text-gray-400 text-sm">Questions Prepared:</span>
                  <span className="text-white ml-2 font-medium">{questions.length}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-6">
              {!isCallActive ? (
                <motion.button
                  onClick={startCall}
                  disabled={status === 'connecting' || isSavingFeedback}
                  whileHover={{ scale: status === 'connecting' || isSavingFeedback ? 1 : 1.05 }}
                  whileTap={{ scale: status === 'connecting' || isSavingFeedback ? 1 : 0.95 }}
                  className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-semibold shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <Phone className="w-6 h-6" />
                  {status === 'connecting' ? 'Connecting...' : 'Start Voice Interview'}
                </motion.button>
              ) : (
                <div className="flex items-center gap-4">
                  <motion.button
                    onClick={toggleMute}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`p-4 rounded-full transition-all ${
                      isMuted
                        ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                        : 'bg-white/10 text-white border-2 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </motion.button>

                  <motion.button
                    onClick={endCall}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-4 rounded-full bg-red-500/20 text-red-400 border-2 border-red-500/50 hover:bg-red-500/30 transition-all"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </motion.button>

                  <motion.button
                    onClick={toggleSpeaker}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`p-4 rounded-full transition-all ${
                      isSpeakerMuted
                        ? 'bg-gray-500/20 text-gray-400 border-2 border-gray-500/50'
                        : 'bg-white/10 text-white border-2 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </motion.button>
                </div>
              )}

              <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <h4 className="text-white font-semibold mb-2">How it works:</h4>
                <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                  <li>Allow microphone access when the browser asks</li>
                  <li>Click &quot;Start Voice Interview&quot; to begin</li>
                  <li>The AI interviewer will ask questions based on your interview details</li>
                  <li>After the call ends, you can review feedback</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
