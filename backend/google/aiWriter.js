// google/aiWriter.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePage({ page, title, summary, elements, tone, language }) {
  const prompt = `
Generiši sadržaj za stranu ${page} dokumenta.
Naslov: ${title}
Sažetak: ${summary}
Elementi: ${elements?.join(", ") || "nema"}
Ton pisanja: ${tone}
Jezik: ${language}

Zahtevi:
- Piši smislen, jasan i profesionalan tekst.
- Koristi Markdown (#, ##, -, |, >, itd.).
- Ako imaš tabele ili liste, formatiraj ih ispravno.
- Nemoj generisati sadržaj drugih strana.
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Ti si AI pisac dokumenata." },
      { role: "user", content: prompt },
    ],
    max_tokens: 900,
  });

  return res.choices[0].message.content;
}

module.exports = { generatePage };
