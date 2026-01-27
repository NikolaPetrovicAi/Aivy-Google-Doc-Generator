
const cors = require("cors");
// index.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require("express");
const session = require("express-session");
const { google } = require("googleapis");
const axios = require("axios");

const { router: docsRouter, createGoogleDocFromPlan, createGoogleDoc } = require("./google/docs.js");
const { generatePlan } = require("./google/aiPlanner.js");
const { processText } = require("./google/aiEditor.js");


const app = express();
app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from the frontend
  credentials: true // Allow cookies to be sent and received
}));
app.use(express.json());

// Session Middleware Configuration
app.use(session({
  // IMPORTANT: This secret should be moved to an environment variable in a real application.
  secret: 'temporary-secret-key-for-development',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true if you are using HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use("/thumbnail_cache", express.static("thumbnail_cache"));
app.use("/docs", docsRouter);
// Google Alati
const { router: driveRoutes, getGoogleDocs } = require("./google/drive");
const { requireAuth } = require("./middleware/auth");
app.use("/drive", driveRoutes);

app.get('/api/auth/status', (req, res) => {
  if (req.session.tokens) {
    res.json({ isAuthenticated: true });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.get("/api/google-docs", requireAuth, async (req, res) => {
  try {
    const { nextPageToken } = req.query;
    // Pass the user-specific client to the function
    const { files, nextPageToken: newNextPageToken } = await getGoogleDocs(req.oauth2Client, nextPageToken);
    
    // Rename 'files' to 'documents' to match frontend expectation
    res.json({ documents: files, nextPageToken: newNextPageToken });

  } catch (error) {
    console.error("Error fetching google docs for frontend:", error);
    // Send back an empty list on error to prevent frontend from crashing
    res.status(500).json({ documents: [], nextPageToken: undefined, error: "Failed to fetch documents" });
  }
});

app.post("/api/generate-plan", async (req, res) => {
  try {
    const plan = await generatePlan(req.body);
    res.json(plan);
  } catch (error) {
    console.error("Error generating plan:", error);
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

app.post("/api/ai/edit", requireAuth, async (req, res) => {
  try {
    const { text, command, language, context } = req.body;
    if (!text || !command) {
      return res.status(400).json({ error: "Text and command are required" });
    }

    // Disable timeout for this request to handle long generations
    req.socket.setTimeout(0);

    // Streaming setup
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const stream = await processText({ text, command, language, context });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(content);
      }
    }
    
    res.end();
  } catch (error) {
    console.error("[AI Edit] STREAMING ERROR:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process text" });
    } else {
      // If headers were sent, we can't send a JSON error, but we can end the response.
      // Optionally, we could append a distinct error marker if the client supported it.
      res.end();
    }
  }
});

app.post("/api/create-google-doc", requireAuth, async (req, res) => {
  try {
    const { plan, formData } = req.body;
    const documentId = await createGoogleDocFromPlan(req.oauth2Client, plan, formData);
    res.json({ documentId });
  } catch (error) {
    console.error("Error creating Google Doc:", error);
    res.status(500).json({ error: `Failed to create Google Doc. Reason: ${error.message}` });
  }
});

app.post("/api/create-blank-doc", requireAuth, async (req, res) => {
  try {
    const newDoc = await createGoogleDoc(req.oauth2Client, "New blank document");
    res.json({ documentId: newDoc.id });
  } catch (error) {
    console.error("Error creating blank Google Doc:", error);
    console.log(error);
    res.status(500).json({ error: `Failed to create blank Google Doc. Reason: ${error.message}` });
  }
});





// 1. Get the base OAuth2 client (used for generating auth URL)
const { oauth2Client } = require("./google/auth");


// 2. Endpoint za pokretanje login-a
app.get("/auth/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [
      'https://www.googleapis.com/auth/documents',              // Read, write, and create Google Docs
      'https://www.googleapis.com/auth/drive.file',             // Access to files created or opened by the app
      'https://www.googleapis.com/auth/drive.metadata.readonly' // List all documents
    ],
  });
  res.redirect(url);
});

// 3. Callback endpoint (Handles the redirect from Google)
app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    // Store tokens in the user's session
    req.session.tokens = tokens;
    
    // On successful login, redirect back to the frontend application
    res.redirect("http://localhost:3000");
  } catch (err) {
    console.error("Error retrieving access token:", err);
    res.status(500).send("Error during authentication.");
  }
});


