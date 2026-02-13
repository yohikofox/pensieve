import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../../domain/entities/admin-user.entity';

@Injectable()
export class AdminUserRepository {
  constructor(
    @InjectRepository(AdminUser)
    private readonly repository: Repository<AdminUser>,
  ) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findSuperAdmin(): Promise<AdminUser | null> {
    return this.repository.findOne({ where: { isSuperAdmin: true } });
  }

  async save(admin: AdminUser): Promise<AdminUser> {
    return this.repository.save(admin);
  }

  create(data: Partial<AdminUser>): AdminUser {
    return this.repository.create(data);
  }

  async findOne(options: any): Promise<AdminUser | null> {
    return this.repository.findOne(options);
  }

  async find(options?: any): Promise<AdminUser[]> {
    return this.repository.find(options);
  }

  async remove(admin: AdminUser): Promise<AdminUser> {
    return this.repository.remove(admin);
  }
}
