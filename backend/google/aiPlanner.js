// google/aiPlanner.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePlan({ topic, docType, tone, details, language, pages }) {
  const prompt = `
Ti si AI planer dokumenata.
Tvoj zadatak je da napraviš jasan i strukturiran plan za dokument, podeljen po stranicama.
Ako korisnikov zahtev implicira poređenje, statistiku ili numeričke podatke, OBAVEZNO uključi i grafikon ('chart') u plan.

Odgovor MORA biti JSON format koji prati ovu strukturu:
{
  "plan": [
    {
      "page": 1,
      "title": "Naslov stranice",
      "summary": "Kratak opis sadržaja na ovoj stranici.",
      "elements": [
        { "type": "paragraph" },
        { "type": "list" },
        {
          "type": "chart",
          "chartType": "BAR",
          "title": "Naslov Grafikona",
          "data": [
            ["Labela", "Vrednost"],
            ["Stavka A", 10],
            ["Stavka B", 20]
          ]
        }
      ]
    }
  ]
}

- 'elements' je niz objekata. Svaki objekat mora imati 'type'.
- Mogući tipovi su: "paragraph", "list", "table", "quote", i "chart".
- Ako je tip "chart", OBAVEZNO je dodati:
  - "chartType": String, može biti "BAR", "PIE", ili "LINE".
  - "title": String, naslov koji će biti prikazan iznad grafikona.
  - "data": 2D niz (niz nizova) koji predstavlja podatke. Prvi pod-niz su uvek zaglavlja.

Kreiraj plan za sledeći dokument:
Tema: ${topic}
Tip dokumenta: ${docType}
Ton: ${tone}
Detaljnost: ${details}
Jezik: ${language}
Broj strana: ${pages}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Vrati JSON bez ikakvog dodatnog teksta ili objašnjenja, samo čist JSON objekat koji počinje sa '{'." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(res.choices[0].message.content);
}

module.exports = { generatePlan };
