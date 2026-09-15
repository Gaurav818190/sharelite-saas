import { NextResponse } from "next/server";

import {
  createLeads,
  listLeads,
  requireAuthenticatedUser,
  type LeadInput,
} from "@/lib/supabase-db";

import {
  getCurrentEntitlements,
  hasCapacity,
} from "@/lib/monetization";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CsvRow = {
  name: string;
  email: string;
  company: string | null;
  website: string | null;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());

  return values;
}

function parseCsv(csv: string): CsvRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.toLowerCase().trim()
  );

  const nameIndex = headers.indexOf("name");
  const emailIndex = headers.indexOf("email");
  const companyIndex = headers.indexOf("company");
  const websiteIndex = headers.indexOf("website");

  if (nameIndex === -1 || emailIndex === -1) {
    throw new Error("CSV must contain name and email columns.");
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    return {
      name: values[nameIndex]?.trim() ?? "",
      email: values[emailIndex]?.trim().toLowerCase() ?? "",
      company:
        companyIndex >= 0
          ? values[companyIndex]?.trim() || null
          : null,
      website:
        websiteIndex >= 0
          ? values[websiteIndex]?.trim() || null
          : null,
    };
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a CSV file." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported." },
        { status: 400 }
      );
    }

    const csv = await file.text();
    const rows = parseCsv(csv);

    const { user, accessToken } = await requireAuthenticatedUser();

    const [existingLeads, entitlements] = await Promise.all([
      listLeads(accessToken),
      getCurrentEntitlements(accessToken, user.id),
    ]);

    const existingEmails = new Set(
      existingLeads.map((lead) => lead.email.toLowerCase())
    );

    const fileEmails = new Set<string>();
    const validRows: LeadInput[] = [];
    let invalid = 0;
    let duplicates = 0;

    for (const row of rows) {
      if (
        !row.name ||
        row.name.length > 200 ||
        !row.email ||
        row.email.length > 320 ||
        !emailPattern.test(row.email)
      ) {
        invalid += 1;
        continue;
      }

      if (
        existingEmails.has(row.email) ||
        fileEmails.has(row.email)
      ) {
        duplicates += 1;
        continue;
      }

      fileEmails.add(row.email);

      validRows.push({
        name: row.name,
        email: row.email,
        company: row.company,
        website: row.website,
        status: "new",
        source: "csv-import",
      });
    }

    const available = entitlements.limits.leads - existingLeads.length;

    if (available <= 0) {
      return NextResponse.json(
        {
          error: "Lead limit reached for your plan.",
          imported: 0,
          invalid,
          duplicates,
        },
        { status: 403 }
      );
    }

    const rowsToInsert = validRows.slice(0, available);

    if (!hasCapacity(entitlements.plan, "leads", existingLeads.length)) {
      return NextResponse.json(
        {
          error: "Lead limit reached for your plan.",
          imported: 0,
          invalid,
          duplicates,
        },
        { status: 403 }
      );
    }

    const inserted = rowsToInsert.length
      ? await createLeads(accessToken, user.id, rowsToInsert)
      : [];

    return NextResponse.json({
      imported: inserted.length,
      invalid,
      duplicates,
      skippedByLimit: Math.max(0, validRows.length - rowsToInsert.length),
      leads: inserted,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("CSV must contain")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("CSV lead import failed", error);

    return NextResponse.json(
      { error: "Unable to import CSV leads." },
      { status: 500 }
    );
  }
}