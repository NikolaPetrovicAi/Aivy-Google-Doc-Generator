# 🚀 Aivy Workspace: High-Fidelity AI Document Engine

**Aivy Workspace** is an AI-powered document editor integrated with Google Doc. It utilizes a specialized dual-agent system—an AI Planner for structure and an AI Writer for content to build high quality documents. Featuring a custom rich-text interface with context aware AI tools built directly into the editor, it offers a complete environment for generating and refining content. Everything syncs instantly with your Google account. 

---

## 🌟 Key Features

*   **Dual-Agent AI Pipeline:** Utilizes a decoupled **Planner-Writer architecture**. The *Planner* acts as an architect to build a logical document structure, while the *Writer* acts as a specialist to execute content, ensuring coherent long-form documents.
*   **Schema Enforced Generation:** Instead of unpredictable free text, the system leverages OpenAI’s **Structured Outputs (JSON Schema)**. This forces the LLM to adhere to strict data types and structural rules, guaranteeing 100% valid document architecture before rendering.
*   **Dynamic Blueprints:** The AI intelligently selects from a library of logical blocks (e.g., standard text, bullet lists, headers) based on user intent, dynamically assembling a document structure that perfectly fits the specific topic.
*   **Context-Isolated In-Editor AI:** A targeted AI assistant that understands the full document context for style consistency but strictly modifies only the user's selected range—preventing unwanted document-wide rewrites.

---

## 🛠 Engineering Challenges & Solutions

### 1. Robust AI to Document Mapping
**Problem:** AI-generated Markdown is often unpredictable and hard to map to the strict hierarchical structure of the Google Docs API.
**Solution:** Implemented a **Dynamic Blueprint** system. Using OpenAI's **Structured Outputs (`json_schema`)**, the system forces the LLM to generate content in a strictly typed JSON format. This ensures 100% reliability during the conversion process from raw AI output to complex Google Docs **structured API update sequences** requests.

### 2. HTML ↔ Google Docs Parity Engine
**Problem:** Achieving visual consistency between a web-based editor (HTML/CSS) and Google's proprietary document format is notoriously difficult due to conflicting rendering rules.
**Solution:** Built a custom Style Translation Engine that bridges the gap between web standards and Google Docs. 
- Strict Formatting Control: Engineered a sequence-based algorithm that overrides the API’s default "style inheritance" behavior, ensuring that spaces, breaks, and indentation appear exactly as intended by the user, not as guessed by Google.
- Advanced List Alignment: Replaced standard web list markers with calculated visual counters. This ensures that bullet points and numbers strictly follow text alignment (Center/Right) in a way that standard HTML cannot handle natively.

### 3. High-Performance AI Streaming in Rich-Text
**Problem:** Updating the entire document state on every character during an AI stream caused massive re-render lag (choking the browser).
**Solution:** Implemented a **State Isolation Strategy**. The editor updates its internal `ProseMirror` state during the stream, while the parent React state is only notified after the stream is flushed. This allows for smooth, real-time text generation.

---

## 🏗 Architecture & Tech Stack

### Frontend: Bleeding-Edge UI
- **Framework:** Next.js 16 (App Router) & React 19.
- **Styling:** Tailwind CSS v4 (Alpha) for ultra-fast builds and modern CSS features.
- **Editor:** Tiptap v3 (ProseMirror) with custom extensions for color, alignment, and AI injection.

### Backend: Scalable AI Orchestration
- **Runtime:** Node.js (Express.js).
- **AI Integration:** OpenAI API with streaming enabled and Structured Outputs.
- **Cloud:** Google Workspace SDK (Docs, Drive, OAuth 2.0).
- **Session Management:** `express-session` for secure, multi-user token persistence.

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js 20+
- Google Cloud Project with Docs/Drive APIs enabled.
- OpenAI API Key.

### Quick Start
1. **Clone & Install:**
   ```bash
   git clone https://github.com/your-username/aivy-workspace
   cd aivy-workspace
   npm install && cd frontend && npm install && cd ../backend && npm install
   ```
2. **Environment Setup:** Create a `.env` in the `backend/` folder (see `.env.example`).
3. **Run Locally:**
   - **Backend:** `cd backend && node index.js`
   - **Frontend:** `cd frontend && npm run dev`
4. **Authenticate:** Visit `http://localhost:3000`. The application will automatically redirect you to the Google login page to link your account.

---

## 🔮 Future Improvements
- [ ] **Project-Based Contextual Intelligence (RAG+):** Implementing "Aivy Projects" where users can group specific documents for the AI to index. The AI will act as a project-aware collaborator—capable of answering questions across multiple files and performing context-aware edits based on the entire project's knowledge base.
- [ ] **Autonomous Reflection & Self-Correction:** Developing a "Critic" agent to review generated content against formatting standards and logical consistency, ensuring high-fidelity output and minimizing hallucinations through a multi-turn feedback loop.
- [ ] **Live Web-Research Integration:** Enabling agents to use tool-calling for real-time web searches, allowing for fact-grounded drafting and automatic citation of up-to-date information, statistics, and sources.
