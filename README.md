# Booking System (Fixed)

This repository contains the fixed version of the booking system for Andriana Delcheva, addressing several critical issues with the previous implementation. The system is designed to run on Cloudflare Workers and integrates with Google Calendar and MCP Servers.

## 🛠️ Fixed Issues

This implementation resolves the following issues that were present in the original system:

1. **Fixed Booking Completion** - Users can now successfully select a date and complete bookings.
2. **Fixed Confirmation Emails** - Email confirmations are now sent after successful bookings.
3. **Fixed Google Calendar Integration** - Bookings now create events in Google Calendar.
4. **Implemented Availability Checking** - The system checks for available slots before confirming bookings.
5. **Implemented MCP Server Integration** - Backend processing uses MCP Servers for enhanced functionality.

## 🌟 Key Features

- **Multi-step Booking Process** - Intuitive step-by-step booking flow for better UX
- **Real-time Availability Checking** - Checks Google Calendar for conflicts
- **Automated Email Confirmations** - Sends details to the customer
- **Google Calendar Integration** - Creates calendar events with service details
- **MCP Server Integration** - Tracks booking events and provides enhanced processing
- **Comprehensive Error Handling** - Provides meaningful feedback to users
- **Responsive Design** - Works on mobile and desktop devices

## 🚀 Deployment

### Prerequisites

- Cloudflare Workers account
- Google Cloud project with Calendar API enabled
- Google service account with access to the Calendar
- MCP Server for backend processing

### Setup Instructions

1. **Clone the repository**

```bash
git clone https://github.com/Konstrex/booking-system-fixed.git
cd booking-system-fixed
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

The following environment variables need to be set either in the wrangler.toml file or using Cloudflare's secrets:

- **Google Calendar Integration**
  - `GOOGLE_CLIENT_EMAIL` - Already configured to "andrianadelcheva@totemic-point-453101-s4.iam.gserviceaccount.com"
  - `GOOGLE_PRIVATE_KEY` - Your service account private key 
  - `GOOGLE_CALENDAR_ID` - The ID of the calendar to use

- **Email Configuration**
  - `EMAIL_FROM` - Email address to send confirmations from
  - `BUSINESS_NAME` - Name of the business (already set to "Andriana Delcheva")
  - `BUSINESS_EMAIL` - Business email for reply-to

- **MCP Server Integration**
  - `MCP_ENABLED` - Set to "true" to enable MCP integration
  - `MCP_SERVER_URL` - URL of the MCP server
  - `MCP_API_KEY` - API key for authenticating with the MCP server

4. **Set secrets using Wrangler**

For sensitive information, use Wrangler's secret management:

```bash
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put GOOGLE_CALENDAR_ID
wrangler secret put MCP_SERVER_URL
wrangler secret put MCP_API_KEY
```

5. **Deploy to Cloudflare Workers**

```bash
npm run deploy:prod
```

## 📝 Google Calendar Setup

To ensure the Google Calendar integration works properly:

1. Ensure the service account has appropriate permissions by adding it to your Google Calendar:
   - Open Google Calendar
   - Go to Calendar Settings
   - Under "Share with specific people," add the service account email:
     `andrianadelcheva@totemic-point-453101-s4.iam.gserviceaccount.com`
   - Set permissions to "Make changes and manage sharing"

2. The JWT authentication is configured to use the correct token_uri:
   `https://oauth2.googleapis.com/token`

## 📧 Email Configuration

The system uses MCP Servers for handling email notifications. After a successful booking, an email is sent containing:
- Subject: "Booking Confirmation"
- Appointment details (date, time, service)
- Google Calendar link
- Booking reference number

## 🤖 MCP Server Integration

MCP Servers are used for enhanced functionality:

1. **Event Notifications** - MCP is notified about key events:
   - Availability checks
   - Booking creations
   - Email confirmations
   - Calendar event creations

2. **Error Handling** - MCP receives detailed error information for monitoring and debugging.

3. **Booking Processing** - The system can offload the entire booking process to MCP if configured.

## 🧪 Testing

To test the system locally:

```bash
npm run dev:local
```

For end-to-end testing:

1. Select a date and service
2. Check available time slots
3. Enter customer details
4. Complete the booking
5. Verify the appointment appears in Google Calendar
6. Confirm the confirmation email is received

## 📚 Technical Implementation Details

### Fixed Booking Flow

The booking flow has been completely reworked to ensure a single API request is made when booking. Key improvements:

- Multi-step form with validation at each step
- Single API call for the final booking request
- Clear error messages for failed bookings
- Loading indicators during API calls

### Fixed Google Calendar Integration

The Google Calendar integration now:

1. Uses proper JWT authentication with the service account
2. Checks for existing events before booking
3. Creates detailed calendar events with all booking information
4. Properly formats dates and times
5. Includes attendees and reminders

### Enhanced Error Handling

Comprehensive error handling has been implemented:

- Validation errors with specific messages
- Network error handling with retry options
- Server error logging with MCP integration
- User-friendly error messages

## 📋 API Endpoints

### Check Availability

```
POST /api/availability
```

Request body:
```json
{
  "date": "2025-03-15",
  "duration": 60
}
```

Response:
```json
{
  "success": true,
  "availableSlots": [
    { "startTime": "09:00", "endTime": "10:00" },
    { "startTime": "10:00", "endTime": "11:00" },
    /* ... */
  ]
}
```

### Book Appointment

```
POST /api/book
```

Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "date": "2025-03-15",
  "time": "10:00",
  "services": [
    {
      "name": "Massage",
      "duration": 60,
      "price": 80
    }
  ],
  "notes": "Optional notes",
  "agreed": true
}
```

Response:
```json
{
  "success": true,
  "message": "Booking created successfully",
  "bookingId": "BK-JOHNDO-123456",
  "eventId": "calendar_event_id"
}
```

## 🔄 Continuous Improvement

Future improvements could include:

- Adding a dashboard for managing bookings
- Implementing booking cancellation/rescheduling
- Adding payment integration
- Creating a customer account system