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

  const payments = await prisma.payment.findMany({
    where: { userId },
    include: {
      contract: {
        include: {
          property: true,
          tenant: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(payments);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { dueDate, amount, contractId } = await request.json();

    if (!dueDate || !amount || !contractId) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        dueDate: new Date(dueDate),
        amount: Number(amount),
        contractId,
        userId,
      },
      include: {
        contract: {
          include: {
            property: true,
            tenant: true,
          },
        },
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar pagamento" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID e status são obrigatórios" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.update({
      where: { id, userId },
      data: {
        status,
        paidAt: status === "paid" ? new Date() : null,
      },
      include: {
        contract: {
          include: {
            property: true,
            tenant: true,
          },
        },
      },
    });

    return NextResponse.json(payment);
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar pagamento" },
      { status: 500 }
    );
  }
}
