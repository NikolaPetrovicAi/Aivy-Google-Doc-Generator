// google/aiPlanner.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePlan({ topic, detailLevel, language, pages }) {
  const prompt = `
Ti si AI planer dokumenata. Tvoj zadatak je da napraviš jasan i strukturiran plan za Google Doc dokument.

ANALIZA KONTEKSTA:
Prvo analiziraj temu: "${topic}".
1. Ako je tema NE-POSLOVNA (npr. recept, priča, esej, pismo, putovanje):
   - KORISTI SAMO: "TEXT_BLOCK", "BULLET_POINTS_BLOCK", "STEP_BY_STEP_BLOCK".
   - STROGO ZABRANJENO: "SWOT_LIST_BLOCK".
2. Ako je tema POSLOVNA ili STRATEŠKA (npr. biznis plan, marketing strategija, analiza projekta):
   - Možeš koristiti sve blokove, uključujući "SWOT_LIST_BLOCK" i "FAQ_BLOCK".

OPIS BLOKOVA:
1. "TEXT_BLOCK" - Univerzalan. Koristi za uvode, priče, opise.
2. "BULLET_POINTS_BLOCK" - Univerzalan. Koristi za sastojke, liste mesta, karakteristike.
3. "STEP_BY_STEP_BLOCK" - Univerzalan. Koristi za recepte, uputstva, vodiče.
4. "FAQ_BLOCK" - Koristi samo ako je potrebno razjašnjenje (npr. pravila, podrška).
5. "SWOT_LIST_BLOCK" - ISKLJUČIVO za biznis analizu.

DODATNE INSTRUKCIJE:
1. Kada pravis plan gde ce koji blok da ide nemoj da koristis jedan isti 2 puta zaredom moras da promenis na sledeci.

Odgovor MORA biti JSON format:
{
  "plan": [
    {
      "page": 1,
      "title": "Naslov stranice",
      "summary": "Kratak opis sadržaja.",
      "elements": [
        { "type": "TEXT_BLOCK" }
      ]
    }
  ]
}

Kreiraj plan za:
Tema: ${topic}
Detaljnost: ${detailLevel}
Jezik: ${language}
Broj strana: ${pages}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Vrati JSON bez ikakvog dodatnog teksta ili objašnjenja, samo čist JSON objekat koji počinje sa '{'." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(res.choices[0].message.content);
}

module.exports = { generatePlan };
