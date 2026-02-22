// google/aiWriter.js
const OpenAI = require("openai");
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90 * 1000, // 90 seconds
});

async function generatePage({ page, title, summary, elements, targetAudience, detailLevel, language }) {
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
                enum: ["TEXT_BLOCK", "BULLET_POINTS_BLOCK", "STEP_BY_STEP_BLOCK", "FAQ_BLOCK", "SWOT_LIST_BLOCK", "PROS_CONS_BLOCK", "KEY_TAKEAWAYS_BLOCK", "STATS_ROW_BLOCK"] 
              },
              title: { type: "string", description: "Sub-heading for this specific block" },
              content: { type: "string", description: "Main text content (for TEXT_BLOCK or intro to lists)" },
              list_items: { 
                type: "array", 
                items: { type: "string" }, 
                maxItems: 6,
                description: "Used for BULLET, STEP_BY_STEP, and KEY_TAKEAWAYS. STRICT LIMIT: Maximum 6 items for visual clarity." 
              },
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
                },
                maxItems: 5,
                description: "Maximum 5 FAQs per block."
              },
              swot_data: {
                type: "object",
                properties: {
                  strengths: { type: "array", items: { type: "string" }, maxItems: 4 },
                  weaknesses: { type: "array", items: { type: "string" }, maxItems: 4 },
                  opportunities: { type: "array", items: { type: "string" }, maxItems: 4 },
                  threats: { type: "array", items: { type: "string" }, maxItems: 4 }
                },
                required: ["strengths", "weaknesses", "opportunities", "threats"],
                additionalProperties: false
              },
              pros_cons: {
                type: "object",
                properties: {
                  pros: { type: "array", items: { type: "string" }, maxItems: 6 },
                  cons: { type: "array", items: { type: "string" }, maxItems: 6 }
                },
                required: ["pros", "cons"],
                additionalProperties: false
              },
              stats: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Short label (e.g., 'Revenue')" },
                    value: { type: "string", description: "Short value (e.g., '$1.2M')" }
                  },
                  required: ["label", "value"],
                  additionalProperties: false
                },
                minItems: 3,
                maxItems: 3,
                description: "Exactly 3 stats for a row."
              }
            },
            required: ["type", "title", "content", "list_items", "faqs", "swot_data", "pros_cons", "stats"],
            additionalProperties: false
          }
        }
      },
      required: ["page_title", "blocks"],
      additionalProperties: false
    }
  };

  const systemPrompt = `
### ROLE
You are a Senior Document Architect and Professional Content Strategist. Your mission is to generate high-fidelity, structured content for a specific document page, adhering to strict semantic and formatting constraints.

### CONTEXTUAL PARAMETERS
- **Target Audience:** "${targetAudience || 'General Public'}" (Tailor vocabulary, complexity, and tone accordingly).
- **Language:** Respond exclusively in "${language}".
- **Detail Level:** ${detailLevel}
    - *Minimal:* High-level abstractions, extreme brevity.
    - *Concise:* Precise, impactful summaries with moderate detail.
    - *Detailed:* Comprehensive analysis with supporting context.
    - *Extensive:* Exhaustive exploration, deep technical/narrative depth.

### STRUCTURAL GUIDELINES (BLOCK DEFINITIONS)
Populate the 'blocks' array based on these specifications:
- **TEXT_BLOCK:** Narrative flow. Content belongs in 'content'.
- **BULLET_POINTS_BLOCK:** Logical lists. Intro in 'content', items in 'list_items'.
- **STEP_BY_STEP_BLOCK:** Sequential procedures. Intro in 'content', steps in 'list_items'.
- **FAQ_BLOCK:** Anticipated questions. Map to 'faqs' (question/answer).
- **SWOT_LIST_BLOCK:** Strategic analysis. Map to 'swot_data'.
- **PROS_CONS_BLOCK:** Comparative analysis. Map to 'pros' and 'cons'.
- **KEY_TAKEAWAYS_BLOCK:** Critical insights. Map to 'list_items'.
- **STATS_ROW_BLOCK:** Quantitative metrics. Exactly 3 objects in 'stats'.

### HARD CONSTRAINTS & FORMATTING RULES
1. **NO MANUAL MARKERS:** Never include numbers (1., 2.), bullets (-, *, •), or prefixes (Question:, Answer:) in list or FAQ fields.
2. **COGNITIVE LOAD MANAGEMENT:**
   - Standard lists: Max 6 items.
   - SWOT components: Max 4 items.
   - Stats: Exactly 3 items.
3. **SEMANTIC INTEGRITY:** Ensure 'title' fields provide meaningful context for the block, not just the block type name.
4. **STYLE MANUAL:** Maintain a professional, authoritative, yet accessible tone. Prioritize clarity and scannability.

### OUTPUT PROTOCOL
Generate valid JSON matching the provided schema. Do not include markdown formatting outside the JSON structure.
`;

  const userPrompt = `
### INPUT DATA
- **Document Title:** ${title}
- **Page Context/Summary:** ${summary}
- **Requested Schema (Block Order):** ${elements?.map(e => e.type).join(", ") || "TEXT_BLOCK"}

### TASK
Compose the page content following the Contextual Parameters and Structural Guidelines defined in the System Instructions. Ensure logical flow between blocks while maintaining the requested sequence.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
