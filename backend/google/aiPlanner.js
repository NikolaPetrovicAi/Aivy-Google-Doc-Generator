// google/aiPlanner.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePlan({ topic, targetAudience, detailLevel, language, pages }) {
  const prompt = `
### ROLE: Aivy Workspace Document Architect
You are a Senior AI Document Strategist responsible for generating high-fidelity, logically structured document blueprints. Your objective is to transform a raw user topic into a professional page-by-page plan that optimizes for information hierarchy and user experience.

### CONTEXTUAL INPUTS:
- **Primary Topic:** "${topic}"
- **Target Audience:** "${targetAudience || 'General audience'}"
- **Detail Density:** "${detailLevel}"
- **Output Language:** "${language}"
- **Total Page Constraints:** ${pages} pages

### ARCHITECTURAL GUARDRAILS (INVARIANTS):
1. **Domain-Specific Block Logic:**
   - **NON-BUSINESS DOMAINS** (Personal, Creative, Academic): Use strictly standard blocks: [TEXT_BLOCK, BULLET_POINTS_BLOCK, STEP_BY_STEP_BLOCK, PROS_CONS_BLOCK, KEY_TAKEAWAYS_BLOCK].
   - **BUSINESS/STRATEGIC DOMAINS** (Corporate, Analysis, Growth): Access to full suite including [SWOT_LIST_BLOCK, STATS_ROW_BLOCK, FAQ_BLOCK].
2. **Page Composition Limits:**
   - "Small" blocks: Max 2 per page. Can be combined.
   - "Large" blocks (SWOT_LIST_BLOCK, FAQ_BLOCK): Exclusive. MUST occupy an entire page alone.
   - NEVER exceed 2 blocks per page regardless of size.
3. **Sequential Variety:** Do not repeat the same block type consecutively on a single page to maintain visual and cognitive engagement.

### BLOCK LIBRARY & SEMANTICS:
- **TEXT_BLOCK** (Small): Narrative flow, introductions, or deep-dive paragraphs.
- **BULLET_POINTS_BLOCK** (Small): High-level feature lists or non-sequential data.
- **STEP_BY_STEP_BLOCK** (Small): Procedural logic or chronological workflows.
- **PROS_CONS_BLOCK** (Small): Comparative analysis using a structured 2-column layout.
- **KEY_TAKEAWAYS_BLOCK** (Small): Executive summaries or essential highlights.
- **STATS_ROW_BLOCK** (Small): 3-column horizontal layout for KPIs and metrics.
- **FAQ_BLOCK** (Large): Detailed Q&A section for addressable concerns.
- **SWOT_LIST_BLOCK** (Large): Strategic analysis (Strengths, Weaknesses, Opportunities, Threats).

### EXECUTION STRATEGY:
1. Analyze the **Topic** to determine if it belongs to a Strategic/Business domain.
2. Select blocks that align with the **Target Audience's** expertise level.
3. Distribute content across exactly **${pages} pages**, ensuring each page has a cohesive "theme" reflected in its title.
4. Use the requested **Language** (${language}) for all titles and summaries.

### OUTPUT SPECIFICATION (JSON):
Return a strictly valid JSON object following this schema:
{
  "plan": [
    {
      "page": number,
      "title": "Professional page heading",
      "summary": "Concise architectural description of the content and objective for this page.",
      "elements": [
        { "type": "BLOCK_TYPE_ID" }
      ]
    }
  ]
}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: "You are a deterministic JSON generator. Your only output is a valid, parsable JSON object that strictly adheres to the Document Architect protocol. No conversational fillers, no markdown formatting blocks, and no preamble." 
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(res.choices[0].message.content);
}

module.exports = { generatePlan };
