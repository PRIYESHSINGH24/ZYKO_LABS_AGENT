import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── CONTINUOUS ANALYSIS PROMPT ──────────────────────────────────────────────
export async function analyzeTranscriptChunk(
  transcript: string,
  existingBlueprint: object | null
): Promise<any> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are a senior software architect and product analyst listening to a client meeting.
Your job is to extract structured software requirements from the conversation in real-time.
You ONLY respond with valid JSON. No markdown, no explanation, just the JSON object.`,

    messages: [
      {
        role: "user",
        content: `
Here is the latest transcript from a client meeting:

<transcript>
${transcript}
</transcript>

${
  existingBlueprint
    ? `Here is what we have extracted so far. UPDATE and IMPROVE it with new information:
<existing>
${JSON.stringify(existingBlueprint, null, 2)}
</existing>`
    : "This is the first chunk. Extract everything you can."
}

Return a JSON object with EXACTLY this structure:
{
  "summary": {
    "overview": "2-3 sentence project description",
    "decisions": ["decision 1", "decision 2"],
    "outOfScope": ["item 1", "item 2"],
    "timeline": "if mentioned"
  },
  "requirements": {
    "p0": [{"title": "", "description": ""}],
    "p1": [{"title": "", "description": ""}],
    "p2": [{"title": "", "description": ""}]
  },
  "userFlows": {
    "flows": [
      {
        "name": "Flow name",
        "actor": "who does this",
        "steps": ["step 1", "step 2"]
      }
    ],
    "screens": ["Screen 1", "Screen 2"]
  },
  "techSpec": {
    "frontend": [],
    "backend": [],
    "integrations": [],
    "deploymentPreferences": [],
    "dataEntities": ["Entity 1", "Entity 2"],
    "constraints": []
  },
  "actionItems": [
    {"text": "", "owner": "", "priority": "HIGH|MEDIUM|LOW"}
  ],
  "confidence": {
    "requirements": 0-100,
    "userFlows": 0-100,
    "techContext": 0-100,
    "dataModel": 0-100,
    "reasoning": "what's still unclear"
  },
  "clarifyingQuestions": ["Question to ask the client?"]
}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text);
}

// ── FULL BLUEPRINT GENERATION PROMPT ────────────────────────────────────────
export async function generateFullBlueprint(
  fullTranscript: string,
  partialBlueprint: object
): Promise<{ blueprint: any; fullPrompt: string }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: `You are a senior software architect. You have listened to an entire client discovery meeting.
Your job is to produce:
1. A complete, structured software blueprint
2. A master prompt that a developer can paste into an AI coding agent (Claude Code, Cursor, etc.) to build the entire application

You ONLY respond with valid JSON. No markdown fences, no explanation.`,

    messages: [
      {
        role: "user",
        content: `
Full meeting transcript:
<transcript>
${fullTranscript}
</transcript>

Partial analysis done so far:
<partial>
${JSON.stringify(partialBlueprint, null, 2)}
</partial>

Produce the final JSON with this structure:
{
  "blueprint": {
    "projectName": "",
    "oneLiner": "",
    "summary": { "overview": "", "decisions": [], "outOfScope": [], "timeline": "" },
    "requirements": { "p0": [], "p1": [], "p2": [] },
    "userFlows": { "flows": [], "screens": [] },
    "techSpec": {
      "recommended": {
        "frontend": ["Next.js 14", "TypeScript", "Tailwind CSS", "shadcn/ui"],
        "backend": ["Next.js API Routes", "Prisma", "PostgreSQL"],
        "auth": ["NextAuth.js"],
        "integrations": [],
        "deployment": ["Vercel", "Supabase"]
      },
      "dataModel": [
        { "model": "ModelName", "fields": ["field1: Type", "field2: Type"], "relations": [] }
      ],
      "businessRules": [],
      "constraints": []
    },
    "actionItems": [],
    "openQuestions": [],
    "confidence": { "requirements": 0, "userFlows": 0, "techContext": 0, "dataModel": 0 }
  },
  "fullPrompt": "THE COMPLETE MASTER PROMPT TEXT — write this as if you are writing instructions for an AI developer. Include project overview, all requirements, all screens, full data model, tech stack, business rules, and end with 'Start by building in this order: 1. ... 2. ... 3. ...'"
}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text);
}
