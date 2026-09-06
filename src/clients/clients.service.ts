import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClientDto, UpdateClientDto } from "./dto/client.dto";
@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}
  async findAll(
    assignedUserId?: string,
    region?: string,
    clientType?: string,
    search?: string,
    archived = false,
  ) {
    return this.prisma.client.findMany({
      where: {
        isArchived: archived,
        ...(assignedUserId && { assignedUserId }),
        ...(region && { region }),
        ...(clientType && { clientType: clientType as any }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        commercial: { select: { firstName: true, lastName: true } },
        _count: { select: { orders: true, visits: true } },
        clientScore: true,
      },
      orderBy: { name: "asc" },
    });
  }
  async findOne(id: string) {
    const c = await this.prisma.client.findUnique({
      where: { id },
      include: {
        commercial: { select: { id: true, firstName: true, lastName: true } },
        orders: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { items: { include: { product: true } } },
        },
        visits: { take: 5, orderBy: { scheduledAt: "desc" } },
        clientScore: true,
        aiInsights: { take: 5, orderBy: { createdAt: "desc" } },
      },
    });
    if (!c) throw new NotFoundException("Client introuvable");
    return c;
  }
  async create(dto: CreateClientDto) {
    return this.prisma.client.create({
      data: dto as any,
      include: { commercial: { select: { firstName: true, lastName: true } } },
    });
  }
  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: dto as any,
      include: { commercial: { select: { firstName: true, lastName: true } } },
    });
  }
  async remove(id: string) {
    return this.archive(id);
  }
  async archive(id: string) {
    await this.findOne(id);
    const archivedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id },
        data: { isArchived: true, isActive: false, archivedAt },
      }),
      this.prisma.saleOrder.updateMany({
        where: { clientId: id },
        data: { isArchived: true, archivedAt },
      }),
    ]);
    return this.findOne(id);
  }
  async restore(id: string) {
    await this.prisma.client.update({
      where: { id },
      data: { isArchived: false, isActive: true, archivedAt: null },
    });
    await this.prisma.saleOrder.updateMany({
      where: { clientId: id },
      data: { isArchived: false, archivedAt: null },
    });
    return this.findOne(id);
  }
  async deleteArchived(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { isArchived: true },
    });
    if (!client) throw new NotFoundException("Client introuvable");
    if (!client.isArchived)
      throw new BadRequestException(
        "Le client doit être archivé avant suppression définitive",
      );
    await this.prisma.$transaction(async (tx) => {
      const orders = await tx.saleOrder.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const orderIds = orders.map((order) => order.id);
      if (orderIds.length)
        await tx.saleOrderItem.deleteMany({
          where: { orderId: { in: orderIds } },
        });
      await tx.saleOrder.deleteMany({ where: { clientId: id } });
      await tx.visit.deleteMany({ where: { clientId: id } });
      await tx.client.delete({ where: { id } });
    });
    return { deleted: true };
  }
  async getStats() {
    const [total, active, byType, byRegion] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.client.groupBy({ by: ["clientType"], _count: true }),
      this.prisma.client.groupBy({
        by: ["region"],
        _count: true,
        where: { region: { not: null } },
      }),
    ]);
    return { total, active, byType, byRegion };
  }
}
