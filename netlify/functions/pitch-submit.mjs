// Go To 11 — Positioning Pitch Builder: submission / lead capture
// Two flows controlled by body.existingPageId:
//   1) NEW submission (no existingPageId): create Notion row, notify Kenny, optionally email user.
//   2) UPDATE (existingPageId provided): flip "Emailed copy" = true and email user.
//
// Required env vars on the client-tools Netlify site:
//   NOTION_TOKEN              — Notion internal integration token
//   NOTION_PITCH_LEADS_DB_ID  — database ID (default hardcoded below)
//   RESEND_API_KEY            — Resend API key
//   FROM_EMAIL                — from address for user/Kenny emails (e.g. "Kenny Solway <kennysolway@cost.goto11.ca>")
//   NOTIFY_EMAIL              — Kenny's notification inbox (default kenny@kennysolway.com)

const DEFAULT_DB_ID = "c348991fa80c47b99fb55272ad063ba5";
const DEFAULT_FROM = "Kenny Solway <kennysolway@cost.goto11.ca>";
const DEFAULT_NOTIFY = "kenny@kennysolway.com";

function txt(v) {
  return { rich_text: [{ type: "text", text: { content: String(v || "").slice(0, 1900) } }] };
}
function title(v) {
  return { title: [{ type: "text", text: { content: String(v || "Anonymous").slice(0, 200) } }] };
}

async function notionCreatePage({ dbId, token, data }) {
  const s = data.selections || {};
  const p = data.pitches || {};
  const properties = {
    "Name": title(data.name),
    "Email": { email: data.email || null },
    "Company": txt(data.company),
    "Role": txt(data.role),
    "Status": { select: { name: "New" } },
    "Q1 Industry answer": txt(data.q1),
    "Q2 Audience answer": txt(data.q2),
    "Q3 Outcome answer": txt(data.q3),
    "Industry": txt(s.industry),
    "Role (selected)": txt(s.role),
    "Challenge": txt(s.challenge),
    "Outcome": txt(s.outcome),
    "Impact": txt(s.impact),
    "Evidence": txt(s.evidence),
    "Full pitch": txt(p.full),
    "Elevator pitch": txt(p.elevator),
    "Conversational pitch": txt(p.conversational),
    "LinkedIn headline": txt(p.linkedin),
    "Bio paragraph": txt(p.bio),
    "Emailed copy": { checkbox: !!data.emailUser },
  };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Notion create failed (${res.status}): ${t}`);
  }
  const j = await res.json();
  return j.id;
}

async function notionFlipEmailed({ pageId, token }) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { "Emailed copy": { checkbox: true } } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Notion update failed (${res.status}): ${t}`);
  }
}

