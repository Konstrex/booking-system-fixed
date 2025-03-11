/**
 * Availability Endpoint
 * Handles checking for available time slots
 */
const { OpenAPIRoute, ValidationError } = require('chanfana');
const { z } = require('zod');
const { MCPIntegration } = require('../../utils/mcp-integration');
const { GoogleCalendarIntegration } = require('../../utils/google-calendar');

class AvailabilityEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Booking'],
    summary: 'Check availability for a given date',
    description: 'Returns available time slots for a specific date based on Google Calendar',
    requestBody: {
      content: {
        'application/json': {
          schema: z.object({
            date: z.string().refine((val) => /^\\d{4}-\\d{2}-\\d{2}$/.test(val), {
              message: 'Date must be in YYYY-MM-DD format',
            }),
            duration: z.number().positive().default(60),
          }),
        },
      },
    },
    responses: {
      '200': {
        description: 'Available time slots',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              availableSlots: z.array(
                z.object({
                  startTime: z.string(),
                  endTime: z.string(),
                })
              ),
            }),
          },
        },
      },
      '400': {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              error: z.string(),
            }),
          },
        },
      },
      '500': {
        description: 'Server error',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              error: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c) {
    try {
      console.log('Availability check request received');
      
      // Initialize integrations
      const mcpIntegration = new MCPIntegration(c.env);
      const googleCalendar = new GoogleCalendarIntegration(c.env);
      
      // Log initialization status
      console.log(`MCP Integration initialized: ${mcpIntegration.isConfigured()}`);
      console.log(`Google Calendar Integration initialized: ${googleCalendar.isConfigured()}`);

      // Extract validated data from request
      const { date, duration } = c.req.valid('json');
      
      // Notify MCP server about availability check
      try {
        await mcpIntegration.notifyAvailabilityCheck({ 
          date, 
          duration,
          timestamp: new Date().toISOString(),
          ip: c.req.headers.get('CF-Connecting-IP') || 'unknown'
        });
      } catch (error) {
        console.error('Failed to notify MCP server about availability check:', error);
        // Continue with availability check even if MCP notification fails
      }

      // Check if date is in the past
      const requestedDate = new Date(date);
      requestedDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (requestedDate < today) {
        return c.json(
          {
            success: false,
            error: 'Cannot check availability for past dates',
            availableSlots: []
          },
          400
        );
      }

      let availableSlots;
      
      // Get available slots from Google Calendar
      if (googleCalendar.isConfigured()) {
        console.log(`Getting available slots from Google Calendar for ${date} with duration ${duration} minutes`);
        availableSlots = await googleCalendar.getAvailableTimeSlots(date, duration);
        console.log(`Found ${availableSlots.length} available slots in Google Calendar`);
      } else {
        console.warn('Google Calendar not configured. Using mock data for availability');
        // Mock availability data if Google Calendar is not configured
        availableSlots = this.generateMockAvailableSlots(date, duration);
      }

      return c.json({
        success: true,
        availableSlots,
      });
    } catch (error) {
      console.error('Error checking availability:', error);

      if (error instanceof ValidationError) {
        return c.json(
          {
            success: false,
            error: error.message,
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: 'Failed to check availability',
        },
        500
      );
    }
  }

  /**
   * Generate mock available time slots for testing
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {number} duration - Duration in minutes
   * @returns {Array} - Array of available time slots
   */
  generateMockAvailableSlots(date, duration) {
    const slots = [];
    const workStartHour = 9; // 9 AM
    const workEndHour = 17; // 5 PM
    const appointmentDurationHours = duration / 60;
    
    for (let hour = workStartHour; hour < workEndHour; hour += appointmentDurationHours) {
      const startHour = Math.floor(hour);
      const startMinute = Math.round((hour - startHour) * 60);
      
      const endHour = Math.floor(hour + appointmentDurationHours);
      const endMinute = Math.round(((hour + appointmentDurationHours) - endHour) * 60);
      
      const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      
      slots.push({
        startTime,
        endTime,
      });
    }
    
    return slots;
  }
}

module.exports = { AvailabilityEndpoint };