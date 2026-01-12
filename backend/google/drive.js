// google/drive.js
const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { requireAuth } = require("../middleware/auth");

async function getGoogleDocs(authClient, pageToken) {
  const drive = google.drive({ version: "v3", auth: authClient });
  const result = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.document'",
    pageSize: 20,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, owners/emailAddress, thumbnailLink, hasThumbnail)",
    pageToken: pageToken,
  });

  const cacheDir = path.join(__dirname, "..", "thumbnail_cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }

  const filesWithPreviews = await Promise.all(
    result.data.files.map(async (file) => {
      if (!file.hasThumbnail) {
        return { ...file, preview: "No preview available" };
      }

      const modifiedTime = new Date(file.modifiedTime).getTime();
      const cachedFileName = `${file.id}-${modifiedTime}.jpg`;
      const cachedFilePath = path.join(cacheDir, cachedFileName);
      const localPreviewPath = `http://localhost:8080/thumbnail_cache/${cachedFileName}`;

      if (fs.existsSync(cachedFilePath)) {
        return { ...file, preview: localPreviewPath };
      } else {
        // Important: Use the authenticated client to fetch thumbnails
        const response = await authClient.request({ url: file.thumbnailLink, responseType: 'stream' });
        const writer = fs.createWriteStream(cachedFilePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        return { ...file, preview: localPreviewPath };
      }
    })
  );

  return { files: filesWithPreviews, nextPageToken: result.data.nextPageToken };
}

// All routes in this file now require authentication.
router.use(requireAuth);

// 🔍 1. Lista fajlova
router.get("/list", async (req, res) => {
  try {
    const { pageToken } = req.query;
    const data = await getGoogleDocs(req.oauth2Client, pageToken);
    res.json({ status: "ok", ...data });
  } catch (err) {
    console.error("❌ Greška pri listanju fajlova:", err);
    res.status(500).send("Nisam uspeo da učitam listu fajlova.");
  }
});

// 🔎 2. Pretraga fajlova po imenu
router.get("/find", async (req, res) => {
  const query = req.query.q || "";
  try {
    const drive = google.drive({ version: "v3", auth: req.oauth2Client });
    const response = await drive.files.list({
      q: `name contains '${query}'`,
      fields: "files(id, name, mimeType)"
    });
    res.json({ status: "ok", results: response.data.files });
  } catch (err) {
    console.error("❌ Greška pri pretrazi:", err);
    res.status(500).send("Nisam uspeo da pronađem fajlove.");
  }
});

// 🗑️ 3. Brisanje fajla
router.delete("/delete", async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Nedostaje ID fajla." });

  try {
    const drive = google.drive({ version: "v3", auth: req.oauth2Client });
    await drive.files.delete({ fileId: id });
    res.json({ status: "ok", message: "Fajl uspešno obrisan." });
  } catch (err) {
    console.error("❌ Greška pri brisanju fajla:", err);
    res.status(500).send("Nisam uspeo da obrišem fajl.");
  }
});

// ✏️ 4. Preimenovanje fajla
router.patch("/rename", async (req, res) => {
  const { id, newName } = req.body;
  if (!id || !newName)
    return res.status(400).json({ error: "Nedostaje 'id' ili 'newName'." });

  try {
    const drive = google.drive({ version: "v3", auth: req.oauth2Client });
    const result = await drive.files.update({
      fileId: id,
      requestBody: { name: newName },
      fields: "id, name"
    });
    res.json({
      status: "ok",
      message: `Fajl preimenovan u "${result.data.name}".`
    });
  } catch (err) {
    console.error("❌ Greška pri preimenovanju:", err);
    res.status(500).send("Nisam uspeo da preimenujem fajl.");
  }
});

module.exports = { router, getGoogleDocs };

