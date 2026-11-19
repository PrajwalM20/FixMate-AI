import type { ApplianceSlug, BfsLevelSummary, BfsPathNode } from '../../src/types/domain.ts';
import { TROUBLESHOOTING_GRAPHS, type GraphEdgeDef } from './knowledgeGraph.ts';
import type { GraphVisualEdge, GraphVisualNode, SearchPlan } from './types.ts';

interface QueueItem {
  nodeId: string;
  level: number;
  viaReason: string;
}

/**
 * Breadth-First Search (BFS) Troubleshooting Path Engine
 *
 * Explores the appliance troubleshooting state-space graph level by level using
 * an explicit FIFO queue and visited Set, avoiding cycles and returning both the
 * level-by-level exploration trace and the selected diagnostic path.
 */
export class SearchEngine {
  searchTroubleshootingGraph(
    applianceCategory: ApplianceSlug,
    workingMemoryFacts: string[]
  ): SearchPlan {
    const graph = TROUBLESHOOTING_GRAPHS[applianceCategory] ?? TROUBLESHOOTING_GRAPHS.other;
    const factSet = new Set(workingMemoryFacts);

    const queue: QueueItem[] = [
      {
        nodeId: graph.startNodeId,
        level: 0,
        viaReason: 'Initial appliance problem state',
      },
    ];
    const visited = new Set<string>([graph.startNodeId]);
    const parentMap = new Map<string, { parentId: string; reason: string }>();
    const nodeLevelMap = new Map<string, number>([[graph.startNodeId, 0]]);
    const levelBuckets = new Map<number, { nodeId: string; label: string; nodeType: string }[]>();

    let bestGoalNodeId: string | null = null;
    let bestGoalScore = -1;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const nodeDef = graph.nodes[current.nodeId];
      if (!nodeDef) continue;

      const bucket = levelBuckets.get(current.level) ?? [];
      bucket.push({
        nodeId: nodeDef.id,
        label: nodeDef.label,
        nodeType: nodeDef.nodeType,
      });
      levelBuckets.set(current.level, bucket);

      // Evaluate goal nodes
      if (nodeDef.nodeType === 'goal_safe' || nodeDef.nodeType === 'goal_escalate') {
        const outgoingMatched = graph.edges
          .filter((e) => e.to === nodeDef.id)
          .reduce((acc, e) => {
            const hits = (e.preferredFacts ?? []).filter((f) => factSet.has(f)).length;
            return Math.max(acc, hits);
          }, 0);
        // Prefer escalation goals if facts strongly support them or safe goals when no hazard
        const score = outgoingMatched * 10 + (nodeDef.nodeType === 'goal_escalate' ? 2 : 1);
        if (score > bestGoalScore) {
          bestGoalScore = score;
          bestGoalNodeId = nodeDef.id;
        }
      }

      // Rank outgoing edges so preferred fact branches are queued first at the next BFS level
      const outgoing: GraphEdgeDef[] = graph.edges
        .filter((e) => e.from === current.nodeId)
        .sort((a, b) => {
          const aScore = (a.preferredFacts ?? []).filter((f) => factSet.has(f)).length;
          const bScore = (b.preferredFacts ?? []).filter((f) => factSet.has(f)).length;
          return bScore - aScore;
        });

      for (const edge of outgoing) {
        if (!visited.has(edge.to) && graph.nodes[edge.to]) {
          visited.add(edge.to);
          parentMap.set(edge.to, { parentId: current.nodeId, reason: edge.reason });
          nodeLevelMap.set(edge.to, current.level + 1);
          queue.push({
            nodeId: edge.to,
            level: current.level + 1,
            viaReason: edge.reason,
          });
        }
      }
    }

    // Reconstruct shortest BFS path from startNodeId -> bestGoalNodeId
    const pathIds: string[] = [];
    let cursor: string | undefined = bestGoalNodeId ?? Array.from(visited).pop();
    while (cursor) {
      pathIds.unshift(cursor);
      cursor = parentMap.get(cursor)?.parentId;
    }

    const selectedPathSet = new Set(pathIds);
    const selectedPath: BfsPathNode[] = pathIds.map((id) => {
      const def = graph.nodes[id];
      const pInfo = parentMap.get(id);
      const mapType = (
        t: string
      ): 'start' | 'check' | 'cause' | 'goal_safe' | 'goal_escalate' => {
        if (t === 'start' || t === 'check' || t === 'cause' || t === 'goal_safe' || t === 'goal_escalate') {
          return t;
        }
        return 'check';
      };
      return {
        nodeId: id,
        label: def?.label ?? id,
        nodeType: mapType(def?.nodeType ?? 'check'),
        level: nodeLevelMap.get(id) ?? 0,
        transitionReason: pInfo?.reason ?? 'Initial problem state',
      };
    });

    const exploredLevels: BfsLevelSummary[] = Array.from(levelBuckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, visitedNodes]) => ({ level, visitedNodes }));

    const graphNodes: GraphVisualNode[] = Array.from(visited).map((id) => {
      const def = graph.nodes[id];
      return {
        nodeId: id,
        label: def?.label ?? id,
        nodeType: def?.nodeType ?? 'check',
        level: nodeLevelMap.get(id) ?? 0,
        onSelectedPath: selectedPathSet.has(id),
      };
    });

    const selectedEdgePairs = new Set<string>();
    for (let i = 0; i < pathIds.length - 1; i += 1) {
      selectedEdgePairs.add(`${pathIds[i]}->${pathIds[i + 1]}`);
    }

    const graphEdges: GraphVisualEdge[] = graph.edges
      .filter((e) => visited.has(e.from) && visited.has(e.to))
      .map((e) => ({
        from: e.from,
        to: e.to,
        reason: e.reason,
        onSelectedPath: selectedEdgePairs.has(`${e.from}->${e.to}`),
      }));

    const recommendedSteps = pathIds
      .map((id) => graph.nodes[id]?.safeActionStep)
      .filter((step): step is string => Boolean(step));

    return {
      selectedPath: selectedPath.slice(0, 20),
      exploredLevels: exploredLevels.slice(0, 10),
      graphNodes,
      graphEdges,
      recommendedSteps: recommendedSteps.slice(0, 15),
      searchStrategyNote: `Breadth-First Search explored ${visited.size} diagnostic states across ${exploredLevels.length} depth levels using a FIFO queue and visited-state tracking.`,
      visitedCount: visited.size,
    };
  }
}

export const searchEngine = new SearchEngine();
