import type { HeatLevel, LeadData } from '@/types/lead'

export interface ScoreFactor {
  label: string
  points: number
  earned: boolean
}

/**
 * Returns the score breakdown — each factor with its label, max points, and
 * whether it was earned — mirroring the logic in calculateHeatScore exactly.
 */
export function getScoreBreakdown(lead: LeadData): ScoreFactor[] {
  const facebookEarned = (() => {
    if (!lead.lastPostDate) return false
    const d = new Date(lead.lastPostDate)
    if (isNaN(d.getTime())) return false
    return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30
  })()

  return [
    { label: 'No website', points: 3, earned: !lead.hasWebsite },
    { label: 'No Google Business profile', points: 2, earned: !lead.hasGoogleProfile },
    {
      label: 'Facebook active (post within 30 days)',
      points: 1,
      earned: facebookEarned,
    },
    {
      label: 'Follower count > 100',
      points: 1,
      earned: lead.followerCount != null && lead.followerCount > 100,
    },
    {
      label: 'High-intent source (Google Maps / Walk-in)',
      points: 1,
      earned: lead.source === 'google_maps' || lead.source === 'walk_in',
    },
    {
      label: 'High-value sector',
      points: 2,
      earned: ['spaza_food', 'salon_hair', 'auto_mechanic', 'clinic_medical'].includes(lead.sector),
    },
  ]
}

/**
 * Calculates a heat score (1–10) based on the lead's profile.
 * Higher scores indicate a more promising lead.
 */
export function calculateHeatScore(lead: LeadData): number {
  let score = 0

  // No website: +3
  if (lead.hasWebsite === false) {
    score += 3
  }

  // No Google profile: +2
  if (lead.hasGoogleProfile === false) {
    score += 2
  }

  // Facebook active — last post within 30 days: +1
  if (lead.lastPostDate) {
    const lastPost = new Date(lead.lastPostDate)
    if (!isNaN(lastPost.getTime())) {
      const now = new Date()
      const diffMs = now.getTime() - lastPost.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      if (diffDays <= 30) {
        score += 1
      }
    }
  }

  // Has followers > 100: +1
  if (lead.followerCount != null && lead.followerCount > 100) {
    score += 1
  }

  // Source is google_maps or walk_in: +1
  if (lead.source === 'google_maps' || lead.source === 'walk_in') {
    score += 1
  }

  // High-value sector: +2
  if (
    lead.sector === 'spaza_food' ||
    lead.sector === 'salon_hair' ||
    lead.sector === 'auto_mechanic' ||
    lead.sector === 'clinic_medical'
  ) {
    score += 2
  }

  // Cap between 1 and 10
  return Math.min(10, Math.max(1, score))
}

/**
 * Returns a heat level label based on the numeric score.
 */
export function getHeatLevel(score: number): HeatLevel {
  if (score >= 9) return 'HOT'
  if (score >= 6) return 'WARM'
  return 'COLD'
}
