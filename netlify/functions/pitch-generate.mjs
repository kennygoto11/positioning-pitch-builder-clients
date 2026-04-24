// Go To 11 — Positioning Pitch Builder
// Two modes:
//   1) "options"  → generate 4 pill options per Mad Lib slot (or one slot on regenerate)
//   2) "pitches"  → assemble 5 output formats from the 6 chosen pills
// API key must be set as ANTHROPIC_API_KEY env var on the client-tools Netlify site.

const BRAND_CONTEXT = `You are helping a senior professional build a positioning pitch using Kenny Solway's Mad Lib framework.

KENNY'S POSITIONING FRAMEWORK (6 slots)
Slot 1 — Industry or type of company: the world the audience lives in (e.g., "mid-sized SaaS companies ($5M–$100M ARR)").
Slot 2 — Role or department: the specific person who needs help (e.g., "VPs of Sales").
Slot 3 — Situation or challenge: what they are experiencing right now (e.g., "whose reps' deals stall at the pricing conversation").
Slot 4 — Outcome they want: what they are trying to achieve (e.g., "to shorten sales cycles and win more competitive deals").
Slot 5 — Business impact: what the outcome leads to at the business level (e.g., "protecting margin and hitting quarterly targets without discounting").
Slot 6 — Evidence (the proof): how we know it is real (e.g., "clients have reduced discounting by 15% within one quarter").

The final pitch reads: "I typically work with [1], in particular [2] whose [3]. They are trying to [4], which leads to [5]. When we work together, [6]."

VOICE AND STYLE RULES
- Canadian English spellings (behaviour, organisation, colour, favour).
- Reflective and observational. Warm but direct. Confident without arrogance.
- Short declarative sentences. No hype. No adjective stacking.
- Never use em dashes. Use periods, commas, colons, or restructure.
- No emojis. No exclamation marks. No hashtags. No corporate filler ("leverage", "unlock", "empower", "synergy", "solutions provider").
- Specific over generic. A concrete number, role, or situation beats a vague claim every time.
- No jargon the target audience would not use themselves.`;

const OPTIONS_TASK = `TASK: Generate pill options for each Mad Lib slot.

The user has answered three framing questions. Based on those answers, produce four distinct, high-quality options for each of the six slots. Each option should be:
- A short phrase (typically 4 to 14 words).
- Specific enough that the user can see themselves in it.
- Written in first-person-compatible phrasing (so it drops into "I typically work with ___" etc.).
- Distinct from the other options in the same slot (different angles, not rewordings).

If a specific slot is requested for regeneration, ONLY generate four NEW options for that one slot. Do not repeat options the user has already seen.

OUTPUT FORMAT (JSON only, no preamble, no code fences):
{
  "options": {
    "industry": ["...", "...", "...", "..."],
    "role": ["...", "...", "...", "..."],
    "challenge": ["...", "...", "...", "..."],
    "outcome": ["...", "...", "...", "..."],
    "impact": ["...", "...", "...", "..."],
    "evidence": ["...", "...", "...", "..."]
  }
}

When regenerating a single slot, return only that slot's key inside "options".`;

const PITCHES_TASK = `TASK: Assemble five output formats from the user's six chosen Mad Lib pieces.

You will receive the six selections. Produce the following five outputs, each written in Kenny's voice (reflective, direct, no em dashes, Canadian English):

1. "full" — the complete positioning statement using the template:
   "I typically work with [industry], in particular [role] whose [challenge]. They are trying to [outcome], which leads to [impact]. When we work together, [evidence]."
   Smooth the grammar so it reads naturally. This is the canonical version.

2. "elevator" — a 2 to 3 sentence spoken version. Slightly more conversational. Keeps the audience, the challenge, and the proof. Drops the cleanest way if the full version feels stiff out loud.

3. "conversational" — the version you would say at a networking event when someone asks "so what do you do". One to two sentences. Warm. Human. No setup phrase like "I help". Lead with the people, not with yourself.

4. "linkedin" — a TRUE LinkedIn headline. One line, under 200 characters TOTAL including spaces. Punchy, specific, no filler. Leads with who you help and the outcome they get. Use a pipe " | " to separate elements when it sharpens the read. Do NOT write it as a paragraph. Do NOT use a full sentence unless it is genuinely short. Format like: "I help [audience] [outcome] | [credibility or differentiator]". If the full version would exceed 200 characters, cut the differentiator and keep it to just the help statement.

5. "bio" — a third-person professional bio paragraph (3 to 4 sentences). Starts with the person's specialisation, who they work with, what they solve, and the measurable result. Use "[Name]" as a placeholder for the person.

OUTPUT FORMAT (JSON only, no preamble, no code fences):
{
  "pitches": {
    "full": "...",
    "elevator": "...",
    "conversational": "...",
    "linkedin": "...",
    "bio": "..."
  }
}`;