const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// --- OpenAI REST klijent (zaobilazi SDK bag za runs/submit_tool_outputs) ---
const OPENAI_HTTP = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
    // Assistants v2 zahteva ovaj header.
    "OpenAI-Beta": "assistants=v2"
  },
  timeout: 30000
});


// Endpoint koji AI koristi da napravi query za Google Drive pretragu
app.get("/ai-query", async (req, res) => {
  const userMessage = req.query.q || "";
  try {
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: `Izvuci ključne reči za Google Drive pretragu iz sledeće rečenice: "${userMessage}"`,
      store: false
    });

    const query = response.output_text?.trim() || "";
    res.json({ query });
  } catch (err) {
    console.error("Greška u AI upitu:", err.response?.data || err.message || err);
    res.status(500).send("Nisam uspeo da napravim AI query");
  }
});





// =============== ASSISTANTS API — NOVI CHAT DEO ===============


// ⚙️ Podesi model (po želji promeni u "gpt-4o" kad ti zatreba snažniji model)
const ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o-mini";

// (Opcionalno) ako već imaš kreiranog assistenta, stavi ga u .env kao OPENAI_ASSISTANT_ID
let ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || null;

// 🧰 Definišemo koje "function tools" asistent zna da pozove
const ASSISTANT_TOOLS = [
  // --- NOVO: Google Docs Tools ---
  {
    type: "function",
    function: {
      name: "create_doc",
      description: "Kreira novi Google Docs dokument i vraća njegov ID.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Naslov novog dokumenta" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_doc",
      description: "Upisuje tekst u postojeći Google Docs dokument.",
      parameters: {
        type: "object",
        properties: {
          documentId: { type: "string" },
          text: { type: "string" }
        },
        required: ["documentId", "text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_doc",
      description: "Čita sadržaj iz Google Docs dokumenta i vraća tekst.",
      parameters: {
        type: "object",
        properties: {
          documentId: { type: "string" }
        },
        required: ["documentId"]
      }
    }
  },
  // --- Google Drive Tools ---
{
  type: "function",
  function: {
    name: "list_drive",
    description: "Vraća listu poslednjih 20 fajlova sa Google Drive-a.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
},
{
  type: "function",
  function: {
    name: "find_drive",
    description: "Pronalazi fajlove po delu imena na Google Drive-u.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Deo naziva fajla koji se traži" }
      },
      required: ["query"]
    }
  }
},
{
  type: "function",
  function: {
    name: "delete_drive",
    description: "Briše fajl sa Google Drive-a po ID-ju.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID fajla koji treba obrisati" }
      },
      required: ["id"]
    }
  }
},
{
  type: "function",
  function: {
    name: "rename_drive",
    description: "Preimenuje fajl na Google Drive-u.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID fajla" },
        newName: { type: "string", description: "Novi naziv fajla" }
      },
      required: ["id", "newName"]
    }
  }
},
];

