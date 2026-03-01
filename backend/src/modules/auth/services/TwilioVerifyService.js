const twilio = require('twilio');

class TwilioVerifyService {
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

    // Detect if Twilio Verify is configured
    const twilioEnabled = accountSid && authToken && verifySid;

    if (twilioEnabled) {
      // Production mode: Initialize real Twilio Verify client
      this.twilioClient = twilio(accountSid, authToken);
      this.verifySid = verifySid;
      this.mockMode = false;
      console.log('✅ Twilio Verify Service initialized (production mode)');
    } else {
      // Development mode: Use mock implementation
      this.twilioClient = null;
      this.verifySid = null;
      this.mockMode = true;
      this.mockOTP = '123456'; // Mock OTP code for development
      console.log('🔧 Twilio Verify running in MOCK mode (development) — OTP is 123456');
    }
  }

  /**
   * Send OTP code to the provided phone number
   * @param {string} phoneNumber - Phone number in E.164 format (e.g., +1234567890)
   * @returns {Promise<Object>} Verification object with sid
   * @throws {Error} If OTP sending fails (production only)
   */
  async sendOTP(phoneNumber) {
    if (this.mockMode) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[MOCK OTP] Code:', this.mockOTP, '| Phone:', phoneNumber);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return {
        success: true,
        sid: 'MOCK_VERIFY_' + Date.now(),
        status: 'pending',
        message: `[MOCK] OTP sent to ${phoneNumber}`,
        mockMode: true,
        mockOTP: this.mockOTP,
      };
    }

    try {
      const verification = await this.twilioClient.verify.v2
        .services(this.verifySid)
        .verifications.create({
          to: phoneNumber,
          channel: 'sms',
        });

      console.log(`OTP sent to ${phoneNumber}. SID: ${verification.sid}`);

      return {
        success: true,
        sid: verification.sid,
        status: verification.status,
        message: `OTP sent to ${phoneNumber}`,
      };
    } catch (error) {
      console.error('Error sending OTP:', error.message);
      throw new Error(`Failed to send OTP: ${error.message}`);
    }
  }

  /**
   * Verify the OTP code provided by the user
   * @param {string} phoneNumber - Phone number in E.164 format
   * @param {string} code - 6-digit OTP code
   * @returns {Promise<Object>} Verification status (approved/denied)
   * @throws {Error} If verification fails (production only)
   */
  async verifyOTP(phoneNumber, code) {
    if (this.mockMode) {
      const isValid = code === this.mockOTP;
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[MOCK OTP VERIFY] Code: ${code} | Expected: ${this.mockOTP} | ${isValid ? '✅ APPROVED' : '❌ DENIED'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return {
        success: isValid,
        status: isValid ? 'approved' : 'denied',
        message: isValid ? '[MOCK] OTP verified successfully' : '[MOCK] Invalid OTP code',
        mockMode: true,
      };
    }

    try {
      const verificationCheck = await this.twilioClient.verify.v2
        .services(this.verifySid)
        .verificationChecks.create({
          to: phoneNumber,
          code: code,
        });

      console.log(`Verification status for ${phoneNumber}: ${verificationCheck.status}`);

      return {
        success: verificationCheck.status === 'approved',
        status: verificationCheck.status,
        message: verificationCheck.status === 'approved' 
          ? 'OTP verified successfully' 
          : 'Invalid or expired OTP',
      };
    } catch (error) {
      console.error('Error verifying OTP:', error.message);
      throw new Error(`Failed to verify OTP: ${error.message}`);
    }
  }
}

module.exports = new TwilioVerifyService();
