/**
 * Main Worker entry point
 * Configures and initializes the booking system
 */
const { fromHono } = require('chanfana');
const { Hono } = require('hono');
const { html } = require('hono/html');
const { AvailabilityEndpoint } = require('./endpoints/booking/availability');
const { BookingEndpoint } = require('./endpoints/booking/book');

/**
 * Get HTML content for booking page
 * @returns {Promise<string>} HTML content
 */
async function getBookingHtml() {
  try {
    // In Cloudflare Workers, you would typically serve static files from KV
    // For local development, fetch it from the repository
    const response = await fetch('https://raw.githubusercontent.com/Konstrex/booking-system-fixed/main/booking.html');
    if (!response.ok) {
      throw new Error(`Failed to fetch booking.html: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error loading booking HTML:', error);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking System - Error</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
          .error { background-color: #fee; border: 1px solid #f99; padding: 1rem; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Error Loading Booking System</h1>
        <div class="error">
          <p>The booking system encountered an error while loading. Please try again later.</p>
          <p>Error: ${error.message}</p>
        </div>
      </body>
      </html>
    `;
  }
}

// Create a Hono app
const app = new Hono();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: '/api-docs',
  title: 'Booking API',
  description: 'API for booking appointments with Google Calendar integration',
  version: '1.0.0',
});

// Register booking API endpoints
openapi.post('/api/availability', AvailabilityEndpoint);
openapi.post('/api/book', BookingEndpoint);

// Serve booking.html at the root endpoint
app.get('/', async (c) => {
  const bookingHtml = await getBookingHtml();
  return c.html(bookingHtml);
});

// Serve booking.html at the /booking endpoint as well
app.get('/booking', async (c) => {
  const bookingHtml = await getBookingHtml();
  return c.html(bookingHtml);
});

// Health check endpoint
app.get('/health-check', (c) => {
  const isProduction = c.env.NODE_ENV === 'production';
  
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    version: '1.0.0',
    services: {
      mcp: c.env.MCP_ENABLED === 'true',
      googleCalendar: !!c.env.GOOGLE_CALENDAR_ID,
      email: !!c.env.EMAIL_FROM
    }
  });
});

// Add CORS headers for API endpoints
app.use('/api/*', async (c, next) => {
  // Allow requests from the website domain
  const allowedOrigins = ['https://andrianadelcheva.com', 'https://www.andrianadelcheva.com'];
  const origin = c.req.headers.get('Origin');
  
  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  } else {
    // In development or for testing, allow all origins
    c.header('Access-Control-Allow-Origin', '*');
  }
  
  // Set other CORS headers
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '86400');
  
  // Handle OPTIONS requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  
  await next();
});

// Error handling
app.onError((err, c) => {
  console.error('Global error handler:', err);
  
  return c.json({
    success: false,
    error: 'An unexpected error occurred',
    message: err.message
  }, 500);
});

// Export the Hono app
module.exports = app;