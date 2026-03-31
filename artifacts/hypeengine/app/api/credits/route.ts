import { NextRequest, NextResponse } from "next/server";
import { db, usersTable, transactionsTable } from "@/lib/db";
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
    return forbiddenResponse("Cannot access another user's credits");
  }

  const [user] = await db
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ credits: user.credits ?? 0 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = (await req.json()) as {
    userId: string;
    amount: number;
    type: "add" | "withdraw" | "spend" | "earn";
    description?: string;
  };

  if (session.userId !== body.userId && session.role !== "admin") {
    return forbiddenResponse("Cannot modify another user's credits");
  }

  const [user] = await db
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, body.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const current = user.credits ?? 0;

  if (
    (body.type === "withdraw" || body.type === "spend") &&
    current < Math.abs(body.amount)
  ) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 400 });
  }

  const delta =
    body.type === "add" || body.type === "earn"
      ? body.amount
      : -Math.abs(body.amount);
  const newCredits = current + delta;

  const [updated] = await db
    .update(usersTable)
    .set({ credits: newCredits, updatedAt: new Date() })
    .where(eq(usersTable.id, body.userId))
    .returning({ credits: usersTable.credits });

  const txType =
    body.type === "add"
      ? "deposit"
      : (body.type as "deposit" | "spend" | "earn" | "withdraw");

  const [tx] = await db
    .insert(transactionsTable)
    .values({
      userId: body.userId,
      type: txType,
      amount: body.amount,
      description:
        body.description ?? (body.type === "add" ? "Credits purchased" : "Credits used"),
    })
    .returning();

  return NextResponse.json({
    credits: updated.credits,
    transaction: {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      createdAt: tx.createdAt?.toISOString(),
    },
  });
}
