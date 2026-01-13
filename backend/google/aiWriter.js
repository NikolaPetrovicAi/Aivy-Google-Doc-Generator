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

- **PRAVILA ZA LISTE (OBAVEZNO PRATITI):**
  - Kada pišeš stavke unutar ISTE liste, NIKADA ne ostavljaj prazan red između njih.
    - **ISPRAVNO:**
      - Prva stavka
      - Druga stavka
    - **NEISPRAVNO:**
      - Prva stavka
      
      - Druga stavka

  - Kada želiš da napraviš vizuelni razmak (prazan red) između DVE ODVOJENE LISTE ili između liste i drugog teksta, KORISTI specijalni marker.
    - **ISPRAVNO:**
      - Prva lista, stavka 1
      <!-- SPACER -->
      - Druga lista, stavka 1
    - **NEISPRAVNO:**
      - Prva lista, stavka 1
      
      - Druga lista, stavka 1

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
