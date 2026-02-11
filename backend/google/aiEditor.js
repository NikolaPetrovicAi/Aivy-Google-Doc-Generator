const OpenAI = require("openai");
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
});

async function processText({ text, command, language = "English", context = "" }) {
  const systemPrompt = `
You are an expert AI editor integrated into a professional writing tool. 
Your task is to modify the provided text based on the user's command.

Use the provided 'Document Context' to understand the tone, style, and topic of the document. However, you must ONLY modify the text provided in the 'Text to modify' section.

COMMANDS:
- 'improve': Enhance the clarity, flow, and professionalism of the text.
- 'shorten': Make the text alot shorter.
- 'extend': Elaborate on the points made in the text to provide more depth.
- 'fix_grammar': Correct spelling and grammar mistakes only.
- 'tone_professional': Rewrite the text to sound more professional and formal.
- 'tone_casual': Rewrite the text to sound more friendly and approachable.
- 'regenerate': Rewrite the selected text with new phrasing, retaining the original meaning.

RULES:
1. Return ONLY the modified text. No explanations, no quotes, no preamble.
2. Maintain the same formatting (e.g., if it's a list item, return it as a list item).
3. Always respond in the requested language: ${language}.
`;

  const userPrompt = `
Document Context:
"""
${context}
"""

Command: ${command}
Text to modify: 
"""
${text}
"""
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
