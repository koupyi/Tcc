import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { CreateAddressInput, UpdateAddressInput } from '../validators/address.validator';

export class AddressService {
  async list(userId: string) {
    return prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, input: CreateAddressInput) {
    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: { ...input, userId },
    });
  }

  async update(userId: string, addressId: string, input: UpdateAddressInput) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });
    if (!address) throw AppError.notFound('Endereço não encontrado');

    if (input.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id: addressId },
      data: input,
    });
  }

  async delete(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });
    if (!address) throw AppError.notFound('Endereço não encontrado');

    return prisma.address.update({
      where: { id: addressId },
      data: { deletedAt: new Date() },
    });
  }

  async getById(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });
    if (!address) throw AppError.notFound('Endereço não encontrado');
    return address;
  }
}
