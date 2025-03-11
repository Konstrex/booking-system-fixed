/**
 * Booking Endpoint
 * Handles creating bookings, checking availability, creating Google Calendar events, and sending confirmation emails
 */
const { OpenAPIRoute, ValidationError } = require('chanfana');
const { z } = require('zod');
const { MCPIntegration } = require('../../utils/mcp-integration');
const { GoogleCalendarIntegration } = require('../../utils/google-calendar');
const { EmailService } = require('../../utils/email-service');

// Define the Service type
/**
 * @typedef {Object} Service
 * @property {string} name - Service name
 * @property {number} duration - Service duration in minutes
 * @property {number} price - Service price
 */

// Define the BookingData type
/**
 * @typedef {Object} BookingData
 * @property {string} name - Client name
 * @property {string} email - Client email
 * @property {string} phone - Client phone
 * @property {string} date - Booking date (YYYY-MM-DD)
 * @property {string} time - Booking time (HH:MM)
 * @property {Service[]} services - Array of services
 * @property {string} [notes] - Optional booking notes
 * @property {string} [eventId] - Google Calendar event ID (set after creation)
 * @property {boolean} [agreed] - Whether client agreed to terms
 */

class BookingEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Booking'],
    summary: 'Create a new booking',
    description: 'Creates a new booking, checks availability, creates a Google Calendar event, and sends confirmation emails',
    requestBody: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(2, 'Name is required'),
            email: z.string().email('Valid email is required'),
            phone: z.string().min(5, 'Phone number is required'),
            date: z.string().refine((val) => /^\\d{4}-\\d{2}-\\d{2}$/.test(val), {
              message: 'Date must be in YYYY-MM-DD format',
            }),
            time: z.string().refine((val) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
              message: 'Time must be in HH:MM format',
            }),
            services: z.array(z.string()).min(1, 'At least one service must be selected'),
            notes: z.string().optional(),
            agreed: z.boolean().refine((val) => val === true, {
              message: 'You must agree to the terms',
            }),
          }),
        },
      },
    },
    responses: {
      '200': {
        description: 'Booking created successfully',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              bookingId: z.string().optional(),
              eventId: z.string().optional(),
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
      '409': {
        description: 'Conflict - Time slot is already booked',
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
      console.log('Booking request received');
      
      // Initialize integrations
      const mcpIntegration = new MCPIntegration(c.env);
      const googleCalendar = new GoogleCalendarIntegration(c.env);
      const emailService = new EmailService(c.env);
      
      // Log initialization status
      console.log(`MCP Integration initialized: ${mcpIntegration.isConfigured()}`);
      console.log(`Google Calendar Integration initialized: ${googleCalendar.isConfigured()}`);
      console.log(`Email Service initialized: ${emailService.isConfigured()}`);

      // Extract validated data from request
      const validatedData = c.req.valid('json');
      
      // Get default services from environment
      const defaultServices = this.getDefaultServices(c.env);
      
      // Map service names to full service objects
      const serviceObjects = validatedData.services.map(serviceName => {
        const service = defaultServices.find(s => s.name === serviceName);
        if (!service) {
          throw new Error(`Service "${serviceName}" not found`);
        }
        return service;
      });
      
      // Create booking data object with proper structure
      /** @type {BookingData} */
      const bookingData = {
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        date: validatedData.date,
        time: validatedData.time,
        services: serviceObjects,
        notes: validatedData.notes,
        agreed: validatedData.agreed
      };

      // Check if the requested time slot is available
      if (googleCalendar.isConfigured()) {
        // Calculate total duration from all services
        const totalDuration = bookingData.services.reduce((total, service) => total + service.duration, 0);
        
        // Check availability in Google Calendar
        console.log(`Checking availability for ${bookingData.date} at ${bookingData.time} for ${totalDuration} minutes`);
        const isAvailable = await googleCalendar.checkAvailability(bookingData.date, bookingData.time, totalDuration);
        
        if (!isAvailable) {
          // Notify MCP about unavailable slot
          try {
            await mcpIntegration.notifyBookingError({
              error: 'Time slot not available',
              bookingData,
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            console.error('Failed to notify MCP about unavailable time slot:', err);
          }
          
          return c.json(
            {
              success: false,
              error: 'The selected time slot is not available. Please choose another time.',
            },
            409
          );
        }
      } else {
        console.warn('Google Calendar not configured. Skipping availability check.');
      }

      // Process the booking - try MCP integrated approach first
      if (mcpIntegration.isConfigured()) {
        try {
          console.log('Processing booking through MCP integration');
          // Add calendar ID to booking data for MCP processing
          const bookingForMcp = {
            ...bookingData,
            calendarId: c.env.GOOGLE_CALENDAR_ID
          };
          
          const mcpResult = await mcpIntegration.processBooking(bookingForMcp);
          
          if (mcpResult.success) {
            // MCP successfully processed the booking
            console.log('Booking successfully processed by MCP:', mcpResult);
            
            return c.json({
              success: true,
              message: 'Booking created successfully',
              bookingId: this.generateBookingId(bookingData),
              eventId: mcpResult.eventId
            });
          } else {
            console.warn('MCP booking processing failed, falling back to direct processing:', mcpResult.message);
            // Fall through to direct booking processing
          }
        } catch (error) {
          console.error('Error processing booking through MCP:', error);
          // Fall through to direct booking processing
        }
      }

      // Fallback to direct booking if MCP processing failed or not configured
      console.log('Processing booking directly');
      
      // Unique booking ID for reference
      const bookingId = this.generateBookingId(bookingData);
      
      // Create calendar event
      let calendarResult = { success: false, eventId: null, eventLink: null };
      try {
        if (googleCalendar.isConfigured()) {
          console.log('Creating Google Calendar event');
          calendarResult = await googleCalendar.createEvent(bookingData);
          
          if (calendarResult.success) {
            console.log('Google Calendar event created:', calendarResult.eventId);
            // Add event ID to booking data
            bookingData.eventId = calendarResult.eventId;
            
            // Notify MCP about calendar event creation
            try {
              await mcpIntegration.notifyCalendarEventCreated({
                eventId: calendarResult.eventId,
                date: bookingData.date,
                time: bookingData.time,
                clientName: bookingData.name,
                services: bookingData.services.map(s => s.name).join(', ')
              });
            } catch (err) {
              console.error('Failed to notify MCP about calendar event creation:', err);
            }
          } else {
            console.error('Failed to create Google Calendar event');
          }
        } else {
          console.warn('Google Calendar not configured. Skipping event creation.');
        }
      } catch (error) {
        console.error('Error creating Google Calendar event:', error);
        // Continue with booking process even if calendar event creation fails
      }

      // Notify MCP server about booking creation
      try {
        await mcpIntegration.notifyBookingCreated({
          ...bookingData,
          bookingId,
          eventId: bookingData.eventId,
          timestamp: new Date().toISOString(),
          ip: c.req.headers.get('CF-Connecting-IP') || 'unknown'
        });
      } catch (error) {
        console.error('Failed to notify MCP server about booking creation:', error);
        // Continue with booking process even if MCP notification fails
      }

      // Send confirmation email
      try {
        if (emailService.isConfigured()) {
          console.log('Sending booking confirmation email');
          await emailService.sendBookingConfirmation(bookingData, calendarResult.eventLink);
        } else {
          console.warn('Email service not configured. Skipping confirmation email.');
        }
      } catch (error) {
        console.error('Failed to send confirmation email:', error);
        // Continue and return success even if email sending fails
      }

      return c.json({
        success: true,
        message: 'Booking created successfully',
        bookingId,
        eventId: bookingData.eventId
      });
    } catch (error) {
      console.error('Error creating booking:', error);

      // Notify MCP about the error
      try {
        const mcpIntegration = new MCPIntegration(c.env);
        await mcpIntegration.notifyBookingError({
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to notify MCP about booking error:', err);
      }

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
          error: 'Failed to create booking. Please try again later.',
        },
        500
      );
    }
  }

  /**
   * Generate a unique booking ID
   * @param {BookingData} bookingData - Booking data
   * @returns {string} - Unique booking ID
   */
  generateBookingId(bookingData) {
    // Create a unique booking ID based on customer name and timestamp
    const timestamp = Date.now();
    const namePart = bookingData.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
    return `BK-${namePart}-${timestamp.toString().substring(timestamp.toString().length - 6)}`;
  }

  /**
   * Get default services from environment or return hardcoded defaults
   * @param {Object} env - Environment variables
   * @returns {Service[]} - Array of default services
   */
  getDefaultServices(env) {
    try {
      // Try to get services from environment
      if (env.DEFAULT_SERVICES) {
        const parsedServices = JSON.parse(env.DEFAULT_SERVICES);
        if (Array.isArray(parsedServices) && parsedServices.length > 0) {
          return parsedServices;
        }
      }
    } catch (error) {
      console.error('Error parsing DEFAULT_SERVICES:', error);
    }
    
    // Fallback to hardcoded defaults
    return [
      {
        name: 'Massage',
        duration: 60,
        price: 80
      },
      {
        name: 'Gesichtsbehandlung',
        duration: 45,
        price: 65
      },
      {
        name: 'Maniküre',
        duration: 30,
        price: 40
      }
    ];
  }
}

module.exports = { BookingEndpoint };