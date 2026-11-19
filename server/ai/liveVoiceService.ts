import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import type http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyFirebaseIdToken } from '../middleware/auth.ts';

const LIVE_VOICE_MODEL = 'gemini-3.8-live';
const ALLOWED_VOICES = new Set(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir']);

function createLiveClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function buildVoiceSystemInstruction(applianceCategory: string, initialContext: string): string {
  const categoryLabel = applianceCategory
    ? applianceCategory.replace(/_/g, ' ')
    : 'household appliance';
  const contextLine = initialContext
    ? `\nInitial customer intake note: "${initialContext.slice(0, 500)}".`
    : '';

  return `You are FixMate AI Live Voice Assistant, a helpful, concise, safety-first appliance diagnostic specialist assisting a homeowner regarding a ${categoryLabel}.${contextLine}

Follow these rules strictly:
1. Ask one or two short, focused clarifying questions at a time (about error codes, sounds, frost, leaks, power indicators, or timing) to narrow down the fault.
2. Keep spoken responses concise (typically 2-4 natural sentences) so the conversation flows smoothly over voice.
3. SAFETY FIRST: If the user mentions smoke, burning smells, sparking, exposed live wires, electric shocks, gas odors, or a tripping main breaker, immediately instruct them to stop using and safely unplug/switch off the appliance and schedule a verified technician.
4. NEVER instruct users to open high-voltage panels, microwave enclosures, sealed refrigerant lines, or live electrical components. Only suggest safe external checks (unplugging, checking vents, door seals, drain traps, power outlets).
5. When appropriate, summarize what you observed and invite them to apply the voice notes to the structured diagnostic report or book a verified technician.`;
}

export function attachLiveVoiceServer(httpServer: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '/';
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(reqUrl, 'http://localhost');
    } catch {
      return;
    }

    // Leave Vite HMR WebSocket upgrades on '/' untouched
    if (parsedUrl.pathname !== '/api/live-voice') {
      return;
    }

    wss.handleUpgrade(request, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, request);
    });
  });

  wss.on('connection', async (clientWs, request) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(request.url || '/api/live-voice', 'http://localhost');
    } catch {
      sendJson(clientWs, { type: 'error', error: 'Invalid WebSocket request URL.' });
      clientWs.close(1008, 'Invalid request');
      return;
    }

    const token = parsedUrl.searchParams.get('token')?.trim() ?? '';
    if (!token) {
      sendJson(clientWs, {
        type: 'error',
        error: 'Please sign in with a verified email to start a Live Voice diagnostic session.',
      });
      clientWs.close(1008, 'Authentication required');
      return;
    }

    try {
      await verifyFirebaseIdToken(token);
    } catch (authErr) {
      sendJson(clientWs, {
        type: 'error',
        error:
          authErr instanceof Error
            ? authErr.message
            : 'Authentication failed for Live Voice session.',
      });
      clientWs.close(1008, 'Unauthorized');
      return;
    }

    const ai = createLiveClient();
    if (!ai) {
      sendJson(clientWs, {
        type: 'error',
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to use Live Voice.',
      });
      clientWs.close(1011, 'Missing Gemini API key');
      return;
    }

    const requestedVoice = parsedUrl.searchParams.get('voice')?.trim() ?? 'Zephyr';
    const voiceName = ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : 'Zephyr';
    const applianceCategory = parsedUrl.searchParams.get('category')?.trim() ?? 'appliance';
    const initialContext = parsedUrl.searchParams.get('context')?.trim() ?? '';

    let closed = false;
    let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (session) {
        try {
          session.close();
        } catch {
          // ignore close errors
        }
        session = null;
      }
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    try {
      session = await ai.live.connect({
        model: LIVE_VOICE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          systemInstruction: buildVoiceSystemInstruction(applianceCategory, initialContext),
        },
        callbacks: {
          onopen: () => {
            sendJson(clientWs, {
              type: 'ready',
              model: LIVE_VOICE_MODEL,
              voice: voiceName,
            });
          },
          onmessage: (message: LiveServerMessage) => {
            if (closed || clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              sendJson(clientWs, {
                type: 'inputTranscript',
                text: content.inputTranscription.text,
              });
            }

            if (content?.outputTranscription?.text) {
              sendJson(clientWs, {
                type: 'outputTranscript',
                text: content.outputTranscription.text,
              });
            }

            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendJson(clientWs, {
                  type: 'audio',
                  audio: part.inlineData.data,
                });
              }
            }

            if (content?.interrupted) {
              sendJson(clientWs, {
                type: 'interrupted',
                interrupted: true,
              });
            }

            if (content?.turnComplete) {
              sendJson(clientWs, {
                type: 'turnComplete',
                turnComplete: true,
              });
            }
          },
          onerror: (err: unknown) => {
            console.error('Gemini Live session error:', err);
            sendJson(clientWs, {
              type: 'error',
              error: 'Live voice session encountered a connection error.',
            });
          },
          onclose: () => {
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.close(1000, 'Live session ended');
            }
            cleanup();
          },
        },
      });
    } catch (connectErr) {
      console.error('Failed to connect to Gemini Live API:', connectErr);
      sendJson(clientWs, {
        type: 'error',
        error:
          connectErr instanceof Error
            ? connectErr.message
            : 'Unable to establish Gemini Live Voice session.',
      });
      clientWs.close(1011, 'Live connection failed');
      return;
    }

    clientWs.on('message', (raw) => {
      if (closed || !session) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          audio?: string;
          text?: string;
          video?: string;
        };

        if (typeof msg.audio === 'string' && msg.audio.length > 0) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
        if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
          session.sendRealtimeInput({
            text: msg.text.trim().slice(0, 1000),
          });
        }
        if (typeof msg.video === 'string' && msg.video.length > 0) {
          session.sendRealtimeInput({
            video: { data: msg.video, mimeType: 'image/jpeg' },
          });
        }
      } catch (err) {
        console.warn('Invalid client live-voice message:', err);
      }
    });
  });

  return wss;
}
