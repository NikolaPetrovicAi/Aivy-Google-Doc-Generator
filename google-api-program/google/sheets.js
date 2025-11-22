// google/sheets.js
const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const { oauth2Client } = require("./auth");

// 🔍 Pretraga Sheets fajlova
router.get("/find", async (req, res) => {
  const query = req.query.q;
  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const response = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${query}'`,
      fields: "files(id, name)"
    });
    res.json(response.data.files);
  } catch (err) {
    console.error("Greška pri pretrazi:", err);
    res.status(500).send("Nisam uspeo da pronađem sheet");
  }
});

// 📖 Čitanje podataka iz Sheeta
router.get("/read", async (req, res) => {
  const spreadsheetId = req.query.id;
  const range = req.query.range || "Sheet1!A1:D10";
  try {
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    res.json(response.data.values);
  } catch (err) {
    console.error("Greška pri čitanju Sheeta:", err);
    res.status(500).send("Nisam uspeo da pročitam podatke iz Sheeta");
  }
});

// 🧾 Info o sheetu (metapodaci)
router.get("/info", async (req, res) => {
  const spreadsheetId = req.query.id;
  try {
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const info = response.data.sheets.map(s => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
      rowCount: s.properties.gridProperties.rowCount,
      columnCount: s.properties.gridProperties.columnCount
    }));
    res.json(info);
  } catch (err) {
    console.error("Greška pri čitanju metapodataka Sheeta:", err);
    res.status(500).send("Nisam uspeo da pročitam informacije o Sheet-u");
  }
});

// ✏️ Upis u Sheet
router.post("/write", async (req, res) => {
  const spreadsheetId = req.body.id;
  const range = req.body.range || "Sheet1!A1";
  const values = req.body.values;
  try {
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values }
    });
    res.json({ status: "upisano", updatedCells: response.data.updatedCells });
  } catch (err) {
    console.error("Greška pri upisu u Sheet:", err);
    res.status(500).send("Nisam uspeo da upišem podatke u Sheet");
  }
});

// 🧩 batchUpdate (boje, merge, chart, itd.)
router.post("/update", async (req, res) => {
  const spreadsheetId = req.body.id;
  const requests = req.body.requests;
  try {
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
    res.json({ status: "ok", details: response.data });
  } catch (err) {
    console.error("❌ Greška u batchUpdate:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
