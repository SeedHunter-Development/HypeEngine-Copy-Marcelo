import { NextRequest, NextResponse } from "next/server";
import { db, transactionsTable } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getServerSession,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (session.userId !== userId && session.role !== "admin") {
    return forbiddenResponse("Cannot access another user's transactions");
  }

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(transactionsTable.createdAt);

  const sorted = [...txs].sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt ?? 0).getTime()
  );

  return NextResponse.json(
    sorted.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt?.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = (await req.json()) as {
    userId: string;
    type: "deposit" | "spend" | "earn" | "withdraw";
    amount: number;
    description: string;
    campaignId?: string;
  };

  if (session.userId !== body.userId && session.role !== "admin") {
    return forbiddenResponse("Cannot create transactions for another user");
  }

  const [tx] = await db
    .insert(transactionsTable)
    .values({
      userId: body.userId,
      type: body.type,
      amount: body.amount,
      description: body.description,
      campaignId: body.campaignId,
    })
    .returning();

  return NextResponse.json(
    {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      createdAt: tx.createdAt?.toISOString(),
    },
    { status: 201 }
  );
}
