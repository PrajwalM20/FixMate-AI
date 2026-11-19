import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Eye,
  GitBranch,
  HelpCircle,
  Info,
  MessageSquare,
  Send,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import type {
  ApplianceSlug,
  BfsLevelSummary,
  BfsPathNode,
  DiagnosisHypothesis,
  FollowUpTurn,
  InferenceTraceStep,
  NextRecommendedAction,
  RiskLevel,
  UrgencyLevel,
} from '../types/domain.ts';
import { RiskIndicator } from './StatusLabel.tsx';

export interface GraphVisualNodeUI {
  nodeId: string;
  label: string;
  nodeType: 'start' | 'check' | 'cause' | 'goal_safe' | 'goal_escalate';
  level: number;
  onSelectedPath: boolean;
}

export interface GraphVisualEdgeUI {
  from: string;
  to: string;
  reason: string;
  onSelectedPath: boolean;
}

export interface DiagnosisReportData {
  id?: string;
  requestId?: string;
  applianceCategory: ApplianceSlug;
  problemSummary?: string;
  summary: string;
  observations: string[];
  imageObservations?: string[];
  userSymptoms?: string[];
  imageUrls?: string[];
  matchedKnowledgeIds: string[];
  hypotheses: DiagnosisHypothesis[];
  followUpQuestions?: string[];
  missingEvidence?: string[];
  contradictoryEvidence?: string[];
  inferenceTrace?: InferenceTraceStep[];
  bfsSearchPath?: BfsPathNode[];
  bfsExploredLevels?: BfsLevelSummary[];
  graphVisualization?: {
    nodes: GraphVisualNodeUI[];
    edges: GraphVisualEdgeUI[];
  };
  recommendedSteps: string[];
  safetyWarnings?: string[];
  riskLevel: RiskLevel;
  urgencyLevel?: UrgencyLevel;
  nextRecommendedAction?: NextRecommendedAction;
  escalationReason?: string;
  confidenceScore: number;
  scoreDisclaimer?: string;
  requiresProfessional: boolean;
  engineMode: 'gemini_hybrid' | 'phase1_deterministic_stub';
  geminiMeta?: {
    status: string;
    model: string;
    errorMessage?: string;
  };
  followUpConversation?: FollowUpTurn[];
}

interface DiagnosisReportViewProps {
  report: DiagnosisReportData;
  onSubmitFollowUp?: (message: string) => Promise<void>;
  submittingFollowUp?: boolean;
  followUpError?: string | null;
  onBookTechnician?: () => void;
}

const ACTION_LABELS: Record<NextRecommendedAction, string> = {
  safe_external_checks: 'Perform Safe External Checks',
  ask_follow_up_questions: 'Answer Follow-Up Questions',
  continue_diagnosis: 'Continue Diagnosis with More Detail',
  stop_using_appliance: 'Stop Using Appliance Immediately',
  contact_qualified_technician: 'Contact Verified Technician',
};

const URGENCY_LABELS: Record<UrgencyLevel, { label: string; color: string }> = {
  routine: { label: 'Routine Check', color: 'text-emerald-700' },
  soon: { label: 'Schedule Soon', color: 'text-blue-700' },
  urgent: { label: 'Urgent Attention', color: 'text-amber-700' },
  emergency: { label: 'Emergency Safety Stop', color: 'text-red-700' },
};