// 🧠 Kreiraj assistant ako ne postoji (radi jednom na startu)
async function ensureAssistant() {
  if (ASSISTANT_ID) {
    // Ako već postoji ID iz .env, proveri asistenta na serveru
    const a = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    console.log("🔧 Asistent tools (postojeći):", a.tools);
    return ASSISTANT_ID;
  }

  // Ako ga nema, kreiraj novog
  const assistant = await openai.beta.assistants.create({
    name: "Google Sheets Helper",
    instructions: `
Ti si specijalizovani AI asistent za rad sa Google Sheets i Google Docs alatima.
Tvoj zadatak je da izvršavaš korisničke zahteve koristeći definisane funkcije (tools).
NE SMEŠ da izmišljaš rezultate i NE SMEŠ da odgovaraš samo tekstualno umesto da pozoveš odgovarajući alat.

🛠 Dostupne funkcije:

📊 **Google Sheets:**
- write_sheet: Upisuje vrednosti u određeni opseg (2D niz).
- read_sheet: Čita vrednosti iz zadatog opsega.
- update_sheet: Radi batchUpdate zahteve (formatiranje, merge, dodavanje listova…).
  Primeri upotrebe update_sheet:
  • repeatCell → bojenje ćelija
  • addSheet → dodavanje novog radnog lista
    {
      "spreadsheetId": "<ID>",
      "requests": [
        {
          "addSheet": {
            "properties": {
              "title": "NoviSheet"
            }
          }
        }
      ]
    }

- find_sheet: Traži Google Sheets fajl po delu naziva.
- create_sheet: Kreira potpuno novi Google Sheets dokument i vraća njegov spreadsheetId.

📄 **Google Docs:**
- create_doc: Kreira novi Google Docs dokument i vraća njegov ID.
- write_doc: Upisuje tekst u postojeći dokument.
- read_doc: Čita sadržaj iz Google Docs dokumenta i vraća ceo tekst.

📁 **Google Drive:**
- list_drive: Vraća listu poslednjih 20 fajlova.
- find_drive: Pronalazi fajlove po imenu.
- delete_drive: Briše fajl sa Google Drive-a.
- rename_drive: Preimenuje fajl.

🔹 Kada korisnik zatraži pretragu, listanje, brisanje ili preimenovanje fajla,
uvek koristi odgovarajući Drive alat (ne pokušavaj da pišeš tekstualno rešenje).

📬 **Google Gmail:**
- list_gmail: Prikaži poslednje mejlove u inboxu.
- find_gmail: Pretraži mejlove po pošiljaocu ili naslovu.
- send_gmail: Pošalji mejl na zadatu adresu.

🔹 Kada korisnik traži da pročita ili pronađe mejlove — koristi list_gmail ili find_gmail.
🔹 Kada korisnik želi da pošalje mejl — koristi send_gmail i prosledi sve potrebne parametre.
🔹 Kada korisnik zatraži mejlove iz poslatih, koristi find_gmail sa query='in:sent';
🔹 kada zatraži nacrte, koristi query='in:drafts';
🔹 kada traži spam, koristi query='in:spam';
🔹 ako ne navede ništa, koristi query='in:inbox'.”
🔹 Kada vraćaš rezultate mejlova (emails), NEMOJ dodavati nikakav opisni tekst.
    Vrati samo JSON koji sadrži { "emails": [...] } ili { "results": [...] }.
    Frontend će sam prikazati kartice na osnovu toga.


📏 Pravila korišćenja:
1. Svaka akcija nad tabelom (pisanje, čitanje, bojenje, dodavanje lista, formatiranje) MORA da koristi tačan tool.
2. Svaka akcija nad dokumentom (pravljenje, pisanje, čitanje) MORA da koristi Docs alat.
3. Ako korisnik traži bojenje ćelija, UVEK koristi "update_sheet" sa JSON telom koje sadrži:
   {
     "repeatCell": {
       "range": { ... },
       "cell": { "userEnteredFormat": { "backgroundColor": { "red": 1, "green": 0, "blue": 0 } } },
       "fields": "userEnteredFormat.backgroundColor"
     }
   }
   👉 RGB vrednosti su decimalne od 0 do 1 (ne 255).
   🔴 OBAVEZNO: Svaki poziv "update_sheet" mora da ima polje "requests" koje je niz (array) sa barem jednim objektom.
   Ako "requests" nije prosleđen, poziv se smatra nevažećim.
4. Ako korisnik traži više operacija, izvrši ih redom preko odgovarajućih tool poziva.
5. Ako korisnik traži da napravi NOVI Google Sheets dokument, OBAVEZNO koristi "create_sheet".
   - Prosledi parametar "title" kao ime novog dokumenta.
   - Kao rezultat funkcija vraća "spreadsheetId".
   - Taj ID koristiš u svim narednim radnjama (write_sheet, update_sheet, read_sheet).
6. Ako korisnik traži da napravi NOVI Google Docs dokument, OBAVEZNO koristi "create_doc".
   - Prosledi "title" kao naziv dokumenta.
   - Rezultat je "documentId" koji koristiš u narednim radnjama (write_doc, read_doc).
7. Ako korisnik NE prosledi spreadsheetId ili documentId:
   - OBAVEZNO prvo pozovi funkciju "create_sheet" ili "create_doc".
   - Kao naziv koristi ono što korisnik traži (npr. “test”, “Izveštaj”, “Plan projekta”).
   - Kada dobiješ novi ID, koristi ga u svim narednim akcijama.
8. Ako korisnik zatraži da "objasni" sadržaj tabele ili dokumenta:
   - Najpre pročitaj sadržaj koristeći "read_sheet" ili "read_doc".
   - Zatim objasni ili sažmi stvarne podatke koje si pročitao.
   - Nikada ne izmišljaj sadržaj.
9. Nakon izvršavanja tool-a, uvek potvrdi korisniku rezultat jednostavnim i jasnim jezikom (npr. "Tekst je uspešno dodat u dokument." ili "Podaci su upisani u tabelu.").

📌 Najvažnije:
- Uvek koristi tačan tool za rad sa određenim tipom fajla (Docs ili Sheets).
- Nikada ne izmišljaj sadržaj ili rezultate.
- Nikada ne pokušavaj da odgovoriš tekstualno umesto da pozoveš odgovarajući alat.
- Nakon svake akcije, jasno objasni korisniku šta je urađeno.
`,
    model: ASSISTANT_MODEL,
    tools: ASSISTANT_TOOLS
  });
  ASSISTANT_ID = assistant.id;
  console.log("✅ Kreiran Assistant:", ASSISTANT_ID);

  // Ovde ispisujemo tool-ove koje je dobio novi asistent
  console.log("🔧 Asistent tools (novi):", assistant.tools);

  return ASSISTANT_ID;
}


