import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { ticketKey: string } }
) {
  const ticketKey = params.ticketKey.toUpperCase();
  const baseUrl = process.env.JIRA_BASE_URL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const email = process.env.JIRA_EMAIL;

  if (!baseUrl || !apiToken || !email) {
    return NextResponse.json(
      { error: "Jira credentials not configured" },
      { status: 500 }
    );
  }

  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(ticketKey)) {
    return NextResponse.json(
      { error: "Invalid ticket key format. Expected something like ENG-1234" },
      { status: 400 }
    );
  }

  try {
    const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
    const response = await fetch(
      `${baseUrl}/rest/api/3/issue/${ticketKey}?fields=summary,description,issuetype,status,priority,assignee,labels,comment`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: `Ticket ${ticketKey} not found` }, { status: 404 });
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: "Jira authentication failed — check credentials" }, { status: 401 });
      }
      return NextResponse.json({ error: `Jira returned status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const fields = data.fields;
    const description = extractTextFromADF(fields.description);
    const pokerSummary = extractPokerSummary(fields.comment?.comments || []);

    return NextResponse.json({
      key: data.key,
      title: fields.summary || "",
      description: description,
      summary: pokerSummary,
      issueType: fields.issuetype?.name || null,
      status: fields.status?.name || null,
      priority: fields.priority?.name || null,
      assignee: fields.assignee?.displayName || null,
      labels: fields.labels || [],
      url: `${baseUrl}/browse/${data.key}`,
    });
  } catch (err) {
    console.error("Jira fetch error:", err);
    return NextResponse.json({ error: "Failed to connect to Jira" }, { status: 502 });
  }
}

function extractPokerSummary(comments: any[]): string | null {
  const reversed = [...comments].reverse();
  for (const comment of reversed) {
    const text = extractTextFromADF(comment.body);
    const tagIndex = text.indexOf("[POKER-SUMMARY]");
    if (tagIndex !== -1) {
      const summary = text.substring(tagIndex + "[POKER-SUMMARY]".length).trim();
      if (summary) return summary;
    }
  }
  return null;
}

function extractTextFromADF(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";

  if (node.content && Array.isArray(node.content)) {
    const parts = node.content.map((child: any) => {
      const text = extractTextFromADF(child);
      if (
        child.type === "paragraph" ||
        child.type === "heading" ||
        child.type === "bulletList" ||
        child.type === "orderedList" ||
        child.type === "listItem" ||
        child.type === "blockquote" ||
        child.type === "codeBlock" ||
        child.type === "rule"
      ) {
        return text + "\n";
      }
      return text;
    });
    return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
  }

  return "";
}
