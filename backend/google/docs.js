// google/docs.js
const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const { oauth2Client } = require("./auth");

// ========== AI INTEGRATION ==========
const OpenAI = require("openai");

const { generatePlan } = require("./aiPlanner"); // ✅ OVO MORA POSTOJATI
const { generatePage } = require("./aiWriter");  // ✅ OVO TAKOĐE
const { markdownToGoogleDocsRequests } = require("./markdownTranslator.js");
const { googleDocsToHtml } = require("./formatConverter.js");
const { createSpreadsheet, writeData, getSheetInfo, addChart } = require("./sheets.js");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// 📄 1️⃣ Kreiranje novog Google Docs dokumenta
router.post("/create", async (req, res) => {
  const { title } = req.body;
  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const fileMetadata = {
      name: title || "Novi dokument",
      mimeType: "application/vnd.google-apps.document"
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      fields: "id, name"
    });

    res.json({
      status: "ok",
      message: `Novi dokument "${file.data.name}" kreiran.`,
      documentId: file.data.id
    });
  } catch (err) {
    console.error("❌ Greška pri kreiranju dokumenta:", err);
    res.status(500).send("Nisam uspeo da napravim dokument.");
  }
});

// ✏️ 2️⃣ Upisivanje teksta u postojeći Docs dokument
router.post("/write", async (req, res) => {
  const { documentId, text } = req.body;

  if (!documentId || !text) {
    return res.status(400).json({ error: "Nedostaje 'documentId' ili 'text'." });
  }

  try {
    const docs = google.docs({ version: "v1", auth: oauth2Client });
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
router.get("/read", async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Nedostaje 'id' dokumenta." });
  }

  try {
    const docs = google.docs({ version: "v1", auth: oauth2Client });
    const response = await docs.documents.get({ documentId: id });

    // Spajamo sav tekst iz dokumenta
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

// 📖 4️⃣ NEW: Read and convert a Google Doc to HTML for the editor
router.get("/doc/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Document ID is required." });
  }

  try {
    const docs = google.docs({ version: "v1", auth: oauth2Client });
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
// ==========================
// 📄 AI DOCUMENT GENERATOR
// ==========================
router.post("/generate-doc", async (req, res) => {
  try {
    const {
      topic,
      docType,
      tone,
      details,
      language,
      sections,
      colors,
      switches,
      elements,
      reference,
      pages,
    } = req.body;

    const systemPrompt = `
Ti si napredni AI generator dokumenata.

Tvoj zadatak je da na osnovu korisničkih parametara kreiraš dokument koji najbolje odgovara traženom tipu, tonu i publici.
Nemaš unapred definisanu strukturu — sam biraš najlogičniji raspored i stil, u skladu sa instrukcijama koje dobijaš.

Korisnik ti šalje sledeće parametre:
- topic: glavna tema dokumenta
- docType: tip dokumenta (izveštaj, esej, plan, ugovor, email, analiza, predlog, itd.)
- tone: ton pisanja (formalan, neformalan, edukativan, inspirativan, itd.)
- details: nivo detalja (od 1 do 10, gde 10 znači izuzetno detaljno)
- language: jezik na kom treba da pišeš
- sections: sekcije koje dokument treba da sadrži (ako ih ima)
- colors: boje koje bi mogle dominirati u vizuelnim elementima (samo kao inspiracija)
- switches: dodatne postavke (npr. automatski naslov, bold ključne reči, itd.)
- elements: spisak elemenata koji treba da budu uključeni (liste, tabele, citati, grafikoni, slike...)
- reference: da li treba uključiti reference ili izvore (true/false)
- pages: koliko približno “strana” dokument treba da ima (možeš proceniti po dužini)

Na osnovu ovih informacija generiši sadržaj koji:
- ima smisla kao celina,
- koristi ton i format prilagođen publici,
- uključuje elemente ako su traženi (npr. ako “elements” sadrži “tabele” — ubaci tabelu),
- ima dužinu primerenu traženom broju stranica,
- i koristi Markdown format (# Naslov, ## Podnaslov, - Liste, | Tabele, > Citat) kako bi ga sistem mogao prikazati u Preview modu.

Ako dokument zahteva više strana, koristi oznaku \`---PAGE BREAK---\` da označiš prelaz između stranica.
`;

    const userPrompt = `
Tema: ${topic}
Tip dokumenta: ${docType}
Ton pisanja: ${tone}
Nivo detalja: ${details}
Jezik: ${language}
Sekcije: ${Array.isArray(sections) ? sections.join(", ") : sections}
Boje: ${JSON.stringify(colors)}
Dodatne postavke: ${JSON.stringify(switches)}
Elementi: ${Array.isArray(elements) ? elements.join(", ") : elements}
Reference uključiti: ${reference ? "da" : "ne"}
Broj željenih stranica: ${pages || 3}

Zadatak: kreiraj smislen, profesionalan dokument koji reflektuje ove parametre.
Formatiraj ga u Markdown stilu (#, ##, -, |, >, itd.), a ako je duži od jedne strane, ubaci \`---PAGE BREAK---\`.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 600,
    });

    const output = completion.choices[0].message.content;
    res.json({ document: output });
  } catch (err) {
    console.error("❌ Error in /generate-doc:", err);
    res.status(500).json({ error: "Failed to generate document" });
  }
});

// PLANER ENDPOINT
router.post("/plan-document", async (req, res) => {
  try {
    console.log("📥 /plan-document pozvan!");
    const { topic, docType, tone, details, language, pages } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Ti si AI planer dokumenata.
Vrati JSON plan sa opisom svake strane:
{
  "plan": [
    { "page": 1, "title": "Naslov", "summary": "Opis", "elements": ["lista","tabela"] },
    ...
  ]
}`
        },
        {
          role: "user",
          content: `Tema: ${topic}
Tip: ${docType}
Ton: ${tone}
Detaljnost: ${details}
Jezik: ${language}
Broj strana: ${pages}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const plan = JSON.parse(completion.choices[0].message.content);
    res.json({ plan });
  } catch (err) {
    console.error("❌ Greška u /plan-document:", err);
    res.status(500).json({ error: "Planiranje nije uspelo." });
  }
});


// PISAC ENDPOINT
router.post("/generate-page", async (req, res) => {
  const { page, title, summary, elements, tone, language } = req.body;
  console.log("✍️ /generate-page pozvan!");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si profesionalni AI pisac dokumenata. 
          Generiši sadržaj u JSON formatu sa 2-4 sekcije po stranici. 
          Svaka sekcija treba da ima ID, naslov (heading) i tekst (text).`,
        },
        {
          role: "user",
          content: `Napiši sadržaj za stranu ${page}, naslov: "${title}". 
          Jezik: ${language}. Ton: ${tone}. Ukratko sažmi temu: ${summary || "bez sažetka"}.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json(parsed); // sada vraća { sections: [ {id, heading, text} ] }
  } catch (err) {
    console.error("❌ Greška u /generate-page:", err);
    res.status(500).json({ error: "Greška pri generisanju stranice." });
  }
});


router.post("/generate-section", async (req, res) => {
  try {
    const { page, sectionId, tone, language } = req.body;

    const prompt = `
Generiši novi tekst za sekciju ${sectionId} na strani ${page}.
Održavaj kontekst dokumenta, ton: ${tone}, jezik: ${language}.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Ti si AI pisac dokumenata koji dopunjava postojeće sekcije." },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || "";
    res.json({ text });
  } catch (err) {
    console.error("❌ Greška u /generate-section:", err);
    res.status(500).json({ error: "Greška pri regenerisanju sekcije." });
  }
});

// ♻️ Regeneracija jedne sekcije
router.post("/regenerate-section", async (req, res) => {
  console.log("♻️ /regenerate-section pozvan!");

  const { page, sectionId, title, tone, language } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ti si AI koji ponovo piše sekciju dokumenta. Vrati JSON objekat sa id, heading i text poljima.",
        },
        {
          role: "user",
          content: `Ponovo napiši sekciju ${sectionId} za stranu ${page} (${title}), ton: ${tone}, jezik: ${language}.`,
        },
      ],
      response_format: { type: "json_object" },
    });

   let parsed;
try {
  parsed = JSON.parse(completion.choices[0].message.content);
} catch {
  parsed = {
    heading: `Sekcija ${sectionId}`,
    text: completion.choices[0].message.content || "⚠️ Nema sadržaja.",
  };
}
    res.json(parsed);
  } catch (err) {
    console.error("❌ Greška u /regenerate-section:", err);
    res.status(500).json({ error: err.message || "Greška pri regenerisanju sekcije." });
  }
});