// 💤 mala pauza za polling
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 📄 Nova funkcija
async function createNewSheet(title = "Novi Dokument") {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const fileMetadata = {
    name: title,
    mimeType: "application/vnd.google-apps.spreadsheet"
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    fields: "id"
  });

  return file.data.id;
}

// 🔧 Realna obrada tool poziva (koristi tvoj postojeći oauth2Client i google.* klijente)
async function handleToolCall(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;
  let args = {};
  try { args = JSON.parse(argsRaw || "{}"); } catch {}

  if (name === "write_sheet") {
    const { spreadsheetId, range, values, valueInputOption = "RAW" } = args;
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const r = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values }
    });
    return JSON.stringify({ ok: true, updatedCells: r.data.updatedCells || null });
  }

  if (name === "update_sheet") {
    const { spreadsheetId, requests } = args;
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const r = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
    return JSON.stringify({ ok: true, replies: r.data.replies || null });
  }

  if (name === "read_sheet") {
    const { spreadsheetId, range } = args;
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return JSON.stringify({ ok: true, values: r.data.values || [] });
  }

  if (name === "find_sheet") {
    const { query } = args;
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const r = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains '" + query.replace(/'/g, "\\'") + "'",
      fields: "files(id, name)"
    });
    return JSON.stringify({ ok: true, files: r.data.files || [] });
  }

  if (name === "create_sheet") {
  const title = args.title || "Novi Dokument";
  const newId = await createNewSheet(title);
  console.log("🆕 Napravljen novi dokument:", newId);
  return JSON.stringify({ ok: true, spreadsheetId: newId });
}
  // --- Google Docs Tools ---
  if (name === "create_doc") {
    const { title } = args;
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const fileMetadata = {
      name: title || "Novi dokument",
      mimeType: "application/vnd.google-apps.document"
    };
    const file = await drive.files.create({
      resource: fileMetadata,
      fields: "id, name"
    });
    return JSON.stringify({ ok: true, documentId: file.data.id, name: file.data.name });
  }

  if (name === "write_doc") {
    const { documentId, text } = args;
    const docs = google.docs({ version: "v1", auth: oauth2Client });
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: text
            }
          }
        ]
      }
    });
    return JSON.stringify({ ok: true, message: "Tekst upisan u dokument." });
  }

  if (name === "read_doc") {
    const { documentId } = args;
    const docs = google.docs({ version: "v1", auth: oauth2Client });
    const response = await docs.documents.get({ documentId });
    const text = response.data.body.content
      .map(el => el.paragraph?.elements?.map(e => e.textRun?.content || "").join("") || "")
      .join("");
    return JSON.stringify({ ok: true, content: text.trim(), title: response.data.title });
  }

  // --- Google Drive Tools ---
  if (name === "list_drive") {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const response = await drive.files.list({
      pageSize: 20,
      fields: "files(id, name, mimeType, modifiedTime)"
    });
    return JSON.stringify({
      ok: true,
      files: response.data.files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.mimeType,
        modified: f.modifiedTime
      }))
    });
  }

  if (name === "find_drive") {
    const { query } = args;
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const response = await drive.files.list({
      q: `name contains '${query}'`,
      fields: "files(id, name, mimeType)"
    });
    return JSON.stringify({
      ok: true,
      results: response.data.files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.mimeType
      }))
    });
  }

  if (name === "delete_drive") {
    const { id } = args;
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    await drive.files.delete({ fileId: id });
    return JSON.stringify({ ok: true, message: "Fajl uspešno obrisan." });
  }

  if (name === "rename_drive") {
    const { id, newName } = args;
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const result = await drive.files.update({
      fileId: id,
      requestBody: { name: newName },
      fields: "id, name"
    });
    return JSON.stringify({
      ok: true,
      message: `Fajl preimenovan u "${result.data.name}".`
    });
  }
  // --- Gmail Tools ---
