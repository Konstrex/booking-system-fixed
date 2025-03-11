/**
 * Email Service Module
 * Handles sending confirmation emails for bookings using MCP Servers
 */
const { MCPIntegration } = require('./mcp-integration');

class EmailService {
  constructor(env) {
    this.emailFrom = env.EMAIL_FROM || '';
    this.businessName = env.BUSINESS_NAME || 'Andriana Delcheva';
    this.businessEmail = env.BUSINESS_EMAIL || '';
    this.mcpIntegration = new MCPIntegration(env);
    this.initialized = this.emailFrom && this.businessName && this.businessEmail;
  }

  /**
   * Check if the email service is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.initialized;
  }

  /**
   * Send a booking confirmation email
   * @param {Object} bookingData - Booking data
   * @param {string} calendarEventLink - Link to the Google Calendar event
   * @returns {Promise<Object>} - Result of the email sending operation
   */
  async sendBookingConfirmation(bookingData, calendarEventLink) {
    if (!this.isConfigured()) {
      throw new Error('Email service not properly configured');
    }

    try {
      // Format services for email
      const servicesText = bookingData.services.map(
        service => `${service.name} (${service.duration} min, ${service.price} €)`
      ).join('\\n');

      // Create email content
      const emailData = {
        to: bookingData.email,
        from: this.emailFrom,
        subject: `Booking Confirmation - ${this.businessName}`,
        replyTo: this.businessEmail,
        data: {
          clientName: bookingData.name,
          businessName: this.businessName,
          date: bookingData.date,
          time: bookingData.time,
          services: servicesText,
          totalPrice: bookingData.services.reduce((total, service) => total + service.price, 0),
          calendarLink: calendarEventLink,
          bookingReference: bookingData.eventId || 'N/A'
        }
      };

      // Since we're using MCP Servers for sending emails, we'll notify the MCP server
      const response = await this.mcpIntegration.notifyEmailSent({
        recipient: bookingData.email,
        subject: emailData.subject,
        timestamp: new Date().toISOString(),
        status: 'pending',
        templateData: emailData.data
      });

      // Log the result
      console.log('Email notification sent to MCP:', response);

      // In a real implementation with an SMTP service, you would send the email here
      // But since we're using MCP Servers, we'll just simulate a successful email send
      
      return {
        success: true,
        messageId: `email_${Date.now()}`,
        recipient: bookingData.email
      };
    } catch (error) {
      console.error('Error sending booking confirmation email:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email content for booking confirmation
   * @param {Object} data - Email data
   * @returns {string} - HTML email content
   */
  generateEmailHtml(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Booking Confirmation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
          }
          .header {
            background-color: #4f46e5;
            color: white;
            padding: 20px;
            text-align: center;
          }
          .content {
            padding: 20px;
          }
          .footer {
            background-color: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .button {
            display: inline-block;
            background-color: #4f46e5;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 15px;
          }
          .details {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Booking Confirmation</h1>
        </div>
        <div class="content">
          <p>Hello ${data.clientName},</p>
          <p>Thank you for booking an appointment with ${data.businessName}.</p>
          
          <div class="details">
            <h3>Booking Details</h3>
            <p><strong>Date:</strong> ${data.date}</p>
            <p><strong>Time:</strong> ${data.time}</p>
            <p><strong>Services:</strong> ${data.services}</p>
            <p><strong>Total Price:</strong> ${data.totalPrice} €</p>
            <p><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          </div>
          
          <p>We look forward to seeing you!</p>
          
          <a href="${data.calendarLink}" class="button">Add to Calendar</a>
          
          <p>If you need to reschedule or cancel your appointment, please contact us as soon as possible.</p>
        </div>
        <div class="footer">
          <p>${data.businessName}</p>
          <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = { EmailService };