router.post("/generate-full-doc", async (req, res) => {
  try {
    const {
      topic,
      docType,
      tone,
      details,
      language,
      pages,
      elements,
    } = req.body;

    console.log("🧭 Generating plan...");
    const plan = await generatePlan({
      topic,
      docType,
      tone,
      details,
      language,
      pages,
    });

    if (!plan || !plan.plan) throw new Error("Planner AI nije vratio validan JSON.");

    console.log("🧱 Plan kreiran, broj strana:", plan.plan.length);

    const results = [];

    // prolazi kroz svaku stranu
    for (const p of plan.plan) {
      console.log(`📝 Generišem stranu ${p.page}: ${p.title}`);
      const text = await generatePage({
        page: p.page,
        title: p.title,
        summary: p.summary,
        elements: p.elements,
        tone,
        language,
      });
      results.push({ ...p, content: text });
    }

    res.json({ plan: plan.plan, pages: results });
  } catch (err) {
    console.error("❌ Error in /generate-full-doc:", err);
    res.status(500).json({ error: "AI generacija dokumenta nije uspela." });
  }
});


async function createGoogleDocFromPlan(plan, formData) {
  const { topic, tone, language } = formData;
  const docs = google.docs({ version: "v1", auth: oauth2Client });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

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
  let currentIndex = 1; // Start at the beginning of the document body

  for (const page of plan) {
    // Handle chart elements first
    if (page.elements && Array.isArray(page.elements)) {
      for (const element of page.elements) {
        if (element.type === 'chart' && element.data && element.data.length > 1) {
          console.log(`📊 Handling chart element: ${element.title}`);
          try {
            const sheetTitle = `[Chart Data] ${topic} - ${element.title || 'Chart'}`;
            const spreadsheetId = await createSpreadsheet(sheetTitle);
            if (!spreadsheetId) throw new Error("Failed to create spreadsheet for chart.");

            const chartData = element.data;
            const numRows = chartData.length;
            const numCols = chartData[0] ? chartData[0].length : 0;
            const range = `Sheet1!A1`;
            await writeData(spreadsheetId, range, chartData);

            const sheetInfos = await getSheetInfo(spreadsheetId);
            if (!sheetInfos || sheetInfos.length === 0) throw new Error("Failed to get sheet info.");
            const firstSheetId = sheetInfos[0].sheetId;

            const chartId = await addChart(spreadsheetId, firstSheetId, element.chartType, numRows, numCols, element.title);
            if (!chartId) throw new Error("Failed to add chart to the sheet.");
            
            // Insert chart title as a heading in the doc
             const titleRequest = {
              insertText: {
                location: { index: currentIndex },
                text: `${element.title}\n`,
              },
            };
             const styleRequest = {
                updateParagraphStyle: {
                    range: {
                        startIndex: currentIndex,
                        endIndex: currentIndex + element.title.length,
                    },
                    paragraphStyle: {
                        namedStyleType: "HEADING_2",
                    },
                    fields: "namedStyleType",
                },
            };


            const chartRequest = {
              insertInlineObject: {
                location: { index: currentIndex + element.title.length + 1 },
                embeddedObject: {
                  sheetChart: {
                    spreadsheetId: spreadsheetId,
                    chartId: chartId,
                  },
                },
                objectSize: {
                  height: { magnitude: 300, unit: "PT" },
                  width: { magnitude: 480, unit: "PT" },
                },
              },
            };
            
            const newlineRequest = {
              insertText: {
                location: { index: currentIndex + element.title.length + 2},
                text: '\n',
              },
            };

            allRequests.push(titleRequest, styleRequest, chartRequest, newlineRequest);
            currentIndex += element.title.length + 3;
          } catch (err) {
            console.error(`Greška pri kreiranju grafikona: ${err}`);
            throw err; // Re-throw the error to be caught by the main handler
          }
        }
      }
    }

    console.log(`📝 Generating content for page ${page.page}: ${page.title}`);
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
  // 3. Write the full content to the document using a single batch update
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

module.exports = { router, createGoogleDocFromPlan };
