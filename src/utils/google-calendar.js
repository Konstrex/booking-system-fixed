/**
 * Google Calendar Integration Module
 * Handles authentication and event creation for the booking system
 */

class GoogleCalendarIntegration {
  constructor(env) {
    this.clientEmail = env.GOOGLE_CLIENT_EMAIL || '';
    this.privateKey = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
    this.calendarId = env.GOOGLE_CALENDAR_ID || '';
    this.initialized = this.clientEmail && this.privateKey && this.calendarId;
    this.tokenExpiry = null;
    this.accessToken = null;
  }

  /**
   * Check if the integration is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.initialized;
  }

  /**
   * Generate JWT token for Google API authentication
   * @returns {string} - JWT token
   */
  generateJWT() {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const oneHour = 60 * 60;
    const expiry = now + oneHour;

    const payload = {
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now
    };

    // Function to base64url encode
    const base64urlEncode = (str) => {
      return btoa(str)
        .replace(/\\+/g, '-')
        .replace(/\\//g, '_')
        .replace(/=/g, '');
    };

    // Create the JWT segments
    const headerEncoded = base64urlEncode(JSON.stringify(header));
    const payloadEncoded = base64urlEncode(JSON.stringify(payload));
    
    // In a real implementation, you would sign this with the private key
    // Here we're using a placeholder for the signature process
    // This would use the crypto API in a full implementation
    
    // For Cloudflare Workers, you would use the WebCrypto API
    // This requires importing the private key and using subtle.sign
    
    // Placeholder for signature (in a real implementation, this would be properly signed)
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    
    return signatureInput;
  }

  /**
   * Get an access token for Google APIs
   * @returns {Promise<string>} - Access token
   */
  async getAccessToken() {
    // Check if we already have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      throw new Error('Google Calendar integration not properly configured');
    }

    try {
      // Generate JWT
      const jwt = this.generateJWT();

      // Exchange JWT for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error getting access token:', data);
        throw new Error(`Failed to get access token: ${data.error}`);
      }

      // Set token and expiry
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Error in getAccessToken:', error);
      throw error;
    }
  }

  /**
   * Check if a time slot is available in the calendar
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} time - Time in HH:MM format
   * @param {number} duration - Duration in minutes
   * @returns {Promise<boolean>} - Whether the time slot is available
   */
  async checkAvailability(date, time, duration = 60) {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar integration not properly configured');
    }

    try {
      const token = await this.getAccessToken();

      // Parse date and time to create start and end times
      const [hours, minutes] = time.split(':').map(Number);
      const startDateTime = new Date(`${date}T${time}:00`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

      // Format for Google Calendar API
      const timeMin = startDateTime.toISOString();
      const timeMax = endDateTime.toISOString();

      // Query Google Calendar for events in this time range
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error checking availability:', data);
        throw new Error(`Failed to check availability: ${data.error?.message || 'Unknown error'}`);
      }

      // If there are any events in this time range, the slot is not available
      return data.items && data.items.length === 0;
    } catch (error) {
      console.error('Error in checkAvailability:', error);
      throw error;
    }
  }

  /**
   * Get all available time slots for a given date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {number} duration - Duration in minutes
   * @returns {Promise<Array>} - Array of available time slots
   */
  async getAvailableTimeSlots(date, duration = 60) {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar integration not properly configured');
    }

    try {
      const token = await this.getAccessToken();

      // Create start and end of the day
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59`);

      // Format for Google Calendar API
      const timeMin = startOfDay.toISOString();
      const timeMax = endOfDay.toISOString();

      // Query Google Calendar for events on this day
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error getting calendar events:', data);
        throw new Error(`Failed to get calendar events: ${data.error?.message || 'Unknown error'}`);
      }

      // Define business hours (9 AM to 5 PM)
      const businessHourStart = 9;
      const businessHourEnd = 17;
      
      // Duration in hours
      const durationHours = duration / 60;
      
      // Generate all possible time slots
      const allTimeSlots = [];
      for (let hour = businessHourStart; hour < businessHourEnd; hour += durationHours) {
        const startHour = Math.floor(hour);
        const startMinute = (hour - startHour) * 60;
        
        const endHour = Math.floor(hour + durationHours);
        const endMinute = ((hour + durationHours) - endHour) * 60;
        
        const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        
        allTimeSlots.push({
          startTime,
          endTime
        });
      }
      
      // Filter out time slots that overlap with existing events
      const existingEvents = data.items || [];
      
      const availableSlots = allTimeSlots.filter(slot => {
        const slotStart = new Date(`${date}T${slot.startTime}:00`);
        const slotEnd = new Date(`${date}T${slot.endTime}:00`);
        
        // Check if this slot overlaps with any existing event
        return !existingEvents.some(event => {
          const eventStart = new Date(event.start.dateTime);
          const eventEnd = new Date(event.end.dateTime);
          
          // Check for overlap
          return (
            (slotStart >= eventStart && slotStart < eventEnd) ||
            (slotEnd > eventStart && slotEnd <= eventEnd) ||
            (slotStart <= eventStart && slotEnd >= eventEnd)
          );
        });
      });
      
      return availableSlots;
    } catch (error) {
      console.error('Error in getAvailableTimeSlots:', error);
      throw error;
    }
  }

  /**
   * Create a calendar event for a booking
   * @param {Object} bookingData - Booking data
   * @returns {Promise<Object>} - Created event data
   */
  async createEvent(bookingData) {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar integration not properly configured');
    }

    try {
      const token = await this.getAccessToken();

      // Format start and end times
      const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`);
      
      // Calculate total duration from all services
      const totalDuration = bookingData.services.reduce((total, service) => total + service.duration, 0);
      const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60 * 1000);

      // Format services for description
      const servicesText = bookingData.services.map(
        service => `${service.name} (${service.duration} min, ${service.price} €)`
      ).join('\\n');

      // Create event data
      const eventData = {
        summary: `Booking: ${bookingData.name}`,
        description: `Services: ${servicesText}\\n\\nClient: ${bookingData.name}\\nEmail: ${bookingData.email}\\nPhone: ${bookingData.phone}\\n\\nNotes: ${bookingData.notes || 'None'}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Europe/Berlin'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Europe/Berlin'
        },
        attendees: [
          { email: bookingData.email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 } // 1 hour before
          ]
        }
      };

      // Create the event in Google Calendar
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error creating calendar event:', data);
        throw new Error(`Failed to create calendar event: ${data.error?.message || 'Unknown error'}`);
      }

      return {
        success: true,
        eventId: data.id,
        eventLink: data.htmlLink,
        created: data.created
      };
    } catch (error) {
      console.error('Error in createEvent:', error);
      throw error;
    }
  }
}

module.exports = { GoogleCalendarIntegration };