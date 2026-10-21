import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAddress } from '../database/entities/user-address.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(@InjectRepository(UserAddress) private readonly addresses: Repository<UserAddress>) {}

  // ponytail: address writes assume one request per user at a time; add a row lock if concurrent writes become common.

  list(userId: number) {
    return this.addresses.find({
      where: { userId },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  create(userId: number, dto: CreateAddressDto) {
    return this.addresses.manager.transaction(async (manager) => {
      const addresses = manager.getRepository(UserAddress);
      const isDefault = dto.isDefault === true || !(await addresses.existsBy({ userId }));
      if (isDefault) await addresses.update({ userId }, { isDefault: false });
      return addresses.save(addresses.create({ ...dto, userId, isDefault }));
    });
  }

  update(userId: number, id: number, dto: UpdateAddressDto) {
    return this.addresses.manager.transaction(async (manager) => {
      const addresses = manager.getRepository(UserAddress);
      const address = await addresses.findOne({ where: { id, userId } });
      if (!address) throw new NotFoundException('Khong tim thay dia chi');

      const isDefault = address.isDefault || dto.isDefault === true;
      if (dto.isDefault === true) await addresses.update({ userId }, { isDefault: false });
      Object.assign(address, dto, { isDefault });
      return addresses.save(address);
    });
  }

  remove(userId: number, id: number, expected?: Pick<UserAddress, 'fullName' | 'phone' | 'address' | 'isDefault'>) {
    return this.addresses.manager.transaction(async (manager) => {
      const addresses = manager.getRepository(UserAddress);
      const address = await addresses.findOne({ where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!address) throw new NotFoundException('Khong tim thay dia chi');

      if (expected && (Object.keys(expected) as Array<keyof typeof expected>).some(key => address[key] !== expected[key])) {
        throw new BadRequestException('Địa chỉ đã thay đổi. Hãy xem lại và yêu cầu xóa lần nữa.');
      }

      await addresses.remove(address);
      if (address.isDefault) {
        const replacement = await addresses.findOne({ where: { userId }, order: { updatedAt: 'DESC' } });
        if (replacement) await addresses.save(Object.assign(replacement, { isDefault: true }));
      }
      return { message: 'Da xoa dia chi' };
    });
  }
}
