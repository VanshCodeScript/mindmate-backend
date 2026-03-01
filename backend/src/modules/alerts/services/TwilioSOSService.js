'use strict'

const twilio = require('twilio');

class TwilioSOSService {
  constructor() {
    // Lazy – don't throw at module load. isConfigured() guards usage.
    this._ready = false;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    this.fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.toPhoneNumber   = process.env.CAREGIVER_PHONE_NUMBER;

    if (!accountSid || !authToken) {
      console.warn('[TwilioSOS] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN – calls disabled.');
      return;
    }
    if (!this.fromPhoneNumber || !this.toPhoneNumber) {
      console.warn('[TwilioSOS] Missing TWILIO_PHONE_NUMBER or CAREGIVER_PHONE_NUMBER – calls disabled.');
      return;
    }

    this.twilioClient = twilio(accountSid, authToken);
    this._ready = true;
  }

  /** Returns true when all credentials are present. */
  isConfigured() {
    return this._ready;
  }

  /**
   * Triggers an emergency voice call to the caregiver.
   * @param {string} elderlyName - Name of the elderly person
   * @param {string} [reason]    - Short description of the emergency
   * @returns {Promise<{ success: boolean, callSid?: string, message: string }>}
   */
  async triggerEmergencyCall(elderlyName = 'the resident', reason = '') {
    if (!this._ready) {
      console.warn('[TwilioSOS] Call not made – Twilio not configured.');
      return { success: false, message: 'Twilio not configured.' };
    }

    const reasonText = reason
      ? ` The system detected: ${reason}.`
      : '';

    const twiml =
      `<Response><Say voice="alice">` +
      `Emergency alert. MindBridge has detected a potential emergency from ${elderlyName}.${reasonText} ` +
      `Please check on them immediately.` +
      `</Say></Response>`;

    try {
      const call = await this.twilioClient.calls.create({
        to:    this.toPhoneNumber,
        from:  this.fromPhoneNumber,
        twiml,
      });

      console.log(`[TwilioSOS] Emergency call initiated for ${elderlyName}. SID: ${call.sid}`);
      return { success: true, callSid: call.sid, message: `Emergency call triggered for ${elderlyName}` };
    } catch (error) {
      console.error('[TwilioSOS] Call failed:', error.message);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new TwilioSOSService();
