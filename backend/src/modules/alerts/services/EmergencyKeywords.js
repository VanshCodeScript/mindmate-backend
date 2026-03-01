'use strict'

/**
 * EmergencyKeywords.js
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Centralised keyword dictionaries for the emergency detection engine.
 *
 * Each entry carries:
 *   pattern  â€“ RegExp tested against the lower-cased user message
 *   weight   â€“ additive score contribution
 *   category â€“ human-readable tag used in alert messages
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

/** @typedef {{ pattern: RegExp, weight: number, category: string }} KeywordEntry */

// â”€â”€ LEVEL 3 â€“ Critical / life-threatening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A single match here alone is enough to cross the LEVEL_3 threshold.
/** @type {KeywordEntry[]} */
const CRITICAL_KEYWORDS = [
  // â”€â”€ Cardiac â”€â”€
  { pattern: /heart[\s\-]*attack/i,                          weight: 100, category: 'cardiac' },
  { pattern: /cardiac[\s\-]*arrest/i,                        weight: 100, category: 'cardiac' },
  { pattern: /my\s*(heart|chest)\s*(is\s*)?(stop|stopped|stopping|failing|failed)/i, weight: 95, category: 'cardiac' },
  { pattern: /heart\s*(is\s*)?(hurting|hurts|killing|very\s*bad)/i, weight: 90, category: 'cardiac' },
  { pattern: /chest[\s\-]*(is\s*)?(very\s*|really\s*|so\s*)?(pain|pains|hurting|hurts?|tight(ness)?|pressure|crushing|squeezing|burning)/i, weight: 95, category: 'cardiac' },
  { pattern: /(pressure|tightness|squeezing|crushing)\s*(in|on|around)\s*(my\s*)?(chest|heart)/i, weight: 95, category: 'cardiac' },
  { pattern: /left\s*(arm|jaw|shoulder)\s*(is\s*)?(very\s*|really\s*)?(pain(ing|ful)?|numb(ness)?|tingling|hurting|hurts?)/i, weight: 90, category: 'cardiac' },
  { pattern: /palpitation/i,                                 weight: 75, category: 'cardiac' },
  { pattern: /heart\s*(racing|pounding|fluttering|skipping)/i, weight: 70, category: 'cardiac' },

  // â”€â”€ Respiratory â”€â”€
  { pattern: /ca?n[''']?t\s*(breathe|catch\s*(my\s*)?breath)/i, weight: 95, category: 'respiratory' },
  { pattern: /not\s*(able\s*to\s*)?breath(e|ing)?/i,         weight: 90, category: 'respiratory' },
  { pattern: /(difficulty|trouble|hard\s*to|struggling\s*to)\s*breath(e|ing)?/i, weight: 90, category: 'respiratory' },
  { pattern: /short(ness)?\s*(of\s*)?breath/i,               weight: 88, category: 'respiratory' },
  { pattern: /can[''']?t\s*(get\s*)?air/i,                   weight: 90, category: 'respiratory' },
  { pattern: /choking/i,                                      weight: 90, category: 'respiratory' },
  { pattern: /suffocating/i,                                  weight: 90, category: 'respiratory' },

  // â”€â”€ Neurological / Stroke â”€â”€
  { pattern: /\bstroke\b/i,                                   weight: 95, category: 'neurological' },
  { pattern: /face\s*(is\s*)?(drooping|dropping|numb|paralyz)/i, weight: 95, category: 'neurological' },
  { pattern: /(arm|leg)\s*(weak|numb|paralyz|can[''']?t\s*move)/i, weight: 90, category: 'neurological' },
  { pattern: /slurred?\s*(speech|word|talk)/i,                weight: 90, category: 'neurological' },
  { pattern: /sudden\s*(severe\s*)?headache/i,                weight: 88, category: 'neurological' },
  { pattern: /uncons?cious(ness)?/i,                          weight: 95, category: 'neurological' },
  { pattern: /not\s*(responding|conscious|waking\s*up)/i,     weight: 85, category: 'neurological' },
  { pattern: /\bseizure\b/i,                                  weight: 90, category: 'neurological' },
  { pattern: /convuls/i,                                      weight: 90, category: 'neurological' },
  { pattern: /(fitting|fit)\s*(again|now|badly)?/i,           weight: 85, category: 'neurological' },

  // â”€â”€ Trauma / Bleeding â”€â”€
  { pattern: /severe\s*bleed/i,                               weight: 90, category: 'trauma' },
  { pattern: /bleed(ing)?\s*(a lot|won[''']?t\s*stop|profuse|heavily|everywhere)/i, weight: 90, category: 'trauma' },
  { pattern: /blood\s*(everywhere|all\s*over|won[''']?t\s*stop|gushing|pouring)/i, weight: 90, category: 'trauma' },
  { pattern: /head\s*(injury|trauma|hit|crack)/i,             weight: 80, category: 'trauma' },

  // â”€â”€ Distress / Emergency calls â”€â”€
  { pattern: /call\s*(an?\s*)?ambulance/i,                    weight: 90, category: 'distress' },
  { pattern: /call\s*(9|nine)\s*1\s*1/i,                      weight: 90, category: 'distress' },
  { pattern: /i\s*(am|'?m)\s*dying/i,                         weight: 95, category: 'critical' },
  { pattern: /\bhelp\s*me\b.{0,40}(dying|die|dead|dying)/i,  weight: 95, category: 'critical' },
  { pattern: /please\s*(help|someone|anyone).{0,20}(dying|dying|emergency)/i, weight: 90, category: 'critical' },

  // â”€â”€ Medication â”€â”€
  { pattern: /overdos/i,                                      weight: 90, category: 'medication' },
  { pattern: /swallow(ed)?\s*(too\s*many|all\s*(of\s*)?my|all\s*the)\s*(pill|tablet|med)/i, weight: 95, category: 'medication' },
  { pattern: /took\s*(all|too\s*many)\s*(of\s*my\s*)?(pill|tablet|med)/i, weight: 90, category: 'medication' },
  { pattern: /\bpoison(ed)?\b/i,                              weight: 88, category: 'medication' },

  // â”€â”€ Mental health crisis â”€â”€
  { pattern: /suicid/i,                                       weight: 100, category: 'mental-health' },
  { pattern: /want\s*to\s*(die|end\s*(my\s*)?life|kill\s*(my)?self)/i, weight: 100, category: 'mental-health' },
  { pattern: /going\s*to\s*(kill|hurt)\s*(my)?self/i,         weight: 100, category: 'mental-health' },
]

// â”€â”€ LEVEL 2 â€“ High concern â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** @type {KeywordEntry[]} */
const HIGH_KEYWORDS = [
  // â”€â”€ Falls â”€â”€
  { pattern: /\bi\s*(have\s*)?fell?\b/i,                      weight: 55, category: 'fall' },
  { pattern: /fallen(\s*down)?/i,                             weight: 55, category: 'fall' },
  { pattern: /i\s*(just\s*)?(fell|tripped|slipped)/i,         weight: 55, category: 'fall' },
  { pattern: /can[''']?t\s*(get\s*up|stand(\s*up)?)/i,        weight: 60, category: 'fall' },
  { pattern: /fell\s*(and|but)\s*(hit|hurt|bleeding)/i,       weight: 65, category: 'fall' },
  { pattern: /(hit|banged|knocked)\s*(my\s*)?(head|self)\s*(on|against)/i, weight: 55, category: 'fall' },

  // â”€â”€ Cardiac (non-critical) â”€â”€
  { pattern: /my\s*(heart|chest)\s*(doesn[''']?t\s*feel\s*(right|good)|feels?\s*(strange|funny|off|weird))/i, weight: 55, category: 'cardiac' },
  { pattern: /heart\s*(beat|rate)\s*(very\s*)?(fast|slow|irregular|uneven)/i, weight: 50, category: 'cardiac' },
  { pattern: /(feeling|feeling\s*a)\s*(pressure|tightness)\s*(in|on)\s*(my\s*)?(chest|heart)/i, weight: 60, category: 'cardiac' },

  // â”€â”€ Dizziness / fainting â”€â”€
  { pattern: /\bdizzy\b/i,                                    weight: 40, category: 'dizziness' },
  { pattern: /feel\s*(very\s*|really\s*)?dizzy/i,             weight: 45, category: 'dizziness' },
  { pattern: /room\s*(is\s*)?(spinning|moving)/i,             weight: 45, category: 'dizziness' },
  { pattern: /lightheaded/i,                                   weight: 42, category: 'dizziness' },
  { pattern: /faint(ing|ed|y)?\b/i,                           weight: 50, category: 'cardiac' },
  { pattern: /pass(ed|ing)?\s*out/i,                          weight: 55, category: 'cardiac' },
  { pattern: /about\s*to\s*(faint|pass\s*out|collapse)/i,     weight: 58, category: 'cardiac' },
  { pattern: /nearly\s*(fainted|collapsed|fell)/i,            weight: 55, category: 'cardiac' },

  // â”€â”€ Cognitive â”€â”€
  { pattern: /\bconfused\b/i,                                  weight: 40, category: 'cognitive' },
  { pattern: /disoriented/i,                                   weight: 45, category: 'cognitive' },
  { pattern: /don[''']?t\s*know\s*where\s*i\s*am/i,           weight: 55, category: 'cognitive' },
  { pattern: /(can[''']?t|cannot)\s*(remember|think|speak)\s*(straight|properly|at\s*all)/i, weight: 50, category: 'cognitive' },

  // â”€â”€ Pain â”€â”€
  { pattern: /sharp\s*(chest\s*)?pain/i,                      weight: 55, category: 'pain' },
  { pattern: /severe\s*(chest\s*|stomach\s*|head\s*)?pain/i,  weight: 55, category: 'pain' },
  { pattern: /(unbearable|excruciating|agonizing)\s*pain/i,   weight: 65, category: 'pain' },
  { pattern: /pain\s*(spreading|radiating|going)\s*(to|down|up)/i, weight: 58, category: 'pain' },

  // â”€â”€ Neurological â”€â”€
  { pattern: /numb(ness)?\s*(in|on)?\s*(arm|leg|face|hand|foot)/i, weight: 55, category: 'neurological' },
  { pattern: /sudden\s*(weakness|numbness|paralysis)/i,        weight: 58, category: 'neurological' },
  { pattern: /vision\s*(blur(red|ry)?|loss|gone|double)/i,    weight: 52, category: 'neurological' },
  { pattern: /can[''']?t\s*(speak|talk|move|walk|see)/i,      weight: 60, category: 'neurological' },
  { pattern: /everything\s*(is\s*)?(blurry|dark|going\s*dark)/i, weight: 58, category: 'neurological' },

  // â”€â”€ Medication â”€â”€
  { pattern: /wrong\s*med(ication|icine)?/i,                  weight: 50, category: 'medication' },
  { pattern: /took\s*too\s*(many|much)/i,                     weight: 55, category: 'medication' },
  { pattern: /allergic\s*reaction/i,                          weight: 60, category: 'medication' },
  { pattern: /throat\s*(closing|swelling|swollen)/i,          weight: 65, category: 'medication' },

  // â”€â”€ Nausea / distress â”€â”€
  { pattern: /vomit(ing|ed)?/i,                               weight: 30, category: 'nausea' },
  { pattern: /throw(ing)?\s*up/i,                             weight: 30, category: 'nausea' },
  { pattern: /feel\s*(very\s*|really\s*)?sick/i,              weight: 32, category: 'illness' },
  { pattern: /alone\s*and\s*(afraid|scared|hurt|in\s*pain)/i, weight: 52, category: 'distress' },
  { pattern: /nobody\s*(is\s*)?(here|coming|help)/i,          weight: 46, category: 'distress' },
  { pattern: /need\s*(help|doctor|nurse|ambulance)\s*(now|urgently|immediately|please)/i, weight: 48, category: 'distress' },
  { pattern: /(please|someone)\s*(help|call|get)\s*(me|someone|help)/i, weight: 44, category: 'distress' },

  // â”€â”€ Breathing (non-critical) â”€â”€
  { pattern: /hard\s*to\s*breath/i,                           weight: 50, category: 'respiratory' },
  { pattern: /(breathing|breath)\s*(difficult|labored|heavy)/i, weight: 48, category: 'respiratory' },
  { pattern: /gasping/i,                                       weight: 55, category: 'respiratory' },
  { pattern: /wheezing/i,                                      weight: 45, category: 'respiratory' },
  { pattern: /asthma\s*(attack|inhaler\s*(not\s*working|ran\s*out|empty|missing))/i, weight: 55, category: 'respiratory' },
]

// â”€â”€ LEVEL 1 â€“ Mild concern â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** @type {KeywordEntry[]} */
const MILD_KEYWORDS = [
  // â”€â”€ Pain â”€â”€
  { pattern: /headache/i,                                      weight: 20, category: 'pain' },
  { pattern: /migraine/i,                                      weight: 22, category: 'pain' },
  { pattern: /stomach\s*(ache|hurts?|cramps?|upset)/i,        weight: 15, category: 'pain' },
  { pattern: /back\s*(pain|ache|hurts?)/i,                     weight: 14, category: 'pain' },
  { pattern: /hurt\s*(a\s*(bit|little|lot))?/i,               weight: 15, category: 'pain' },
  { pattern: /\bsore\b/i,                                      weight: 12, category: 'pain' },
  { pattern: /aching/i,                                        weight: 12, category: 'pain' },
  { pattern: /in\s*pain/i,                                     weight: 18, category: 'pain' },

  // â”€â”€ Illness â”€â”€
  { pattern: /not\s*(feeling\s*)?well/i,                       weight: 20, category: 'illness' },
  { pattern: /feel\s*(a\s*(little\s*)?|bit\s*)?bad/i,         weight: 15, category: 'illness' },
  { pattern: /i\s*(don[''']?t|do\s*not)\s*feel\s*(good|right|well)/i, weight: 18, category: 'illness' },
  { pattern: /feel\s*(so\s*)?(weak|terrible|awful|dreadful)/i, weight: 22, category: 'illness' },
  { pattern: /under\s*the\s*weather/i,                         weight: 14, category: 'illness' },
  { pattern: /coming\s*down\s*with\s*(something|a|the)/i,      weight: 14, category: 'illness' },
  { pattern: /temperature|fever|chills?/i,                     weight: 16, category: 'illness' },
  { pattern: /sweating\s*(a\s*lot|heavily|profusely)/i,        weight: 16, category: 'illness' },
  { pattern: /nausea(ted)?|feeling\s*nauseous/i,               weight: 14, category: 'nausea' },

  // â”€â”€ Fatigue â”€â”€
  { pattern: /tired\s*(all\s*(the\s*)?time|constantly|very|extremely)?/i, weight: 10, category: 'fatigue' },
  { pattern: /exhausted|no\s*energy/i,                         weight: 12, category: 'fatigue' },
  { pattern: /can[''']?t\s*(get\s*(up|out)|move)\s*(today)?/i, weight: 14, category: 'fatigue' },

  // â”€â”€ Mental health â”€â”€
  { pattern: /anxious|anxiety/i,                               weight: 18, category: 'mental-health' },
  { pattern: /panick?/i,                                       weight: 20, category: 'mental-health' },
  { pattern: /depress(ed|ion)?/i,                              weight: 20, category: 'mental-health' },
  { pattern: /lonly|loneliness?|so\s*alone/i,                  weight: 14, category: 'mental-health' },
  { pattern: /hopeless|worthless|no\s*(reason|point)\s*to\s*(live|go\s*on)/i, weight: 22, category: 'mental-health' },
  { pattern: /can[''']?t\s*(cope|go\s*on|take\s*it)/i,         weight: 20, category: 'mental-health' },

  // â”€â”€ Medication â”€â”€
  { pattern: /medication\s*(ran\s*out|finished|empty|gone)/i,  weight: 18, category: 'medication' },
  { pattern: /missed?\s*my\s*(dose|pill|medication)/i,         weight: 15, category: 'medication' },
  { pattern: /out\s*of\s*(medication|pills?|tablets?)/i,       weight: 16, category: 'medication' },
  { pattern: /pill\s*(stuck|caught)\s*(in|at)\s*(throat|mouth)/i, weight: 20, category: 'medication' },

  // â”€â”€ Distress â”€â”€
  { pattern: /\bhelp\s*me\b/i,                                 weight: 18, category: 'distress' },
  { pattern: /i\s*need\s*(some\s*)?help/i,                     weight: 20, category: 'distress' },
  { pattern: /something\s*(is\s*)?(wrong|not\s*right)/i,       weight: 18, category: 'distress' },
  { pattern: /not\s*(sure\s*)?what('s|\s*is)\s*(wrong|happening)/i, weight: 14, category: 'distress' },
  { pattern: /scared|frightened|terrified/i,                   weight: 16, category: 'distress' },
]

// â”€â”€ Context boosters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Applied to current score when prior messages in session contain these patterns.
/** @type {Array<{ pattern: RegExp, boost: number }>} */
const CONTEXT_BOOSTERS = [
  { pattern: /pain/i,        boost: 10 },
  { pattern: /hurt/i,        boost: 8  },
  { pattern: /sick/i,        boost: 8  },
  { pattern: /dizzy/i,       boost: 12 },
  { pattern: /fell?/i,       boost: 12 },
  { pattern: /confus/i,      boost: 10 },
  { pattern: /chest/i,       boost: 15 },
  { pattern: /heart/i,       boost: 15 },
  { pattern: /breath/i,      boost: 15 },
  { pattern: /bleed/i,       boost: 15 },
  { pattern: /numb/i,        boost: 10 },
  { pattern: /weak/i,        boost: 8  },
  { pattern: /vomit|throw\s*up/i, boost: 8 },
  { pattern: /head(ache)?/i, boost: 6  },
]

// â”€â”€ Score thresholds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SEVERITY_THRESHOLDS = {
  LEVEL_3: 70,   // Critical â€“ instant Telegram alert + Twilio call
  LEVEL_2: 35,   // High concern â€“ confirmation banner shown
  LEVEL_1: 15,   // Mild concern â€“ logged only
  LEVEL_0: 0,    // Normal
}

module.exports = {
  CRITICAL_KEYWORDS,
  HIGH_KEYWORDS,
  MILD_KEYWORDS,
  CONTEXT_BOOSTERS,
  SEVERITY_THRESHOLDS,
}
