'use strict'

/**
 * RiskScoringService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes an emergency risk score for a single user message,
 * optionally boosted by conversational context (last N messages).
 *
 * Returns a structured result that the EmergencyDetectionService uses to
 * decide whether to escalate, confirm, or ignore.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const {
  CRITICAL_KEYWORDS,
  HIGH_KEYWORDS,
  MILD_KEYWORDS,
  CONTEXT_BOOSTERS,
  SEVERITY_THRESHOLDS,
} = require('./EmergencyKeywords')

/** Maximum number of previous messages considered for context boost */
const CONTEXT_WINDOW = 5

/**
 * @typedef {Object} ScoringResult
 * @property {number}   score            – Final weighted risk score
 * @property {number}   rawScore         – Score before context boost
 * @property {number}   contextBoost     – Amount added by context
 * @property {string}   severity         – 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'
 * @property {number}   severityLevel    – Numeric representation 0-3
 * @property {string[]} matchedKeywords  – Categories of matched keywords
 * @property {string}   summary          – Human-readable summary
 */

class RiskScoringService {
  /**
   * Scan a message against all keyword banks and return structured scoring.
   *
   * @param {string}   message  – Current user message
   * @param {string[]} [context=[]] – Previous user messages (oldest first)
   * @returns {ScoringResult}
   */
  static score(message, context = []) {
    const lower = (message || '').toLowerCase()
    const matched = []
    let rawScore = 0

    // ── 1. Critical keywords ────────────────────────────────────────────────
    for (const entry of CRITICAL_KEYWORDS) {
      if (entry.pattern.test(lower)) {
        rawScore += entry.weight
        matched.push(entry.category)
      }
    }

    // ── 2. High keywords ────────────────────────────────────────────────────
    for (const entry of HIGH_KEYWORDS) {
      if (entry.pattern.test(lower)) {
        rawScore += entry.weight
        matched.push(entry.category)
      }
    }

    // ── 3. Mild keywords ────────────────────────────────────────────────────
    for (const entry of MILD_KEYWORDS) {
      if (entry.pattern.test(lower)) {
        rawScore += entry.weight
        matched.push(entry.category)
      }
    }

    // ── 4. Context boost ───────────────────────────────────────────────────
    const recentContext = (context || []).slice(-CONTEXT_WINDOW)
    let contextBoost = 0

    if (rawScore > 0 && recentContext.length > 0) {
      const contextText = recentContext.join(' ').toLowerCase()
      for (const booster of CONTEXT_BOOSTERS) {
        if (booster.pattern.test(contextText)) {
          contextBoost += booster.boost
        }
      }
    }

    const finalScore = rawScore + contextBoost

    // ── 5. Determine severity ──────────────────────────────────────────────
    let severity = 'LEVEL_0'
    let severityLevel = 0

    if (finalScore >= SEVERITY_THRESHOLDS.LEVEL_3) {
      severity = 'LEVEL_3'
      severityLevel = 3
    } else if (finalScore >= SEVERITY_THRESHOLDS.LEVEL_2) {
      severity = 'LEVEL_2'
      severityLevel = 2
    } else if (finalScore >= SEVERITY_THRESHOLDS.LEVEL_1) {
      severity = 'LEVEL_1'
      severityLevel = 1
    }

    // Deduplicate categories
    const uniqueMatches = [...new Set(matched)]

    const summary = RiskScoringService._buildSummary(severity, uniqueMatches, finalScore)

    return {
      score: finalScore,
      rawScore,
      contextBoost,
      severity,
      severityLevel,
      matchedKeywords: uniqueMatches,
      summary,
    }
  }

  /**
   * Placeholder for LLM-based intent classification.
   * Swap out this stub when integrating with an LLM API.
   *
   * @param {string} _message
   * @returns {Promise<{ intents: string[], confidence: number }>}
   */
  static async classifyIntent(_message) {
    // TODO: Call LLM API here (e.g. Groq, OpenAI) for deeper intent analysis
    return { intents: [], confidence: 0 }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * Build a short human-readable summary of the detection result.
   * @private
   */
  static _buildSummary(severity, categories, score) {
    if (severity === 'LEVEL_0') return 'No emergency signals detected.'

    const cat = categories.length > 0 ? categories.join(', ') : 'general distress'
    const level = severity.replace('LEVEL_', 'Level ')

    const labels = {
      LEVEL_1: 'Mild concern',
      LEVEL_2: 'High concern – possible emergency',
      LEVEL_3: 'CRITICAL EMERGENCY',
    }

    return `${labels[severity] || level} detected (score: ${score}). Categories: ${cat}.`
  }
}

module.exports = RiskScoringService
