// google/auth.js
const { google } = require("googleapis");

/**
 * This is the base OAuth2 client configuration.
 * It is used as a template for creating user-specific clients after they log in.
 * Credentials (tokens) are NOT set on this global client. Instead, they are
 * applied on a per-request basis in the `requireAuth` middleware.
 */
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

module.exports = { oauth2Client };

