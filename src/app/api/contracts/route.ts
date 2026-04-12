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

  const contracts = await prisma.contract.findMany({
    where: { userId },
    include: {
      property: true,
      tenant: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(contracts);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { startDate, endDate, rentValue, propertyId, tenantId } =
      await request.json();

    if (!startDate || !endDate || !rentValue || !propertyId || !tenantId) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        rentValue: Number(rentValue),
        propertyId,
        tenantId,
        userId,
      },
      include: {
        property: true,
        tenant: true,
      },
    });

    // Update property status to rented
    await prisma.property.update({
      where: { id: propertyId },
      data: { status: "rented" },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar contrato" },
      { status: 500 }
    );
  }
}
