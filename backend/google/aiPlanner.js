// google/aiPlanner.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePlan({ topic, targetAudience, detailLevel, language, pages }) {
  const prompt = `
Ti si AI planer dokumenata. Tvoj zadatak je da napraviš jasan i strukturiran plan za Google Doc dokument.

ANALIZA KONTEKSTA:
Tema: "${topic}"
Ciljna publika: "${targetAudience || 'Opšta publika'}"

1. Ako je tema NE-POSLOVNA (npr. recept, priča, esej, pismo, putovanje):
   - KORISTI SAMO: "TEXT_BLOCK", "BULLET_POINTS_BLOCK", "STEP_BY_STEP_BLOCK", "PROS_CONS_BLOCK", "KEY_TAKEAWAYS_BLOCK".
   - STROGO ZABRANJENO: "SWOT_LIST_BLOCK", "STATS_ROW_BLOCK".
2. Ako je tema POSLOVNA ili STRATEŠKA (npr. biznis plan, marketing strategija, analiza projekta):
   - Možeš koristiti sve blokove, uključujući "SWOT_LIST_BLOCK", "FAQ_BLOCK" i "STATS_ROW_BLOCK".

OPIS BLOKOVA:
1. "TEXT_BLOCK" (Mali) - Univerzalan. Koristi za uvode, priče, opise.
2. "BULLET_POINTS_BLOCK" (Mali) - Univerzalan. Koristi za liste, karakteristike.
3. "STEP_BY_STEP_BLOCK" (Mali) - Univerzalan. Koristi za uputstva, procese.
4. "PROS_CONS_BLOCK" (Mali) - Upoređivanje dobrih i loših strana neke ideje ili opcije.
5. "KEY_TAKEAWAYS_BLOCK" (Mali) - Isticanje najvažnijih poruka (obično na početku ili kraju dokumenta).
6. "STATS_ROW_BLOCK" (Mali) - Red sa 3 ključne metrike ili kratka podatka (prikazuje se u 3 kolone).
7. "FAQ_BLOCK" (Veliki) - Pitanja i odgovori za razjašnjenje detalja.
8. "SWOT_LIST_BLOCK" (Veliki) - ISKLJUČIVO za biznis analizu.

LOGIKA PAGINACIJE (STRUKTURA STRANA):
- "Mali" blokovi se mogu kombinovati na istoj stranici. Dozvoljeno je najviše 2 "Mala" bloka po stranici.
- "Veliki" blokovi su masivni i MORAJU biti sami na stranici.
- Nikada nemoj stavljati više od 2 bloka na jednu stranicu.
- Prilagodi stil pisanja i izbor blokova CILJNOJ PUBLICI.

DODATNE INSTRUKCIJE:
1. Kada praviš plan, nemoj koristiti isti tip bloka dva puta zaredom na istoj strani.

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