async function resendSend({ apiKey, from, to, subject, html, replyTo }) {
  const body = { from, to: Array.isArray(to) ? to : [to], subject, html };
  if (replyTo) body.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend failed (${res.status}): ${t}`);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildUserEmailHtml(data) {
  const p = data.pitches || {};
  const row = (label, body) => `
    <tr><td style="padding:18px 0 6px 0;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9439bf">${escapeHtml(label)}</td></tr>
    <tr><td style="padding:0 0 14px 0;font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#2d2a2e">${escapeHtml(body)}</td></tr>`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ebeaeb">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ebeaeb;padding:28px 0">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:#ffffff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06)" cellpadding="0" cellspacing="0">
      <tr><td style="padding-bottom:6px;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#2d2a2e">Your Positioning Pitches</td></tr>
      <tr><td style="padding-bottom:18px;font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:14px;color:#66615c;line-height:1.55">Hi ${escapeHtml(data.name || "there")} — here are the five versions you built today. Same positioning, five contexts. Use whichever one fits the moment.</td></tr>
      <tr><td style="border-top:1px solid #ebeaeb"></td></tr>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Full positioning statement", p.full || "")}
        ${row("Elevator pitch", p.elevator || "")}
        ${row("Conversational", p.conversational || "")}
        ${row("LinkedIn headline", p.linkedin || "")}
        ${row("Bio / About", p.bio || "")}
      </table>
      <tr><td style="padding-top:18px;border-top:1px solid #ebeaeb;font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#2d2a2e">
        One thing most people miss: positioning is not what you say about yourself. It is the frame you give the other person so they can say yes. If you want help pressure-testing which of these lands hardest with your specific audience, hit reply. I read every one.<br><br>— Kenny<br>
        <span style="color:#66615c;font-size:13px">Go To 11 Communication Training · <a href="https://goto11.ca" style="color:#9439bf;text-decoration:none">goto11.ca</a></span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildKennyNotificationHtml(data) {
  const s = data.selections || {};
  const p = data.pitches || {};
  const line = (k, v) => `<tr><td style="padding:4px 10px 4px 0;font-weight:700;color:#9439bf;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0;color:#2d2a2e">${escapeHtml(v || "")}</td></tr>`;
  return `<!doctype html>
<html><body style="font-family:'Nunito',Helvetica,Arial,sans-serif;background:#ebeaeb;padding:24px;margin:0">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
  <div style="font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#2d2a2e;margin-bottom:14px">New pitch builder lead</div>
  <table cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
    ${line("Name", data.name)}
    ${line("Email", data.email)}
    ${line("Company", data.company)}
    ${line("Role", data.role)}
  </table>
  <div style="margin-top:18px;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#9439bf;text-transform:uppercase;letter-spacing:1px">Step 1 answers</div>
  <table cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.5;margin-top:6px">
    ${line("Industry (Q1)", data.q1)}
    ${line("Audience (Q2)", data.q2)}
    ${line("Outcome (Q3)", data.q3)}
  </table>
  <div style="margin-top:18px;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#9439bf;text-transform:uppercase;letter-spacing:1px">Selections</div>
  <table cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.5;margin-top:6px">
    ${line("Industry", s.industry)}
    ${line("Role", s.role)}
    ${line("Challenge", s.challenge)}
    ${line("Outcome", s.outcome)}
    ${line("Impact", s.impact)}
    ${line("Evidence", s.evidence)}
  </table>
  <div style="margin-top:18px;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#9439bf;text-transform:uppercase;letter-spacing:1px">Full positioning</div>
  <div style="margin-top:6px;font-size:14px;line-height:1.55;color:#2d2a2e">${escapeHtml(p.full || "")}</div>
  <div style="margin-top:14px;font-size:12px;color:#66615c">LinkedIn headline: ${escapeHtml(p.linkedin || "")}</div>
  <div style="margin-top:18px;font-size:12px;color:#66615c">Emailed user copy: <strong>${data.emailUser ? "yes" : "no"}</strong> · Logged to Notion DB.</div>
</div>
</body></html>`;
}

export default async (req, context) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const notionToken = process.env.NOTION_TOKEN;
  const resendKey = process.env.RESEND_API_KEY;
  const dbId = process.env.NOTION_PITCH_LEADS_DB_ID || DEFAULT_DB_ID;
  const fromEmail = process.env.FROM_EMAIL || DEFAULT_FROM;
  const notifyEmail = process.env.NOTIFY_EMAIL || DEFAULT_NOTIFY;

  if (!notionToken || !resendKey) {
    return new Response(
      JSON.stringify({
        error: "Missing env vars. Required: NOTION_TOKEN and RESEND_API_KEY on the client-tools Netlify site.",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const emailUser = !!body.emailUser;
  const existingPageId = body.existingPageId || null;

  // Flow 2: user clicked "Email me a copy" AFTER initial submit.
  if (existingPageId) {
    if (!body.email) {
      return new Response(JSON.stringify({ error: "Missing user email." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    try {
      await notionFlipEmailed({ pageId: existingPageId, token: notionToken });
    } catch (e) {
      // Not fatal — still try to email the user.
      console.log("notion flip failed:", e.message);
    }
    try {
      await resendSend({
        apiKey: resendKey,
        from: fromEmail,
        to: body.email,
        replyTo: notifyEmail,
        subject: "Your positioning pitches (from the Go To 11 pitch builder)",
        html: buildUserEmailHtml(body),
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Email failed: " + e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    return new Response(JSON.stringify({ ok: true, emailed: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  // Flow 1: new submission — log to Notion, notify Kenny, optionally email user.
  if (!body.name || !body.email) {
    return new Response(JSON.stringify({ error: "Name and email are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let pageId = null;
  try {
    pageId = await notionCreatePage({ dbId, token: notionToken, data: body });
  } catch (e) {
    // Notion failure is not fatal for the user — they still get their pitches in the browser.
    console.log("notion create failed:", e.message);
  }

  // Fire Kenny notification regardless.
  try {
    await resendSend({
      apiKey: resendKey,
      from: fromEmail,
      to: notifyEmail,
      subject: `Pitch builder lead: ${body.name}${body.company ? " (" + body.company + ")" : ""}`,
      html: buildKennyNotificationHtml(body),
    });
  } catch (e) {
    console.log("kenny notify failed:", e.message);
  }

  // Optional user copy (only if they opted in at submit time, which this version doesn't do yet).
  if (emailUser && body.email) {
    try {
      await resendSend({
        apiKey: resendKey,
        from: fromEmail,
        to: body.email,
        replyTo: notifyEmail,
        subject: "Your positioning pitches (from the Go To 11 pitch builder)",
        html: buildUserEmailHtml(body),
      });
    } catch (e) {
      console.log("user email failed:", e.message);
    }
  }

  return new Response(JSON.stringify({ ok: true, pageId }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
};

export const config = {
  path: "/api/pitch-submit",
};
