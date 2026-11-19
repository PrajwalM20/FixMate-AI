import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { agentController } from './server/ai/agentController.ts';
import { databaseService } from './server/ai/databaseService.ts';
import { knowledgeBaseService } from './server/ai/knowledgeBaseService.ts';
import { attachLiveVoiceServer } from './server/ai/liveVoiceService.ts';
import { rankTechniciansForRequest } from './server/ai/technicianMatcher.ts';
import { requireAdmin, requireAuth } from './server/middleware/auth.ts';
import type { AuthenticatedRequest } from './server/middleware/auth.ts';
import { createRateLimiter } from './server/middleware/rateLimit.ts';
import {
  checkBookingSlotConflict,
  validateBookingTransition,
  validateQuotationPayload,
} from './server/services/marketplaceService.ts';
import type {
  BookingRecord,
  BookingStatus,
  ReviewRecord,
  TechnicianProfile,
  UserRole,
} from './src/types/domain.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Support up to 16mb JSON so up to 3 base64 appliance photos can be analyzed server-side
  app.use(express.json({ limit: '16mb' }));

  const aiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 25,
    keyPrefix: 'ai',
  });
  const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 120,
    keyPrefix: 'api',
  });

  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'FixMate AI Server',
      phase: 'Phase 3',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/ai/architecture', (_req, res) => {
    res.json(agentController.getArchitectureManifest());
  });

  app.get('/api/knowledge-base', (_req, res) => {
    res.json({
      categories: knowledgeBaseService.getCategories(),
      entries: knowledgeBaseService.getAllEntries(),
      isSampleDataset: true,
    });
  });

  // Protected Hybrid AI Diagnosis Endpoint (Gemini Perception + Forward Chaining + BFS + Uncertainty + Safety)
  app.post('/api/ai/diagnose', aiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    const validation = databaseService.validateDiagnosisInput(req.body);
    if (!validation.valid || !validation.data) {
      res.status(400).json({ error: validation.error ?? 'Invalid diagnosis payload.' });
      return;
    }

    try {
      const output = await agentController.runDiagnosticCycle({
        ...validation.data,
        customerId: req.authUser!.uid,
      });
      res.json(output);
    } catch (error) {
      console.error('Diagnosis pipeline error:', error);
      res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to execute diagnostic pipeline.',
      });
    }
  });

  // Protected Follow-Up Continuation Endpoint (preserves diagnosis context & re-runs reasoning)
  app.post('/api/ai/followup', aiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const followUpMessage =
      typeof body.followUpMessage === 'string' ? body.followUpMessage.trim() : '';

    if (followUpMessage.length < 2 || followUpMessage.length > 1500) {
      res.status(400).json({ error: 'Follow-up answer/question must be 2–1500 characters.' });
      return;
    }

    const validation = databaseService.validateDiagnosisInput({
      ...body,
      symptomDetails: [
        typeof body.symptomDetails === 'string' ? body.symptomDetails : '',
        `Follow-up update: ${followUpMessage}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    if (!validation.valid || !validation.data) {
      res.status(400).json({ error: validation.error ?? 'Invalid follow-up payload.' });
      return;
    }

    try {
      const output = await agentController.runDiagnosticCycle({
        ...validation.data,
        customerId: req.authUser!.uid,
        followUpAnswers: {
          ...(validation.data.followUpAnswers ?? {}),
          'Customer follow-up': followUpMessage,
        },
      });
      res.json(output);
    } catch (error) {
      console.error('Follow-up pipeline error:', error);
      res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to process follow-up diagnosis.',
      });
    }
  });

  // Deterministic Rule-Based Technician Matching & Ranking Endpoint
  app.post('/api/technicians/recommend', (req, res) => {
    const body = (req.body ?? {}) as {
      technicians?: TechnicianProfile[];
      reviews?: Pick<ReviewRecord, 'technicianId' | 'rating'>[];
      applianceCategory?: string;
      locationQuery?: string;
      symptomKeywords?: string[];
      onlyAvailable?: boolean;
    };

    if (!Array.isArray(body.technicians)) {
      res.status(400).json({ error: 'technicians array is required.' });
      return;
    }

    const ranked = rankTechniciansForRequest(
      body.technicians.slice(0, 200),
      Array.isArray(body.reviews) ? body.reviews.slice(0, 1000) : [],
      {
        applianceCategory: body.applianceCategory,
        locationQuery: body.locationQuery,
        symptomKeywords: Array.isArray(body.symptomKeywords) ? body.symptomKeywords : [],
        onlyAvailable: Boolean(body.onlyAvailable),
      }
    );

    res.json(ranked);
  });

  // Protected Server-Side Booking Conflict & Slot Validation
  app.post('/api/bookings/validate', requireAuth, (req: AuthenticatedRequest, res) => {
    const body = (req.body ?? {}) as {
      technicianId?: string;
      scheduledDate?: string;
      timeSlot?: string;
      serviceAddress?: string;
      existingBookings?: Pick<
        BookingRecord,
        'id' | 'technicianId' | 'scheduledDate' | 'timeSlot' | 'status'
      >[];
    };

    const result = checkBookingSlotConflict(
      body,
      Array.isArray(body.existingBookings) ? body.existingBookings.slice(0, 500) : []
    );

    if (!result.valid) {
      res.status(result.conflict ? 409 : 400).json(result);
      return;
    }

    res.json(result);
  });

  // Protected Server-Side Booking State-Machine Validation
  app.post('/api/bookings/validate-transition', requireAuth, (req: AuthenticatedRequest, res) => {
    const body = (req.body ?? {}) as {
      currentStatus?: BookingStatus;
      nextStatus?: BookingStatus;
      actorRole?: UserRole;
    };

    if (!body.currentStatus || !body.nextStatus || !body.actorRole) {
      res.status(400).json({
        allowed: false,
        error: 'currentStatus, nextStatus, and actorRole are required.',
      });
      return;
    }

    const resolvedActorRole: UserRole =
      body.actorRole === 'admin' && !req.authUser?.isAdmin ? 'customer' : body.actorRole;

    const result = validateBookingTransition({
      currentStatus: body.currentStatus,
      nextStatus: body.nextStatus,
      actorRole: resolvedActorRole,
    });

    if (!result.allowed) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  // Protected Server-Side Itemized Quotation Validation
  app.post('/api/quotations/validate', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = validateQuotationPayload((req.body ?? {}) as Record<string, unknown>);
    if (!result.valid) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  app.post(
    '/api/admin/validate-kb-entry',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const result = databaseService.validateKnowledgeBaseDraft(req.body);
      if (!result.valid) {
        res.status(400).json({ valid: false, error: result.error });
        return;
      }
      res.json({ valid: true, verifiedBy: req.authUser?.email });
    }
  );

  const httpServer = http.createServer(app);
  attachLiveVoiceServer(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FixMate AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FixMate AI server:', err);
  process.exit(1);
});
