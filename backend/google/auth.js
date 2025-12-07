// google/auth.js
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const TOKEN_PATH = path.join(__dirname, "tokens.json");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 🧠 Token menadžment
let tokens = null;

// 🟢 1. Učitaj token ako postoji
if (fs.existsSync(TOKEN_PATH)) {
  try {
    const storedTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    tokens = storedTokens;
    oauth2Client.setCredentials(tokens);
    console.log("✅ Tokens učitani iz tokens.json — korisnik je već prijavljen.");
  } catch (err) {
    console.error("⚠️ Greška pri učitavanju tokens.json:", err);
  }
}

// 🟡 2. Sačuvaj token posle prijave
function saveTokens(newTokens) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(newTokens, null, 2), "utf8");
    console.log("💾 Tokens sačuvani u:", TOKEN_PATH);
  } catch (err) {
    console.error("❌ Greška pri čuvanju tokena:", err);
  }
}

// 🔵 3. Postavi nove tokene (kad se korisnik prvi put prijavi)
function setTokens(newTokens) {
  tokens = newTokens;
  oauth2Client.setCredentials(tokens);
  saveTokens(newTokens);
  console.log("✅ Tokens uspešno postavljeni i sačuvani.");
}

// 🔘 4. Provera da li smo prijavljeni
function isAuthorized() {
  return !!tokens;
}

module.exports = { oauth2Client, setTokens, isAuthorized };
