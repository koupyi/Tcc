import { prisma } from '../config/database';

const buildInclude = {
  owner: { select: { id: true, name: true } },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          salePrice: true,
          isActive: true,
          deletedAt: true,
          categoryId: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stockQty: true,
          isActive: true,
          deletedAt: true,
          images: { take: 1 },
        },
      },
    },
  },
};

export class CommunityBuildRepository {
  async findMany(limit?: number) {
    return prisma.communityBuild.findMany({
      where: { isActive: true },
      include: buildInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findById(id: string) {
    return prisma.communityBuild.findFirst({
      where: { id, isActive: true },
      include: buildInclude,
    });
  }

  async incrementLikes(id: string) {
    return prisma.communityBuild.update({
      where: { id },
      data: { likes: { increment: 1 } },
    });
  }
}

export type CommunityBuildWithItems = NonNullable<
  Awaited<ReturnType<CommunityBuildRepository['findById']>>
>;
