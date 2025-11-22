// google/aiPlanner.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePlan({ topic, docType, tone, details, language, pages }) {
  const prompt = `
Ti si AI planer dokumenata.
Tvoj zadatak je da napraviš jasan plan za dokument podeljen po stranicama.
Vrati JSON format sa ovim ključevima:
{
  "plan": [
    { "page": 1, "title": "Naslov strane", "summary": "Kratak opis šta će biti na toj strani", "elements": ["lista","tabela","citat"] },
    ...
  ]
}

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
      { role: "system", content: "Vrati JSON bez objašnjenja, samo objekat plan." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(res.choices[0].message.content);
}

module.exports = { generatePlan };
