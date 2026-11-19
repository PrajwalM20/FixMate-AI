import type {
  ApplianceSlug,
  ReviewRecord,
  TechnicianMatchResult,
  TechnicianProfile,
} from '../../src/types/domain.ts';

export interface TechnicianMatchCriteria {
  applianceCategory?: ApplianceSlug | string;
  locationQuery?: string;
  symptomKeywords?: string[];
  onlyAvailable?: boolean;
}

export interface TechnicianRankingResponse {
  rankingMethod: 'rule_based_weighted_heuristics';
  weights: {
    categoryCompatibility: number;
    locationMatch: number;
    availabilityStatus: number;
    customerRating: number;
    experienceYears: number;
  };
  results: TechnicianMatchResult[];
}

const WEIGHTS = {
  categoryCompatibility: 0.35,
  locationMatch: 0.25,
  availabilityStatus: 0.15,
  customerRating: 0.15,
  experienceYears: 0.10,
} as const;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/**
 * Deterministic rule-based technician recommendation function.
 * Scores verified active technicians using transparent weighted heuristics (no ML claims).
 */
export function rankTechniciansForRequest(
  technicians: TechnicianProfile[],
  reviews: Pick<ReviewRecord, 'technicianId' | 'rating'>[],
  criteria: TechnicianMatchCriteria
): TechnicianRankingResponse {
  const reviewMap = new Map<string, { sum: number; count: number }>();
  for (const rev of reviews) {
    if (!rev || typeof rev.technicianId !== 'string' || typeof rev.rating !== 'number') continue;
    const entry = reviewMap.get(rev.technicianId) ?? { sum: 0, count: 0 };
    entry.sum += Math.max(1, Math.min(5, rev.rating));
    entry.count += 1;
    reviewMap.set(rev.technicianId, entry);
  }

  const targetCategory = (criteria.applianceCategory ?? '').trim().toLowerCase();
  const locationTokens = tokenize(criteria.locationQuery ?? '');
  const symptomTokens = (criteria.symptomKeywords ?? [])
    .flatMap((kw) => tokenize(kw))
    .slice(0, 25);

  const verifiedOnly = technicians.filter((tech) => {
    if (tech.verificationStatus !== 'verified') return false;
    if (criteria.onlyAvailable && tech.availabilityStatus !== 'available') return false;
    return true;
  });

  const results: TechnicianMatchResult[] = verifiedOnly.map((tech) => {
    const reasons: string[] = [];

    // 1. Appliance Category Compatibility (0.35)
    let categoryScore = 0.2;
    if (!targetCategory || targetCategory === 'all') {
      categoryScore = 1.0;
    } else if (tech.serviceCategories.includes(targetCategory as ApplianceSlug)) {
      categoryScore = 1.0;
      reasons.push(`Certified for ${targetCategory.replace(/_/g, ' ')} repairs`);
    } else if (tech.serviceCategories.includes('other')) {
      categoryScore = 0.45;
      reasons.push('Supports general household appliances');
    } else {
      categoryScore = 0;
    }

    // 2. Service Location Match (0.25)
    let locationScore = 0.5;
    if (locationTokens.length === 0) {
      locationScore = 0.8;
    } else {
      const areaLower = (tech.serviceArea ?? '').toLowerCase();
      const areaTokens = new Set(tokenize(areaLower));
      const matchedTokens = locationTokens.filter(
        (tok) => areaTokens.has(tok) || areaLower.includes(tok)
      );
      if (matchedTokens.length > 0) {
        locationScore = Math.min(1, 0.5 + (matchedTokens.length / locationTokens.length) * 0.5);
        reasons.push(`Serves ${tech.serviceArea}`);
      } else {
        locationScore = 0;
      }
    }

    // 3. Availability Status (0.15)
    let availabilityScore = 0;
    if (tech.availabilityStatus === 'available') {
      availabilityScore = 1.0;
      reasons.push('Currently available for booking');
    } else if (tech.availabilityStatus === 'busy') {
      availabilityScore = 0.35;
      reasons.push('Currently busy (limited slots)');
    } else {
      availabilityScore = 0;
    }

    // 4. Live Customer Rating (0.15)
    const revStats = reviewMap.get(tech.uid);
    const reviewCount = revStats?.count ?? 0;
    const liveRatingAvg =
      reviewCount > 0 ? Number((revStats!.sum / reviewCount).toFixed(2)) : tech.ratingAvg || 0;
    const ratingScore = reviewCount > 0 ? Math.max(0, Math.min(1, liveRatingAvg / 5)) : 0.65;
    if (reviewCount > 0) {
      reasons.push(`Rated ${liveRatingAvg.toFixed(1)}/5 across ${reviewCount} verified review${reviewCount === 1 ? '' : 's'}`);
    } else {
      reasons.push('Verified technician (awaiting first customer review)');
    }

    // 5. Experience Years (0.10)
    const expYears = Math.max(0, Number(tech.experienceYears) || 0);
    const experienceScore = Math.min(1, expYears / 10);
    if (expYears >= 3) {
      reasons.push(`${expYears} years of repair experience`);
    }

    // Optional skill keyword bonus (+0.05 max)
    let skillBonus = 0;
    if (symptomTokens.length > 0 && Array.isArray(tech.skills)) {
      const skillText = tech.skills.join(' ').toLowerCase();
      const matchedSkills = tech.skills.filter((skill) =>
        symptomTokens.some((tok) => skill.toLowerCase().includes(tok))
      );
      if (matchedSkills.length > 0 || symptomTokens.some((tok) => skillText.includes(tok))) {
        skillBonus = 0.05;
        reasons.push(`Skill alignment: ${matchedSkills.slice(0, 2).join(', ') || 'fault match'}`);
      }
    }

    const rawScore =
      categoryScore * WEIGHTS.categoryCompatibility +
      locationScore * WEIGHTS.locationMatch +
      availabilityScore * WEIGHTS.availabilityStatus +
      ratingScore * WEIGHTS.customerRating +
      experienceScore * WEIGHTS.experienceYears +
      skillBonus;

    const matchScore = Number(Math.max(0, Math.min(1, rawScore)).toFixed(3));

    return {
      technician: tech,
      matchScore,
      matchReasons: reasons.slice(0, 4),
      liveRatingAvg,
      reviewCount,
    };
  });

  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (b.liveRatingAvg !== a.liveRatingAvg) return b.liveRatingAvg - a.liveRatingAvg;
    return (b.technician.experienceYears || 0) - (a.technician.experienceYears || 0);
  });

  return {
    rankingMethod: 'rule_based_weighted_heuristics',
    weights: { ...WEIGHTS },
    results,
  };
}
