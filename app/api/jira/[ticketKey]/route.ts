import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { ticketKey: string } }
) {
  const ticketKey = params.ticketKey.toUpperCase();
  const baseUrl = process.env.JIRA_BASE_URL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const email = process.env.JIRA_EMAIL;
  const debug = request.nextUrl.searchParams.get("debug") === "true";

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
    const comments = fields.comment?.comments || [];
    const pokerSummary = extractPokerSummary(comments);

    const result: any = {
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
    };

    // Debug mode: include raw comment data to diagnose parsing issues
    if (debug) {
      result._debug = {
        commentCount: comments.length,
        comments: comments.map((c: any) => ({
          id: c.id,
          author: c.author?.displayName,
          extractedText: extractTextFromADF(c.body),
          rawBody: c.body,
        })),
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Jira fetch error:", err);
    return NextResponse.json({ error: "Failed to connect to Jira" }, { status: 502 });
  }
}

function extractPokerSummary(comments: any[]): string | null {
  // Search newest comments first
  const reversed = [...comments].reverse();

  for (const comment of reversed) {
    const text = extractTextFromADF(comment.body);

    // Try exact match first
    const exactIndex = text.indexOf("[POKER-SUMMARY]");
    if (exactIndex !== -1) {
      const summary = text.substring(exactIndex + "[POKER-SUMMARY]".length).trim();
      if (summary) return summary;
    }

    // Try without brackets (in case ADF formatting strips them)
    const noBracketIndex = text.indexOf("POKER-SUMMARY");
    if (noBracketIndex !== -1) {
      // Find the end of the tag (skip past any trailing brackets, colons, dashes)
      let endIndex = noBracketIndex + "POKER-SUMMARY".length;
      while (endIndex < text.length && /[\]\s:—\-]/.test(text[endIndex])) {
        endIndex++;
      }
      const summary = text.substring(endIndex).trim();
      if (summary) return summary;
    }

    // Try case-insensitive
    const lowerText = text.toLowerCase();
    const ciIndex = lowerText.indexOf("poker-summary");
    if (ciIndex !== -1) {
      let endIndex = ciIndex + "poker-summary".length;
      // Skip past tag wrapper chars
      while (endIndex < text.length && /[\[\]\s:—\-]/.test(text[endIndex])) {
        endIndex++;
      }
      const summary = text.substring(endIndex).trim();
      if (summary) return summary;
    }
  }

  return null;
}

function extractTextFromADF(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";

  // Handle inline cards (Jira links, mentions, etc.)
  if (node.type === "inlineCard") return "";
  if (node.type === "mention") return node.attrs?.text || "";
  if (node.type === "emoji") return node.attrs?.shortName || "";
  if (node.type === "hardBreak") return "\n";

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
