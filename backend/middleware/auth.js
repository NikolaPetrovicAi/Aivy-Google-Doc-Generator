const { google } = require("googleapis");

/**
 * Middleware to protect routes that require Google authentication.
 * It checks for tokens in the user's session and creates a user-specific
 * OAuth2 client for the request.
 */
const requireAuth = (req, res, next) => {
  if (!req.session.tokens) {
    // If the user is not logged in, send an unauthorized error
    return res.status(401).json({ error: "User not authenticated. Please log in." });
  }

  // Create a new OAuth2 client for this specific request
  const userClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  // Set the credentials from the user's session
  userClient.setCredentials(req.session.tokens);
  
  // Attach the user-specific client to the request object
  req.oauth2Client = userClient;
  
  next();
};

module.exports = { requireAuth };