if (name === "list_gmail") {
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const messages = await gmail.users.messages.list({ userId: "me", q: query || "in:inbox", maxResults: 10 });
  const emails = [];

  for (const msg of messages.data.messages || []) {
    const detail = await gmail.users.messages.get({ userId: "me", id: msg.id });
    const headers = detail.data.payload.headers;
    const subject = headers.find(h => h.name === "Subject")?.value || "(bez naslova)";
    const from = headers.find(h => h.name === "From")?.value || "(nepoznat pošiljalac)";
    const date = headers.find(h => h.name === "Date")?.value || "";
    const snippet = detail.data.snippet || "";
    emails.push({ subject, from, date, snippet });
  }
  return JSON.stringify({ ok: true, emails });
}

if (name === "find_gmail") {
  const { query } = args;
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // 👇 određujemo koji folder da koristi prema korisničkoj poruci
  let searchQuery = "in:inbox"; // default je inbox

  if (query.toLowerCase().includes("poslat") || query.toLowerCase().includes("sent")) {
    searchQuery = "in:sent";
  } else if (query.toLowerCase().includes("nacrt") || query.toLowerCase().includes("draft")) {
    searchQuery = "in:drafts";
  } else if (query.toLowerCase().includes("spam")) {
    searchQuery = "in:spam";
  } else if (query.toLowerCase().includes("smeće") || query.toLowerCase().includes("trash")) {
    searchQuery = "in:trash";
  } else if (query.toLowerCase().includes("promocij")) {
    searchQuery = "category:promotions";
  } else if (query.toLowerCase().includes("društv") || query.toLowerCase().includes("social")) {
    searchQuery = "category:social";
  } else if (query.trim() !== "") {
    // ako korisnik traži po imenu ili temi
    searchQuery = query;
  }

  console.log("🔍 Gmail pretraga:", searchQuery);

  // 🔹 1. Uzimamo listu mejlova
  const response = await gmail.users.messages.list({
    userId: "me",
    q: searchQuery,
    maxResults: 5 // manji broj dok testiraš, da ne dobiješ timeout
  });

  // 🔹 2. Uzimamo sve mejlove paralelno (brže nego redom)
  const messages = response.data.messages || [];
  const details = await Promise.all(
    messages.map((msg) =>
      gmail.users.messages.get({ userId: "me", id: msg.id })
    )
  );

  // 🔹 3. Formatiramo rezultate
  const results = details.map((detail) => {
    const headers = detail.data.payload.headers;
    const subject = headers.find((h) => h.name === "Subject")?.value || "(bez naslova)";
    const from = headers.find((h) => h.name === "From")?.value || "(nepoznat pošiljalac)";
    const date = headers.find((h) => h.name === "Date")?.value || "";
    const snippet = detail.data.snippet || "";
    return { id: detail.data.id, subject, from, date, snippet };
  });

  // 🔹 4. Vraćamo čisti JSON (frontend pravi kartice)
  return JSON.stringify({ ok: true, results });
}



