import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [
    totalProperties,
    rentedProperties,
    totalTenants,
    activeContracts,
    pendingPayments,
    overduePayments,
    allPayments,
  ] = await Promise.all([
    prisma.property.count({ where: { userId } }),
    prisma.property.count({ where: { userId, status: "rented" } }),
    prisma.tenant.count({ where: { userId } }),
    prisma.contract.count({ where: { userId, status: "active" } }),
    prisma.payment.count({ where: { userId, status: "pending" } }),
    prisma.payment.count({ where: { userId, status: "overdue" } }),
    prisma.payment.findMany({
      where: { userId, status: "paid" },
      select: { amount: true },
    }),
  ]);

  const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);

  const recentPayments = await prisma.payment.findMany({
    where: { userId },
    include: {
      contract: {
        include: {
          property: true,
          tenant: true,
        },
      },
    },
    orderBy: { dueDate: "desc" },
    take: 5,
  });

  return NextResponse.json({
    totalProperties,
    rentedProperties,
    availableProperties: totalProperties - rentedProperties,
    totalTenants,
    activeContracts,
    pendingPayments,
    overduePayments,
    totalRevenue,
    recentPayments,
  });
}