function buildGraphFromStoredReport(report: DiagnosisReportData): {
  nodes: GraphVisualNodeUI[];
  edges: GraphVisualEdgeUI[];
} {
  if (report.graphVisualization && report.graphVisualization.nodes.length > 0) {
    return report.graphVisualization;
  }

  const pathNodes = report.bfsSearchPath ?? [];
  const levels = report.bfsExploredLevels ?? [];
  const selectedIds = new Set(pathNodes.map((n) => n.nodeId));
  const nodesMap = new Map<string, GraphVisualNodeUI>();

  for (const lvl of levels) {
    for (const vn of lvl.visitedNodes) {
      nodesMap.set(vn.nodeId, {
        nodeId: vn.nodeId,
        label: vn.label,
        nodeType: (vn.nodeType as GraphVisualNodeUI['nodeType']) || 'check',
        level: lvl.level,
        onSelectedPath: selectedIds.has(vn.nodeId),
      });
    }
  }

  for (const pn of pathNodes) {
    nodesMap.set(pn.nodeId, {
      nodeId: pn.nodeId,
      label: pn.label,
      nodeType: pn.nodeType,
      level: pn.level,
      onSelectedPath: true,
    });
  }

  const edges: GraphVisualEdgeUI[] = [];
  for (let i = 1; i < pathNodes.length; i++) {
    edges.push({
      from: pathNodes[i - 1].nodeId,
      to: pathNodes[i].nodeId,
      reason: pathNodes[i].transitionReason,
      onSelectedPath: true,
    });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}

function BfsGraphDiagram({
  nodes,
  edges,
}: {
  nodes: GraphVisualNodeUI[];
  edges: GraphVisualEdgeUI[];
}) {
  if (nodes.length === 0) return null;

  const groupedByLevel = new Map<number, GraphVisualNodeUI[]>();
  for (const node of nodes) {
    const list = groupedByLevel.get(node.level) ?? [];
    list.push(node);
    groupedByLevel.set(node.level, list);
  }

  const sortedLevels = Array.from(groupedByLevel.keys()).sort((a, b) => a - b);
  const maxRows = Math.max(...Array.from(groupedByLevel.values()).map((arr) => arr.length), 1);

  const colWidth = 220;
  const rowHeight = 86;
  const nodeWidth = 176;
  const nodeHeight = 56;
  const padX = 28;
  const padY = 36;

  const svgWidth = Math.max(660, sortedLevels.length * colWidth + padX * 2);
  const svgHeight = Math.max(210, maxRows * rowHeight + padY * 2);

  const positions = new Map<string, { x: number; y: number }>();
  sortedLevels.forEach((lvl, colIdx) => {
    const colNodes = groupedByLevel.get(lvl) ?? [];
    const totalColHeight = colNodes.length * rowHeight;
    const startY = (svgHeight - totalColHeight) / 2 + (rowHeight - nodeHeight) / 2;
    colNodes.forEach((node, rowIdx) => {
      positions.set(node.nodeId, {
        x: padX + colIdx * colWidth,
        y: startY + rowIdx * rowHeight,
      });
    });
  });

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50/70 p-3 overflow-x-auto">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        role="img"
        aria-label="Breadth-First Search troubleshooting state-space graph"
        className="min-w-full"
      >
        <defs>
          <marker
            id="bfs-arrow-default"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,1 L7,4 L0,7 Z" fill="#94a3b8" />
          </marker>
          <marker
            id="bfs-arrow-selected"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,1 L7,4 L0,7 Z" fill="#2563eb" />
          </marker>
        </defs>

        {/* Level Column Headers */}
        {sortedLevels.map((lvl, colIdx) => (
          <text
            key={`lvl-hdr-${lvl}`}
            x={padX + colIdx * colWidth + nodeWidth / 2}
            y={18}
            textAnchor="middle"
            className="fill-slate-500 text-[11px] font-mono font-semibold"
          >
            BFS Level {lvl}
          </text>
        ))}

        {/* Graph Edges */}
        {edges.map((edge, idx) => {
          const fromPos = positions.get(edge.from);
          const toPos = positions.get(edge.to);
          if (!fromPos || !toPos) return null;

          const x1 = fromPos.x + nodeWidth;
          const y1 = fromPos.y + nodeHeight / 2;
          const x2 = toPos.x - 4;
          const y2 = toPos.y + nodeHeight / 2;

          return (
            <line
              key={`${edge.from}-${edge.to}-${idx}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={edge.onSelectedPath ? '#2563eb' : '#cbd5e1'}
              strokeWidth={edge.onSelectedPath ? 2.5 : 1.5}
              strokeDasharray={edge.onSelectedPath ? undefined : '4 3'}
              markerEnd={
                edge.onSelectedPath ? 'url(#bfs-arrow-selected)' : 'url(#bfs-arrow-default)'
              }
            />
          );
        })}

        {/* Graph Nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.nodeId);
          if (!pos) return null;

          let fill = '#ffffff';
          let stroke = node.onSelectedPath ? '#2563eb' : '#cbd5e1';
          if (node.nodeType === 'goal_escalate') {
            fill = node.onSelectedPath ? '#fef2f2' : '#ffffff';
            stroke = node.onSelectedPath ? '#dc2626' : '#fca5a5';
          } else if (node.nodeType === 'goal_safe') {
            fill = node.onSelectedPath ? '#ecfdf5' : '#ffffff';
            stroke = node.onSelectedPath ? '#059669' : '#a7f3d0';
          } else if (node.onSelectedPath) {
            fill = '#eff6ff';
          }

          const shortLabel =
            node.label.length > 26 ? `${node.label.slice(0, 24)}...` : node.label;

          return (
            <g key={node.nodeId} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={nodeWidth}
                height={nodeHeight}
                rx={8}
                fill={fill}
                stroke={stroke}
                strokeWidth={node.onSelectedPath ? 2 : 1.25}
              />
              <text
                x={10}
                y={20}
                className="fill-slate-500 text-[10px] font-mono uppercase"
              >
                {node.nodeType.replace('_', ' ')}
              </text>
              <text
                x={10}
                y={38}
                className="fill-slate-900 text-[11px] font-semibold"
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DiagnosisReportView({
  report,
  onSubmitFollowUp,
  submittingFollowUp = false,
  followUpError = null,
  onBookTechnician,
}: DiagnosisReportViewProps) {
  const [followUpInput, setFollowUpInput] = useState('');

  const isEmergency =
    report.nextRecommendedAction === 'stop_using_appliance' ||
    report.urgencyLevel === 'emergency' ||
    (report.safetyWarnings?.length ?? 0) > 0;

  const urgencyMeta = report.urgencyLevel ? URGENCY_LABELS[report.urgencyLevel] : null;
  const graphData = buildGraphFromStoredReport(report);

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitFollowUp || !followUpInput.trim()) return;
    const msg = followUpInput.trim();
    await onSubmitFollowUp(msg);
    setFollowUpInput('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Safety & Urgency Override Banner */}
      {isEmergency && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 space-y-2">
          <div className="flex items-center gap-2 text-red-800">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h3 className="font-display text-sm font-bold">
              Safety Override Active — Stop Using Appliance
            </h3>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-xs text-red-900">
            {(report.safetyWarnings ?? []).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Engine Status & Gemini Perception Meta */}
      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-900">Reasoning Pipeline:</span>{' '}
          <span className="font-mono text-slate-800">{report.engineMode}</span>
          {report.geminiMeta && (
            <>
              {' · '}
              <span>
                Perception ({report.geminiMeta.model}):{' '}
                <strong className="text-slate-900">{report.geminiMeta.status}</strong>
              </span>
            </>
          )}
        </div>
        <RiskIndicator level={report.riskLevel} />
      </div>

      {report.geminiMeta &&
        report.geminiMeta.status !== 'ok' &&
        report.geminiMeta.errorMessage && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <div>
              <span className="font-semibold">Perception Notice:</span>{' '}
              {report.geminiMeta.errorMessage} Coded backend inference, BFS search, and safety
              checks executed using extracted text observations.
            </div>
          </div>
        )}

      {/* 3. Problem Summary & Core Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs text-slate-500">Top Rule-Based Score</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {Math.round(report.confidenceScore * 100)}%
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Heuristic evidence score</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Next Recommended Action</p>
          <p className="text-sm font-semibold text-slate-900 mt-1.5">
            {report.nextRecommendedAction
              ? ACTION_LABELS[report.nextRecommendedAction]
              : report.requiresProfessional
                ? 'Contact Verified Technician'
                : 'Perform Safe External Checks'}
          </p>
          {urgencyMeta && (
            <p className={`text-xs font-semibold mt-0.5 ${urgencyMeta.color}`}>
              {urgencyMeta.label}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500">Professional Assessment</p>
          <p className="text-sm font-semibold text-slate-900 mt-1.5 flex items-center gap-1.5">
            {report.requiresProfessional ? (
              <>
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                Recommended / Required
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Safe Checks First
              </>
            )}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-700 mb-1.5">Diagnostic Summary</h3>
        <p className="text-sm text-slate-800 leading-relaxed">{report.summary}</p>
        {report.scoreDisclaimer && (
          <p className="text-[11px] text-slate-500 mt-1.5">{report.scoreDisclaimer}</p>
        )}
      </div>

      {/* 4. Multimodal Observations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-1.5 mb-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-800">
              Reported Symptoms & Canonical Facts
            </h3>
          </div>
          {report.userSymptoms && report.userSymptoms.length > 0 ? (
            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
              {report.userSymptoms.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
              {report.observations.slice(0, 6).map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-800">
              Visual Image Observations
            </h3>
          </div>
          {report.imageObservations && report.imageObservations.length > 0 ? (
            <>
              <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                {report.imageObservations.map((obs) => (
                  <li key={obs}>{obs}</li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500 mt-2">
                Visual observations support evidence collection only and do not prove hidden internal faults.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              No image-specific observations recorded for this diagnostic cycle.
            </p>
          )}
          {report.imageUrls && report.imageUrls.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {report.imageUrls.map((url, idx) => (
                <img
                  key={url}
                  src={url}
                  alt={`Submitted appliance reference ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-md object-cover border border-slate-200"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Ranked Possible Causes with Uncertainty Reasoning */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 mb-2.5">
          Ranked Possible Causes (Rule-Based Evidence Assessment)
        </h3>
        <div className="space-y-3">
          {report.hypotheses.map((h) => (
            <div
              key={`${h.causeId ?? h.faultTitle}`}
              className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{h.faultTitle}</p>
                  <p className="text-xs text-slate-600">{h.possibleCause}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                    Score: {Math.round(h.matchScore * 100)}%
                  </span>
                  {h.scoreLabel && (
                    <p className="text-[11px] text-slate-500">{h.scoreLabel}</p>
                  )}
                </div>
              </div>

              {h.explanation && (
                <p className="text-xs text-slate-700 leading-relaxed">{h.explanation}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px]">
                {h.supportingObservations && h.supportingObservations.length > 0 && (
                  <div>
                    <span className="font-semibold text-emerald-800">Supporting Evidence:</span>
                    <ul className="list-disc pl-4 text-slate-600 mt-0.5 space-y-0.5">
                      {h.supportingObservations.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {h.missingInformation && h.missingInformation.length > 0 && (
                  <div>
                    <span className="font-semibold text-amber-800">Missing Information:</span>
                    <ul className="list-disc pl-4 text-slate-600 mt-0.5 space-y-0.5">
                      {h.missingInformation.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {h.contradictoryObservations && h.contradictoryObservations.length > 0 && (
                <p className="text-[11px] text-red-700">
                  Contradictory cue: {h.contradictoryObservations.join('; ')}
                </p>
              )}

              {h.uncertaintyReason && (
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                  Uncertainty note: {h.uncertaintyReason}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Forward-Chaining Inference Trace */}
      {report.inferenceTrace && report.inferenceTrace.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <GitBranch className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-700">
              Forward-Chaining Knowledge-Base Inference Trace
            </h3>
          </div>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
            {report.inferenceTrace.map((trace) => (
              <div key={`${trace.step}-${trace.ruleId}`} className="p-3.5 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-slate-900">
                    Step {trace.step} · Rule {trace.ruleId}
                  </span>
                  <span className="font-mono text-blue-700">
                    Inferred: {trace.inferredFact}
                  </span>
                </div>
                <p className="text-slate-600">
                  Matched Facts: <span className="font-mono">{trace.matchedFacts.join(', ')}</span>
                </p>
                <p className="text-slate-700">{trace.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Visual BFS Troubleshooting Graph & Selected Path */}
      {((report.bfsSearchPath && report.bfsSearchPath.length > 0) || graphData.nodes.length > 0) && (
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-700">
              Breadth-First Search (BFS) Troubleshooting Path Exploration
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Blue edges highlight the shortest queue-explored path from initial observation to the safest actionable check or escalation goal.
            </p>
          </div>

          <BfsGraphDiagram nodes={graphData.nodes} edges={graphData.edges} />

          {report.bfsSearchPath && report.bfsSearchPath.length > 0 && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              {report.bfsSearchPath.map((node) => (
                <div key={node.nodeId} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <span className="font-mono text-blue-700 font-semibold mr-2">
                      L{node.level}
                    </span>
                    <span className="font-semibold text-slate-900">{node.label}</span>
                  </div>
                  <span className="text-slate-600">{node.transitionReason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. Safe Troubleshooting Next Steps */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 mb-2">
          Safe Troubleshooting Steps
        </h3>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
          {report.recommendedSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {/* 9. Interactive Follow-Up Q&A Panel */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-semibold text-slate-900">
            Follow-Up Diagnostic Dialogue
          </h3>
        </div>

        {report.followUpQuestions && report.followUpQuestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              Suggested follow-up questions (click to pre-fill or answer below):
            </p>
            <div className="flex flex-wrap gap-2">
              {report.followUpQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() =>
                    setFollowUpInput((prev) =>
                      prev ? `${prev} | Regarding "${q}": ` : `Regarding "${q}": `
                    )
                  }
                  className="text-left text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:border-blue-400 hover:text-blue-700 text-slate-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {report.followUpConversation && report.followUpConversation.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {report.followUpConversation.map((turn, idx) => (
              <div
                key={`${turn.timestamp}-${idx}`}
                className={`p-3 rounded-lg text-xs ${
                  turn.role === 'user'
                    ? 'bg-white border border-slate-200 text-slate-900'
                    : 'bg-blue-50/70 border border-blue-200 text-slate-800'
                }`}
              >
                <p className="font-semibold text-[11px] text-slate-600 mb-0.5">
                  {turn.role === 'user' ? 'Your Update' : 'FixMate Reasoning Update'}
                </p>
                <p className="leading-relaxed">{turn.message}</p>
              </div>
            ))}
          </div>
        )}

        {onSubmitFollowUp && (
          <form onSubmit={handleFollowUpSubmit} className="space-y-2">
            {followUpError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                {followUpError}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="Answer a diagnostic question or describe new observations..."
                minLength={2}
                maxLength={1500}
                disabled={submittingFollowUp}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="submit"
                disabled={submittingFollowUp || followUpInput.trim().length < 2}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingFollowUp ? 'Re-evaluating...' : 'Update Diagnosis'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 10. Escalation & Technician Booking Footer */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2 text-xs text-slate-600 max-w-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            {report.escalationReason ||
              'Follow safe external checks only. Escalate internal electrical, refrigerant, or gas repairs to a verified technician.'}
          </span>
        </div>
        {onBookTechnician ? (
          <button
            type="button"
            onClick={onBookTechnician}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" />
            Book Verified Technician
          </button>
        ) : (
          <Link
            to={`/technicians?category=${encodeURIComponent(report.applianceCategory)}${
              report.requestId ? `&requestId=${encodeURIComponent(report.requestId)}` : ''
            }`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0"
          >
            Find & Book Verified Technician
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
