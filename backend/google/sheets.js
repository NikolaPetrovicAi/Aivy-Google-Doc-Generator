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

/**
 * Kreira novi Google Spreadsheet i vraća njegov ID.
 * @param {string} title Naslov novog spreadsheet-a.
 * @returns {Promise<string|null>} ID kreiranog spreadsheet-a ili null u slučaju greške.
 */
async function createSpreadsheet(title) {
  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const fileMetadata = {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
    };
    const file = await drive.files.create({
      resource: fileMetadata,
      fields: "id",
    });
    console.log(` kreiran novi Sheet sa naslovom '${title}' i ID-jem: ${file.data.id}`);
    return file.data.id;
  } catch (err) {
    console.error(`Greška pri kreiranju novog Sheeta pod nazivom ${title}:`, err);
    return null;
  }
}

/**
 * Upisuje podatke u specifični range u Google Sheet-u.
 * @param {string} spreadsheetId ID spreadsheet-a.
 * @param {string} range Range u A1 notaciji (npr. "Sheet1!A1").
 * @param {Array<Array<any>>} values Niz nizova koji predstavlja redove za upis.
 * @returns {Promise<object|null>} Rezultat operacije ili null u slučaju greške.
 */
async function writeData(spreadsheetId, range, values) {
  try {
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    console.log(`Uspešno upisani podaci u Sheet ${spreadsheetId} u opsegu ${range}.`);
    return response.data;
  } catch (err) {
    console.error(`Greška pri upisu podataka u Sheet ${spreadsheetId}:`, err);
    return null;
  }
}

async function getSheetInfo(spreadsheetId) {
    try {
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });
        const response = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
        return response.data.sheets.map(s => ({
            sheetId: s.properties.sheetId,
            title: s.properties.title
        }));
    } catch (err) {
        console.error(`Greška pri dobavljanju info za Sheet ${spreadsheetId}:`, err);
        return [];
    }
}


async function addChart(spreadsheetId, sheetId, chartType, numRows, numCols, chartTitle) {
    try {
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });
        
        const requests = [{
            addChart: {
                chart: {
                    spec: {
                        title: chartTitle,
                        basicChart: {
                            chartType: chartType, // "BAR", "PIE", etc.
                            legendPosition: "BOTTOM_LEGEND",
                            domains: [{
                                domain: {
                                    sourceRange: {
                                        sources: [{
                                            sheetId: sheetId,
                                            startRowIndex: 0,
                                            endRowIndex: numRows,
                                            startColumnIndex: 0,
                                            endColumnIndex: 1
                                        }]
                                    }
                                }
                            }],
                            series: [{
                                series: {
                                    sourceRange: {
                                        sources: [{
                                            sheetId: sheetId,
                                            startRowIndex: 0,
                                            endRowIndex: numRows,
                                            startColumnIndex: 1,
                                            endColumnIndex: numCols
                                        }]
                                    }
                                }
                            }]
                        }
                    },
                    position: {
                        overlayPosition: {
                            anchorCell: {
                                sheetId: sheetId,
                                rowIndex: 0,
                                columnIndex: 4 // Column E
                            }
                        }
                    }
                }
            }
        }];

        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });
        
        const chartId = response.data.replies[0].addChart.chart.chartId;
        console.log(`Uspešno dodat grafikon sa ID-jem ${chartId} u Sheet ${spreadsheetId}`);
        return chartId;

    } catch (err) {
        console.error(`Greška pri dodavanju grafikona u Sheet ${spreadsheetId}:`, err);
        if (err.errors) {
            console.error("Detalji greške:", JSON.stringify(err.errors, null, 2));
        }
        return null;
    }
}

module.exports = {
    sheetsRouter: router,
    createSpreadsheet,
    writeData,
    getSheetInfo,
    addChart
};
