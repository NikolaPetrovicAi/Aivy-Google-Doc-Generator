// google/aiWriter.js
const OpenAI = require("openai");
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90 * 1000, // 90 seconds
});

async function generatePage({ page, title, summary, elements, detailLevel, language }) {
  // Enhanced JSON Schema for multiple blocks per page
  const jsonSchema = {
    name: "page_content",
    strict: true,
    schema: {
      type: "object",
      properties: {
        page_title: { type: "string" },
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { 
                type: "string", 
                enum: ["TEXT_BLOCK", "BULLET_POINTS_BLOCK", "STEP_BY_STEP_BLOCK", "FAQ_BLOCK", "SWOT_LIST_BLOCK"] 
              },
              title: { type: "string", description: "Sub-heading for this specific block" },
              content: { type: "string", description: "Main text content (for TEXT_BLOCK or intro to lists)" },
              list_items: { type: "array", items: { type: "string" }, description: "Used for BULLET and STEP_BY_STEP" },
              faqs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    answer: { type: "string" }
                  },
                  required: ["question", "answer"],
                  additionalProperties: false
                }
              },
              swot_data: {
                type: "object",
                properties: {
                  strengths: { type: "array", items: { type: "string" } },
                  weaknesses: { type: "array", items: { type: "string" } },
                  opportunities: { type: "array", items: { type: "string" } },
                  threats: { type: "array", items: { type: "string" } }
                },
                required: ["strengths", "weaknesses", "opportunities", "threats"],
                additionalProperties: false
              }
            },
            required: ["type", "title", "content", "list_items", "faqs", "swot_data"],
            additionalProperties: false
          }
        }
      },
      required: ["page_title", "blocks"],
      additionalProperties: false
    }
  };

  const systemPrompt = `
You are a professional document writer. Your task is to generate content for a specific document page based on the requested block types.

IMPORTANT RULES FOR FORMATTING:
1. NEVER include manual numbers (e.g., "1.", "2. ", "1) ") in 'list_items'.
2. NEVER include manual bullets (e.g., "-", "*", "•") in 'list_items'.
3. NEVER include prefixes like "Question:" or "Answer:" in the 'faqs' objects.
4. Each string in 'list_items' should be the raw text ONLY. Formatting is handled automatically by the system.

IMPORTANT: You must adjust the length, depth, and detail of your writing based on the following Detail Level: ${detailLevel}.
- If 'Minimal': Write very brief, high-level summaries and short lists.
- If 'Concise': Write clear, to-the-point content with moderate detail.
- If 'Detailed': Write in-depth explanations, multiple paragraphs per block, and comprehensive lists.
- If 'Extensive': Write highly detailed, exhaustive content with long paragraphs and very thorough lists.

For each block in the 'blocks' array:
- 'TEXT_BLOCK': Main content goes into 'content'.
- 'BULLET_POINTS_BLOCK': Intro text in 'content', items in 'list_items'.
- 'STEP_BY_STEP_BLOCK': Intro text in 'content', numbered steps in 'list_items'.
- 'FAQ_BLOCK': Questions and answers in 'faqs'.
- 'SWOT_LIST_BLOCK': Strengths, Weaknesses, Opportunities, and Threats in 'swot_data'.

Always respond in ${language}. Tone: Professional and appropriate for the topic.
`;

  const userPrompt = `
Write content for: ${title}
Page Context: ${summary}
Requested Structure (Blocks): ${elements?.map(e => e.type).join(", ") || "TEXT_BLOCK"}

Generate the JSON with the 'blocks' array matching the requested structure.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { 
        type: "json_schema", 
        json_schema: jsonSchema 
      },
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error(`Error generating content for page "${title}":`, error);
    // Depending on desired behavior, you might:
    // - Re-throw the error to stop the entire document generation.
    // - Return a default/empty content for the page to allow the rest of the document to generate.
    // For now, let's re-throw to make the issue evident and prevent partial, potentially malformed, documents.
    throw error;
  }
}

module.exports = { generatePage };
