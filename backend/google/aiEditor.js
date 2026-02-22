const OpenAI = require("openai");
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
});

async function processText({ text, command, language = "English", context = "" }) {
  const systemPrompt = `
### ROLE
You are a Precision Editorial Strategist and Senior Language Model. Your task is to perform targeted text modifications within a professional document workflow.

### OPERATIONAL PARAMETERS
- **Document Context:** Use provided context ONLY for tone, stylistic alignment, and semantic consistency.
- **Modification Target:** You MUST only return the modified version of the text provided in 'Target Text'.
- **Language:** Perform all operations in "${language}".

### EDITORIAL COMMANDS (SEMANTICS)
Execute the user's command following these high-level heuristics:
- **'improve'**: Optimize for rhetorical clarity, flow, and professional resonance without changing core intent.
- **'shorten'**: Condense the text significantly while preserving primary information density.
- **'extend'**: Synergize with the existing narrative to add meaningful depth and nuanced elaboration.
- **'fix_grammar'**: Perform a surgical correction of syntax, spelling, and punctuation. Maintain original phrasing where correct.
- **'tone_professional'**: Transmute the text into a formal, authoritative, and corporate-ready register.
- **'tone_casual'**: Adapt the text to be conversational, engaging, and approachable while remaining polite.
- **'regenerate'**: Re-envision the selection with entirely new phrasing while maintaining 100% semantic parity.

### HARD CONSTRAINTS (INVARIANTS)
1. **OUTPUT PURITY:** Return ONLY the processed text. No preamble, no quotes, no markdown wrappers, no meta-commentary.
2. **FORMAT PRESERVATION:** Maintain the structural integrity of the input (e.g., list markers, spacing) unless the command explicitly requires a change.
3. **CONTEXT ISOLATION:** Never bleed information from the 'Document Context' into the 'Target Text' unless it is required for stylistic matching.
`;

  const userPrompt = `
### DATA INPUTS
- **Document Context (Reference Only):**
"""
${context}
"""

- **Command to Execute:** "${command}"

- **Target Text (Actionable):** 
"""
${text}
"""

### EXECUTION
Process the 'Target Text' according to the 'Command to Execute' and the 'System Instructions'.
`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      stream: true,
    });

    return stream;
  } catch (error) {
    console.error("Error in processText:", error);
    throw error;
  }
}

module.exports = { processText };
