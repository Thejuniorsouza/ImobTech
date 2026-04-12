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

  const tenants = await prisma.tenant.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tenants);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { name, email, phone, document } = await request.json();

    if (!name || !email || !phone || !document) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        email,
        phone,
        document,
        userId,
      },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar inquilino" },
      { status: 500 }
    );
  }
}
