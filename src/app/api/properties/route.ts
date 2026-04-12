import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as { id?: string }).id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const properties = await prisma.property.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(properties);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { name, address, type, rentValue } = await request.json();

    if (!name || !address || !type || rentValue === undefined) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      );
    }

    const property = await prisma.property.create({
      data: {
        name,
        address,
        type,
        rentValue: Number(rentValue),
        userId,
      },
    });

    return NextResponse.json(property, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar imóvel" },
      { status: 500 }
    );
  }
}
