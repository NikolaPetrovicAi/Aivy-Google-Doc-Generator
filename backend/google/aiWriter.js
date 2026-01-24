// google/aiWriter.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePage({ page, title, summary, elements, detailLevel, language }) {

  // The new, detailed system prompt that enforces JSON output and defines the templates.
  const systemPrompt = `
You are an expert document writer AI. Your task is to generate content based on user-provided data and structure it into a single, valid JSON object.

**Rules:**
1.  Your output MUST be a single JSON object. Do not include any text, markdown, or explanations before or after the JSON.
2.  Based on the user's request, choose the most appropriate "block_type" from the available templates.
3.  Populate the JSON object according to the schema for the chosen block_type.
4.  The content you write should be professional, clear, and adhere to the requested tone and language.

**Available Templates:**

**1. Template: "SECTION_ACCORDION_LIST"**
- **Use when:** The user wants a detailed section with a title, an introduction, and a numbered list where each item has a sub-title and supporting text.
- **Schema:**
  \`\`\`json
  {
    "block_type": "SECTION_ACCORDION_LIST",
    "data": {
      "section_title": "String",
      "section_intro": "String",
      "list_items": [
        {
          "item_title": "String",
          "item_content": "String"
        }
      ]
    }
  }
  \`\`\`
- **Content Rule:** Do NOT add numbers (e.g., "1.", "2.") to the beginning of the "item_title" string. The application will handle numbering automatically.

**2. Template: "FEATURE_LIST_BLOCK"**
- **Use when:** The user wants to present a list of key points or features, each with a title and a short description.
- **Schema:**
  \`\`\`json
  {
    "block_type": "FEATURE_LIST_BLOCK",
    "data": {
      "section_title": "String",
      "features": [
        {
          "feature_title": "String",
          "feature_description": "String"
        }
      ]
    }
  }
  \`\`\`

**Example Output:**
If the user asks for "Key project steps", a good output would be:
\`\`\`json
{
  "block_type": "SECTION_ACCORDION_LIST",
  "data": {
    "section_title": "Ključni Koraci u Projektu",
    "section_intro": "Ova sekcija opisuje pet ključnih faza za uspešno izvršenje projekta.",
    "list_items": [
      {
        "item_title": "Faza Planiranja",
        "item_content": "U ovoj početnoj fazi, definišemo ciljeve, resurse i vremenski okvir."
      },
      {
        "item_title": "Faza Dizajna",
        "item_content": "Tim dizajnera kreira vizuelni identitet i korisničko iskustvo."
      }
    ]
  }
}
\`\`\`
`;

  // The user prompt now only contains the raw data for generation.
  const userPrompt = `
Generate content for page ${page} of the document.

- Document Title: ${title}
- Summary: ${summary}
- Key Elements to include: ${elements?.join(", ") || "none"}
- Detail Level: ${detailLevel}
- Language: ${language}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 1500, // Increased to accommodate larger JSON structures
    response_format: { type: "json_object" }, // Enforce JSON output at the API level
  });

  return res.choices[0].message.content;
}

module.exports = { generatePage };