if (name === "send_gmail") {
  const { to, subject, text } = args;
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const messageParts = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "",
    text,
  ];
  const message = messageParts.join("\n");

  // ✅ ispravno base64url enkodiranje (UTF-8 safe)
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  return JSON.stringify({
    ok: true,
    message: `Mejl poslat ${to} sa naslovom "${subject}".`,
  });
}



  // Nepoznati tool
  return JSON.stringify({ ok: false, error: `Unknown tool: ${name}` });
}

// dodatne REST funkcije
async function restRetrieveRun(threadId, runId) {
  const { data } = await OPENAI_HTTP.get(`/threads/${threadId}/runs/${runId}`);
  return data;
}

async function restSubmitToolOutputs(threadId, runId, tool_outputs) {
  // tool_outputs: [{ tool_call_id, output }]  — output obavezno string
  const payload = {
    tool_outputs: tool_outputs.map(o => ({
      tool_call_id: o.tool_call_id,
      output: typeof o.output === "string" ? o.output : JSON.stringify(o.output)
    }))
  };
  const { data } = await OPENAI_HTTP.post(
    `/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
    payload
  );
  return data;
}


// 🔁 Polling koji rešava tool pozive dok run ne završi (OpenAI SDK v5)
// 🔁 Polling koji rešava tool pozive dok run ne završi — REST varijanta (stabilno mimo SDK-a)
// 🔁 Polling koji rešava tool pozive dok run ne završi — DEBUG verzija
async function runUntilDone(threadId, runId, maxWaitMs = 60000) { // 20 sekundi
  console.log("🚀 runUntilDone called with:", { threadId, runId });
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    let run;
    try {
      run = await restRetrieveRun(threadId, runId);
    } catch (err) {
      console.error("❌ Greška prilikom restRetrieveRun:", err.response?.data || err.message);
      throw err;
    }

    // 🔍 ceo run objekat
    console.log("🔍 run snapshot:", JSON.stringify(run, null, 2));

    // --- requires_action ---
    if (run.status === "requires_action" && run.required_action?.submit_tool_outputs) {
      console.log("📦 run.required_action:", JSON.stringify(run.required_action, null, 2));
      console.log("⚡ Tool call received:", JSON.stringify(run.required_action.submit_tool_outputs.tool_calls, null, 2));

      const toolCalls = run.required_action.submit_tool_outputs.tool_calls || [];
      const tool_outputs = [];

      for (const tc of toolCalls) {
        try {
          console.log("⚡ Tool call received:", tc);
          const output = await handleToolCall(tc);
          tool_outputs.push({
            tool_call_id: tc.id,
            output: typeof output === "string" ? output : JSON.stringify(output)
          });
        } catch (e) {
          console.error("❌ Greška u handleToolCall:", e);
          tool_outputs.push({
            tool_call_id: tc.id,
            output: JSON.stringify({ ok: false, error: e.message || String(e) })
          });
        }
      }

      console.log("🧾 submitToolOutputs (REST):", { runId, tool_outputs });

      try {
        await restSubmitToolOutputs(threadId, runId, tool_outputs);
      } catch (err) {
        console.error("❌ Greška u restSubmitToolOutputs:", err.response?.data || err.message);
        throw err;
      }

      await sleep(300);
      continue;
    }

    // --- completed ---
    if (run.status === "completed") {
      console.log("✅ Run completed:", runId);
      return "completed";
    }

    // --- failed/cancelled/expired ---
    if (["failed", "cancelled", "expired"].includes(run.status)) {
      console.error("⚠️ Run završio sa statusom:", run.status);
      throw new Error(`Run ended with status: ${run.status}`);
    }

    // --- još traje ---
    console.log("⏳ Run još traje:", run.status);
    await sleep(500);
  }

  throw new Error("Timeout waiting for run to complete.");
}


// 🧵 /chat — nova ruta sa Assistants API
// Body prima: { message, threadId?, spreadsheetId? }
// - Ako nema threadId: kreira se novi thread i vraća se klijentu
// - Po želji prosledi spreadsheetId da AI ima kontekst (može i bez)
app.post("/chat", async (req, res) => {
  try {
    const { message, threadId: inThreadId, spreadsheetId } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Body must contain 'message' (string)." });
    }

    // ⚙️ Postavi SSE zaglavlja (omogućava slanje više poruka)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Helper za slanje eventova
    const sendProgress = (percent) => {
      res.write(`data: ${JSON.stringify({ progress: percent })}\n\n`);
    };

    // 1) Osiguraj da imamo assistenta
    const assistantId = await ensureAssistant();
    sendProgress(10); // 10% — pokrenuto

    // 2) Thread (kreiraj ako nije prosleđen)
    let threadId = inThreadId;
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;

      // 👇 OVAJ LOG UBACI OVDE
      console.log("✅ Novi thread:", threadId);
    }
    sendProgress(25); // 25% — thread spreman

    // 3) Ubaci poruku korisnika (po želji dodaj kontekst o spreadsheetId)
    const userContent = spreadsheetId
      ? `SpreadsheetId: ${spreadsheetId}\n\n${message}`
      : message;

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userContent
    });
    sendProgress(40); // 40% — poruka poslata

    // 4) Pokreni run
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId
    });
    console.log("▶️ Kreiran run:", run.id, "za thread:", threadId);
    sendProgress(60); // 60% — AI obrađuje

// 👇 OVAJ LOG UBACI ODMAH POSLE RUN-A
    console.log("▶️ Kreiran run:", run.id, "za thread:", threadId);

    // 5) Sačekaj da run završi (obraditi će tool pozive ako ih je tražio)
    await runUntilDone(threadId, run.id);
    sendProgress(85); // 85% — pri kraju

    // 6) Uzimamo poslednju AI poruku
    const msgs = await openai.beta.threads.messages.list(threadId, { limit: 10 });
    const lastAssistantMsg = msgs.data.find((m) => m.role === "assistant");
    const text =
      lastAssistantMsg?.content?.[0]?.text?.value ||
      "OK.";

    // 7) Vraćamo odgovor + threadId (čuvaj ga u RN app i šalji nazad)
    let parsedReply;
try {
  parsedReply = JSON.parse(text);
} catch {
  parsedReply = text;
}

res.json({
  reply: parsedReply,
  threadId
});

  } catch (err) {
    console.error("❌ Greška u novom /chat:", err.response?.data || err.message || err);
    res.status(500).json({ error: err.response?.data || err.message || String(err) });
  }
});

// ============ KRAJ — ASSISTANTS API NOVI CHAT DEO ============




// Pokretanje servera
app.listen(process.env.PORT, () => {
  console.log(`Server radi na http://localhost:${process.env.PORT}`);
});
