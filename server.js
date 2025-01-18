const express = require('express'); // Import Express for server setup
const axios = require('axios'); // Import Axios for HTTP requests
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Import cookie-parser for cookie handling
const { v4: uuidv4 } = require('uuid'); // Import UUID for generating unique IDs

const app = express();

// Configure CORS to allow credentials and dynamically handle origins
const allowedOrigins = ['https://jobs.autoankauf-ffb.de']; // Add allowed frontend origins here

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies to be sent
  })
);

app.use(express.json()); // Middleware to parse JSON request bodies
app.use(cookieParser()); // Middleware to parse cookies

// Middleware to ensure each user has a persistent userID
app.use((req, res, next) => {
  if (!req.cookies.userID) {
    // Generate a new unique ID for the user
    const userID = uuidv4();

    // Set the cookie with a 1-year expiration
    res.cookie('userID', userID, {
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year in milliseconds
      httpOnly: true, // Prevent JavaScript access
      secure: true, // Only send over HTTPS
      sameSite: 'Lax', // CSRF protection
    });

    console.log(`New user assigned ID: ${userID}`);
  } else {
    console.log(`Returning user with ID: ${req.cookies.userID}`);
  }
  next();
});

// Endpoint to receive data from GTM
app.post('/zapier-proxy', function (req, res) {
  console.log('Received data:', req.body); // Log the incoming data for debugging
  console.log('Incoming Cookies:', req.cookies); // Log cookies for debugging

  // Validate the payload
  if (!req.body || Object.keys(req.body).length === 0) {
    console.error('No data received in request.');
    return res.status(400).send({ error: 'No data received' });
  }

  // Include the userID in the forwarded payload
  const userID = req.cookies.userID || 'unknown_user';
  const payload = {
    ...req.body,
    userID, // Add the persistent userID from the cookie
  };

  console.log('Forwarding payload to Zapier:', payload); // Log the full payload being sent to Zapier

  // Forward the request to Zapier
  const zapierWebhookURL = 'https://hooks.zapier.com/hooks/catch/21124783/2zyegir/';
  axios
    .post(zapierWebhookURL, payload, {
      headers: { 'Content-Type': 'application/json' }, // Include content type
    })
    .then(function (zapierResponse) {
      console.log('Zapier Response:', zapierResponse.data); // Log Zapier's response
      res.status(zapierResponse.status).send(zapierResponse.data); // Forward Zapier's response back
    })
    .catch(function (error) {
      console.error('Error forwarding to Zapier:', error.message);

      // Handle and log the error response from Zapier if available
      if (error.response) {
        console.error('Zapier Response Error:', error.response.data);
      }

      res.status(error.response ? error.response.status : 500).send({
        message: 'Error occurred while forwarding data.',
        error: error.message,
      });
    });
});

// Health check endpoint for server
app.get('/', function (req, res) {
  console.log('Incoming Cookies:', req.cookies); // Log cookies for debugging
  res.send('Server is running!');
});

// Start the server
const PORT = process.env.PORT || 3000; // Use environment variable or default to 3000
app.listen(PORT, function () {
  console.log('Proxy server running on port ' + PORT);
});
