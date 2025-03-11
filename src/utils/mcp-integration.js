/**
 * MCP Server Integration Module for Booking System
 * This module handles communication with MCP servers for various booking events
 */

class MCPIntegration {
  constructor(env) {
    this.enabled = env?.MCP_ENABLED === 'true' || false;
    this.serverUrl = env?.MCP_SERVER_URL || '';
    this.apiKey = env?.MCP_API_KEY || '';
    this.initialized = this.enabled && this.serverUrl && this.apiKey;
    
    // Log initialization status
    if (this.initialized) {
      console.log('[MCP] Integration initialized successfully');
    } else {
      console.log('[MCP] Integration not initialized. Check environment variables: MCP_ENABLED, MCP_SERVER_URL, MCP_API_KEY');
    }
  }

  /**
   * Check if the MCP integration is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.initialized;
  }

  /**
   * Notify MCP server about a booking creation event
   * @param {Object} bookingData - The booking data
   * @returns {Promise<Object>} - Response from MCP server
   */
  async notifyBookingCreated(bookingData) {
    return this.sendNotification('booking_created', bookingData);
  }

  /**
   * Notify MCP server about an email sent event
   * @param {Object} emailData - The email data
   * @returns {Promise<Object>} - Response from MCP server
   */
  async notifyEmailSent(emailData) {
    return this.sendNotification('email_sent', emailData);
  }

  /**
   * Notify MCP server about a calendar event creation
   * @param {Object} calendarData - The calendar event data
   * @returns {Promise<Object>} - Response from MCP server
   */
  async notifyCalendarEventCreated(calendarData) {
    return this.sendNotification('calendar_event_created', calendarData);
  }

  /**
   * Notify MCP server about an availability check
   * @param {Object} availabilityData - The availability check data
   * @returns {Promise<Object>} - Response from MCP server
   */
  async notifyAvailabilityCheck(availabilityData) {
    return this.sendNotification('availability_check', availabilityData);
  }

  /**
   * Notify MCP server about a booking error
   * @param {Object} errorData - The error data
   * @returns {Promise<Object>} - Response from MCP server
   */
  async notifyBookingError(errorData) {
    return this.sendNotification('booking_error', errorData);
  }

  /**
   * Send a notification to the MCP server
   * @param {string} eventType - The type of event
   * @param {Object} data - The data to send
   * @returns {Promise<Object>} - Response from MCP server
   */
  async sendNotification(eventType, data) {
    if (!this.initialized) {
      console.log(`[MCP] Integration disabled or not configured. Skipping ${eventType} notification.`);
      return { success: false, message: 'MCP integration not enabled' };
    }

    try {
      console.log(`[MCP] Sending ${eventType} notification to MCP server`);
      
      // Add a unique request ID for tracking
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const response = await fetch(`${this.serverUrl}/api/booking-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Request-ID': requestId
        },
        body: JSON.stringify({
          eventType,
          timestamp: new Date().toISOString(),
          requestId,
          data
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MCP] Error from server (${response.status}):`, errorText);
        return { 
          success: false, 
          statusCode: response.status,
          message: `Server returned ${response.status}: ${errorText}`
        };
      }

      const responseData = await response.json();
      console.log(`[MCP] Notification sent successfully:`, responseData);
      return { success: true, data: responseData };
    } catch (error) {
      console.error(`[MCP] Error sending notification:`, error);
      return { 
        success: false, 
        message: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Process booking through MCP server - this is a special method that handles the entire booking flow
   * @param {Object} bookingData - The complete booking data
   * @returns {Promise<Object>} - Response from MCP server with booking result
   */
  async processBooking(bookingData) {
    if (!this.initialized) {
      console.log(`[MCP] Integration disabled or not configured. Cannot process booking.`);
      return { success: false, message: 'MCP integration not enabled' };
    }

    try {
      console.log(`[MCP] Processing complete booking through MCP server`);
      
      const response = await fetch(`${this.serverUrl}/api/process-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          bookingData,
          timestamp: new Date().toISOString(),
          calendarId: bookingData.calendarId
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error(`[MCP] Error processing booking:`, responseData);
        return { 
          success: false, 
          statusCode: response.status,
          message: responseData.message || `Failed to process booking`
        };
      }

      console.log(`[MCP] Booking processed successfully:`, responseData);
      return { 
        success: true, 
        data: responseData,
        eventId: responseData.eventId,
        emailSent: responseData.emailSent 
      };
    } catch (error) {
      console.error(`[MCP] Error processing booking:`, error);
      return { 
        success: false, 
        message: error.message,
        stack: error.stack
      };
    }
  }
}

module.exports = { MCPIntegration };