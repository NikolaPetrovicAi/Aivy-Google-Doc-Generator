// google/gmail.js
const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const { oauth2Client } = require("./auth");

// ✉️ 1. Čitanje poslednjih mejlova
router.get("/list", async (req, res) => {
  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const messages = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    });

    const emails = [];

    for (const msg of messages.data.messages || []) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });

      const headers = detail.data.payload.headers;
      const subject = headers.find(h => h.name === "Subject")?.value || "(bez naslova)";
      const from = headers.find(h => h.name === "From")?.value || "(nepoznat pošiljalac)";
      const date = headers.find(h => h.name === "Date")?.value || "";

      emails.push({ id: msg.id, subject, from, date });
    }

    res.json({ status: "ok", emails });
  } catch (err) {
    console.error("❌ Greška pri čitanju mejlova:", err.response?.data || err.message);
    res.status(500).send("Nisam uspeo da pročitam mejlove.");
  }
});

// 🔍 2. Pretraga mejlova sa detaljima
router.get("/find", async (req, res) => {
  const query = req.query.q || "";
  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 10,
    });

    const results = [];

    // ako ima mejlova, za svaki uzmi detalje
    for (const msg of response.data.messages || []) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });

      const headers = detail.data.payload.headers;
      const subject = headers.find(h => h.name === "Subject")?.value || "(bez naslova)";
      const from = headers.find(h => h.name === "From")?.value || "(nepoznat pošiljalac)";
      const date = headers.find(h => h.name === "Date")?.value || "";
      const snippet = detail.data.snippet || "";

      results.push({ id: msg.id, subject, from, date, snippet });
    }

    res.json({ status: "ok", results });
  } catch (err) {
    console.error("❌ Greška pri pretrazi mejlova:", err.response?.data || err.message);
    res.status(500).send("Nisam uspeo da pretražim mejlove.");
  }
});


// 📤 3. Slanje mejla
router.post("/send", async (req, res) => {
  const { to, subject, text } = req.body;
  if (!to || !subject || !text)
    return res.status(400).json({ error: "Nedostaje 'to', 'subject' ili 'text'." });

  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const messageParts = [
      `To: ${to}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${subject}`,
      "",
      text,
    ];
    const message = messageParts.join("\n");
    const encodedMessage = Buffer.from(message).toString("base64");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    res.json({ status: "ok", message: "Mejl uspešno poslat!" });
  } catch (err) {
    console.error("❌ Greška pri slanju mejla:", err.response?.data || err.message);
    res.status(500).send("Nisam uspeo da pošaljem mejl.");
  }
});

module.exports = router;
