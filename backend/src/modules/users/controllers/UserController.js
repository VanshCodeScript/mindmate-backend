'use strict'

const mongoose = require('mongoose')
const User = require('../../../models/User')
const optionalAuth = require('../../../middleware/optionalAuth')

// ─── helpers ─────────────────────────────────────────────────────────────────

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id
}

/** Return demo data when running in dev with dev_ prefix user IDs */
function demoPasportData(userId) {
  return {
    name: 'Demo User',
    age: 72,
    bloodType: 'O+',
    allergies: ['Penicillin', 'Aspirin'],
    medicalHistory: ['Hypertension', 'Type 2 Diabetes'],
    medications: [
      { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
    ],
    primaryPhysician: { name: 'Dr. Smith', phone: '+1-555-0100' },
    emergencyContacts: [
      { name: 'Jane Doe', relationship: 'Daughter', phone: '+1-555-0101' },
    ],
    userId,
    isDemo: true,
  }
}

async function getUserPassportData(userId) {
  // Dev / demo user IDs (not valid ObjectIds)
  if (!isObjectId(userId) || userId.startsWith('dev_')) {
    return demoPasportData(userId)
  }

  const user = await User.findById(userId)
    .select('name age bloodType allergies medicalHistory medications primaryPhysician emergencyContacts')
    .lean()

  if (!user) return demoPasportData(userId)

  return {
    name: user.name,
    age: user.age,
    bloodType: user.bloodType,
    allergies: user.allergies || [],
    medicalHistory: user.medicalHistory || [],
    medications: user.medications || [],
    primaryPhysician: user.primaryPhysician || {},
    emergencyContacts: user.emergencyContacts || [],
    userId,
    isDemo: false,
  }
}

// ─── HTML PDF template ────────────────────────────────────────────────────────

function buildPassportHTML(data) {
  const meds = (data.medications || []).map(m => {
    if (typeof m === 'string') return `<li>${m}</li>`
    return `<li><strong>${m.name || ''}</strong> ${m.dosage || ''} ${m.frequency ? '· ' + m.frequency : ''}</li>`
  }).join('') || '<li>None recorded</li>'

  const allergies = (data.allergies || []).map(a => `<span class="tag">${a}</span>`).join('') || '<span class="tag muted">None</span>'
  const history = (data.medicalHistory || []).map(h => `<li>${h}</li>`).join('') || '<li>None recorded</li>'
  const contacts = (data.emergencyContacts || []).map(c =>
    `<tr><td>${c.name || ''}</td><td>${c.relationship || ''}</td><td>${c.phone || ''}</td></tr>`
  ).join('') || '<tr><td colspan="3">None recorded</td></tr>'

  const physician = data.primaryPhysician
    ? `${data.primaryPhysician.name || ''}${data.primaryPhysician.phone ? ' · ' + data.primaryPhysician.phone : ''}`
    : 'Not specified'

  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Health Passport – ${data.name || 'Patient'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 24px; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; }
  .header-left h1 { font-size: 28px; font-weight: 700; color: #6366f1; }
  .header-left p { font-size: 13px; color: #666; margin-top: 4px; }
  .header-right { text-align: right; font-size: 12px; color: #888; }
  .logo { font-size: 22px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }

  /* Patient card */
  .patient-card { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .patient-name { font-size: 22px; font-weight: 700; }
  .patient-meta { font-size: 13px; opacity: 0.85; margin-top: 4px; }
  .blood-type { background: rgba(255,255,255,0.2); border-radius: 8px; padding: 10px 20px; text-align: center; }
  .blood-type .label { font-size: 11px; opacity: 0.8; }
  .blood-type .value { font-size: 28px; font-weight: 900; }

  /* Sections */
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .section { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; }
  .section.full-width { grid-column: 1 / -1; }
  .section h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #6366f1; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
  .section h2::before { content: ''; display: inline-block; width: 4px; height: 14px; background: #6366f1; border-radius: 2px; }
  .section ul { padding-left: 18px; font-size: 14px; line-height: 1.8; color: #374151; }
  .section p { font-size: 14px; color: #374151; line-height: 1.6; }

  /* Tags */
  .tag { display: inline-block; background: #fee2e2; color: #991b1b; border-radius: 4px; padding: 2px 10px; font-size: 13px; margin: 3px 3px 3px 0; font-weight: 500; }
  .tag.muted { background: #f3f4f6; color: #9ca3af; }

  /* Table */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 6px 10px; background: #f9fafb; color: #6b7280; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 10px; border-top: 1px solid #f3f4f6; color: #374151; }

  /* Footer */
  .footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }

  /* Print */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
    .page { padding: 16px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <span class="logo">MindBridge</span>
      <p>Health Passport · Confidential Medical Document</p>
    </div>
    <div class="header-right">
      <div>Generated: ${generatedDate}</div>
      ${data.isDemo ? '<div style="color:#f59e0b;font-weight:600;">⚠ Demo Data</div>' : ''}
    </div>
  </div>

  <!-- Patient Card -->
  <div class="patient-card">
    <div>
      <div class="patient-name">${data.name || 'Unknown Patient'}</div>
      <div class="patient-meta">Age: ${data.age ?? 'N/A'} &nbsp;|&nbsp; Primary Physician: ${physician}</div>
    </div>
    <div class="blood-type">
      <div class="label">Blood Type</div>
      <div class="value">${data.bloodType || '?'}</div>
    </div>
  </div>

  <!-- Grid -->
  <div class="grid">

    <div class="section">
      <h2>Allergies</h2>
      <div style="margin-top:4px">${allergies}</div>
    </div>

    <div class="section">
      <h2>Medical History</h2>
      <ul>${history}</ul>
    </div>

    <div class="section full-width">
      <h2>Current Medications</h2>
      <ul>${meds}</ul>
    </div>

    <div class="section full-width">
      <h2>Emergency Contacts</h2>
      <table>
        <thead><tr><th>Name</th><th>Relationship</th><th>Phone</th></tr></thead>
        <tbody>${contacts}</tbody>
      </table>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    MindBridge Elderly Care Platform &nbsp;·&nbsp; This document is intended for medical use only. 
    Keep this information confidential. &nbsp;·&nbsp; Generated ${generatedDate}
  </div>

</div>

<!-- Auto-print on open -->
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 500);
  });
</script>
</body>
</html>`
}

// ─── Controller class ─────────────────────────────────────────────────────────

class UserController {

  /**
   * GET /api/v1/users/passport/:userId
   * Returns JSON medical data for a user (public — no auth required for QR scan use-case)
   */
  async getPublicPassport(req, res) {
    try {
      const data = await getUserPassportData(req.params.userId)
      res.json({ success: true, data })
    } catch (err) {
      console.error('[UserController] getPublicPassport error:', err.message)
      res.status(500).json({ error: 'Failed to load passport data' })
    }
  }

  /**
   * GET /api/v1/users/passport/:userId/pdf
   * Returns a printable HTML page that auto-triggers the browser's Print-to-PDF dialog
   */
  async downloadPassportPDF(req, res) {
    try {
      const data = await getUserPassportData(req.params.userId)
      const html = buildPassportHTML(data)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Content-Disposition', `inline; filename="health-passport-${req.params.userId}.html"`)
      res.send(html)
    } catch (err) {
      console.error('[UserController] downloadPassportPDF error:', err.message)
      res.status(500).json({ error: 'Failed to generate passport PDF' })
    }
  }

  /**
   * PUT /api/v1/users/medical-info
   * Update the authenticated user's medical information
   */
  async updateMedicalInfo(req, res) {
    try {
      const userId = req.auth?.id
      if (!userId || !isObjectId(userId)) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { bloodType, allergies, medicalHistory, medications, primaryPhysician, emergencyContacts } = req.body

      const update = {}
      if (bloodType !== undefined) update.bloodType = bloodType
      if (allergies !== undefined) update.allergies = allergies
      if (medicalHistory !== undefined) update.medicalHistory = medicalHistory
      if (medications !== undefined) update.medications = medications
      if (primaryPhysician !== undefined) update.primaryPhysician = primaryPhysician
      if (emergencyContacts !== undefined) update.emergencyContacts = emergencyContacts

      const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true })
        .select('name age bloodType allergies medicalHistory medications primaryPhysician emergencyContacts')
        .lean()

      if (!user) return res.status(404).json({ error: 'User not found' })

      res.json({ success: true, data: user })
    } catch (err) {
      console.error('[UserController] updateMedicalInfo error:', err.message)
      res.status(500).json({ error: 'Failed to update medical info' })
    }
  }
}

module.exports = new UserController()