function buildOptionsPrompt(body) {
  const { q1, q2, q3, regenerateSlot, selections } = body;
  let prompt = `The user has answered three framing questions:\n\n`;
  prompt += `1. What industry, sector, or type of company do you work with? → ${q1 || "(not provided)"}\n`;
  prompt += `2. Who inside that company is your specific audience (role, seniority, department)? → ${q2 || "(not provided)"}\n`;
  prompt += `3. What outcome do they hire you for, and how do you know you delivered it? → ${q3 || "(not provided)"}\n\n`;

  if (regenerateSlot) {
    prompt += `The user wants FOUR FRESH OPTIONS for ONLY the "${regenerateSlot}" slot. Do not repeat any of the following already-seen or already-selected options:\n`;
    if (selections && typeof selections === "object") {
      for (const [slot, val] of Object.entries(selections)) {
        if (val) prompt += `  - ${slot}: ${val}\n`;
      }
    }
    prompt += `\nReturn JSON with only the "${regenerateSlot}" key inside "options".`;
  } else {
    prompt += `Generate four distinct options for EACH of the six slots: industry, role, challenge, outcome, impact, evidence.`;
  }
  return prompt;
}

function buildPitchesPrompt(body) {
  const { selections } = body;
  const s = selections || {};
  let prompt = `The user has chosen the following six pieces:\n\n`;
  prompt += `industry:  ${s.industry || ""}\n`;
  prompt += `role:      ${s.role || ""}\n`;
  prompt += `challenge: ${s.challenge || ""}\n`;
  prompt += `outcome:   ${s.outcome || ""}\n`;
  prompt += `impact:    ${s.impact || ""}\n`;
  prompt += `evidence:  ${s.evidence || ""}\n\n`;
  prompt += `Assemble the five output formats as specified.`;
  return prompt;
}

function extractJson(text) {
  if (!text) return null;
  // Strip code fences if the model wrapped the response.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  // Find first { and last } — tolerant of stray prose.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = raw.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    return null;
  }
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key not configured. Set ANTHROPIC_API_KEY in Netlify environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { mode } = body || {};
  if (mode !== "options" && mode !== "pitches") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid mode. Expected 'options' or 'pitches'." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let systemPrompt;
  let userPrompt;
  let maxTokens;
  if (mode === "options") {
    systemPrompt = `${BRAND_CONTEXT}\n\n${OPTIONS_TASK}`;
    userPrompt = buildOptionsPrompt(body);
    maxTokens = 2048;
  } else {
    systemPrompt = `${BRAND_CONTEXT}\n\n${PITCHES_TASK}`;
    userPrompt = buildPitchesPrompt(body);
    maxTokens = 1500;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      let errPayload;
      try {
        errPayload = await response.json();
      } catch (e) {
        errPayload = { error: { message: `Upstream status ${response.status}` } };
      }
      return new Response(
        JSON.stringify({ error: errPayload.error?.message || "Claude API error" }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "";
    const parsed = extractJson(text);

    if (!parsed) {
      return new Response(
        JSON.stringify({
          error: "Could not parse model output as JSON.",
          raw: text,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    if (mode === "options" && !parsed.options) {
      return new Response(
        JSON.stringify({ error: "Model response missing 'options' key.", raw: text }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    if (mode === "pitches" && !parsed.pitches) {
      return new Response(
        JSON.stringify({ error: "Model response missing 'pitches' key.", raw: text }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/pitch-generate",
};
