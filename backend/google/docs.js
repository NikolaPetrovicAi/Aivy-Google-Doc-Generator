// google/docs.js
const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const { requireAuth } = require("../middleware/auth");

// ========== AI INTEGRATION ==========
const OpenAI = require("openai");

const { generatePlan } = require("./aiPlanner");
const { generatePage } = require("./aiWriter");
const { markdownToGoogleDocsRequests } = require("./markdownTranslator.js");
const { googleDocsToHtml } = require("./formatConverter.js");
const { htmlToGoogleDocsRequests } = require("./htmlToGoogleDocsRequests.js");
const { updateGoogleDocContent } = require("./docActions.js");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function createGoogleDoc(authClient, title) {
    const drive = google.drive({ version: "v3", auth: authClient });
    const fileMetadata = {
      name: title || "Novi dokument",
      mimeType: "application/vnd.google-apps.document"
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      fields: "id, name"
    });

    return file.data;
}

// 📄 1️⃣ Kreiranje novog Google Docs dokumenta
router.post("/create", requireAuth, async (req, res) => {
  const { title } = req.body;
  try {
    const newDoc = await createGoogleDoc(req.oauth2Client, title);
    res.json({
      status: "ok",
      message: `Novi dokument "${newDoc.name}" kreiran.`, 
      documentId: newDoc.id
    });
  } catch (err) {
    console.error("❌ Greška pri kreiranju dokumenta:", err);
    res.status(500).send("Nisam uspeo da napravim dokument.");
  }
});

// ✏️ 2️⃣ Upisivanje teksta u postojeći Docs dokument
router.post("/write", requireAuth, async (req, res) => {
  const { documentId, text } = req.body;

  if (!documentId || !text) {
    return res.status(400).json({ error: "Nedostaje 'documentId' ili 'text'." });
  }

  try {
    const docs = google.docs({ version: "v1", auth: req.oauth2Client });
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 }, // posle naslovnog dela
              text: text
            }
          }
        ]
      }
    });

    res.json({ status: "ok", message: "Tekst uspešno upisan u dokument." });
  } catch (err) {
    console.error("❌ Greška pri upisu u Docs:", err);
    res.status(500).send("Nisam uspeo da upišem tekst u dokument.");
  }
});

// 📖 3️⃣ Čitanje sadržaja iz Google Docs dokumenta
router.get("/read", requireAuth, async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Nedostaje 'id' dokumenta." });
  }

  try {
    const docs = google.docs({ version: "v1", auth: req.oauth2Client });
    const response = await docs.documents.get({ documentId: id });

    const text = response.data.body.content
      .map(el => el.paragraph?.elements?.map(e => e.textRun?.content || "").join("") || "")
      .join("");

    res.json({
      status: "ok",
      documentTitle: response.data.title,
      content: text.trim()
    });
  } catch (err) {
    console.error("❌ Greška pri čitanju dokumenta:", err);
    res.status(500).send("Nisam uspeo da pročitam dokument.");
  }
});

// 📖 4️⃣ Read and convert a Google Doc to HTML for the editor
router.get("/doc/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Document ID is required." });
  }

  try {
    const docs = google.docs({ version: "v1", auth: req.oauth2Client });
    const response = await docs.documents.get({ documentId: id });

    if (!response.data || !response.data.body || !response.data.body.content) {
      return res.status(404).json({ error: "Document content not found." });
    }

    const htmlContent = googleDocsToHtml(response.data.body.content);

    res.json({
      title: response.data.title,
      htmlContent: htmlContent,
    });
  } catch (err) {
    console.error(`❌ Error reading and converting document ${id}:`, err);
    res.status(500).send("Failed to read or convert document.");
  }
});

router.post("/save-document/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { htmlContent, title } = req.body;

  if (!id || !htmlContent) {
    return res.status(400).json({ error: "Document ID and HTML content are required." });
  }

  try {
    await updateGoogleDocContent(req.oauth2Client, id, htmlContent, title);
    res.json({ status: "ok", message: "Document saved successfully." });
  } catch (err) {
    console.error("❌ Greška pri čuvanju dokumenta:", err);
    const message = err.errors?.[0]?.message || err.message || "An unknown error occurred on the backend.";
    res.status(500).json({ message });
  }
});


// ========================== 
// 📄 AI DOCUMENT GENERATOR (No Auth Needed)
// ========================== 
router.post("/generate-doc", async (req, res) => {
  // This route does not interact with Google APIs, so it doesn't need authentication.
  try {
    // ... (AI logic remains unchanged)
  } catch (err) {
    console.error("❌ Error in /generate-doc:", err);
    res.status(500).json({ error: "Failed to generate document" });
  }
});

// ... other AI routes also remain unchanged ...

async function createGoogleDocFromPlan(authClient, plan, formData) {
  const { topic, tone, language } = formData;
  const docs = google.docs({ version: "v1", auth: authClient });
  const drive = google.drive({ version: "v3", auth: authClient });

  // 1. Create the document
  console.log(`Creating document with title: ${topic}`);
  const fileMetadata = {
    name: topic || "Novi AI Dokument",
    mimeType: "application/vnd.google-apps.document",
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    fields: "id",
  });
  const documentId = file.data.id;
  console.log(`✅ Document created with ID: ${documentId}`);

  // 2. Generate content and requests for all pages
  let allRequests = [];
  let currentIndex = 1;

  for (const page of plan) {
    console.log(`📝 Generišem stranu ${page.page}: ${page.title}`);
    const pageContent = await generatePage({
      page: page.page,
      title: page.title,
      summary: page.summary,
      elements: page.elements,
      tone: tone,
      language: language,
    });
    
    // Translate markdown to Google Docs requests
    const { requests, endIndex } = markdownToGoogleDocsRequests(pageContent, currentIndex);
    if (requests.length > 0) {
      allRequests.push(...requests);
      currentIndex = endIndex;
    }
  }

  console.log("✍️ Writing content to Google Doc...");
  // 3. Write the full content to the document
  if (allRequests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: allRequests,
      },
    });
  }

  console.log("✅ Content written successfully.");
  return documentId;
}


module.exports = { router, createGoogleDocFromPlan, updateGoogleDocContent, createGoogleDoc };
