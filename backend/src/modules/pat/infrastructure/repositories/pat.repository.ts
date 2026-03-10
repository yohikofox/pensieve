import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalAccessToken } from '../../domain/entities/personal-access-token.entity';

@Injectable()
export class PatRepository {
  constructor(
    @InjectRepository(PersonalAccessToken)
    private readonly repo: Repository<PersonalAccessToken>,
  ) {}

  async save(pat: PersonalAccessToken): Promise<PersonalAccessToken> {
    return this.repo.save(pat);
  }

  async findByHash(tokenHash: string): Promise<PersonalAccessToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async findByUserId(userId: string): Promise<PersonalAccessToken[]> {
    return this.repo.find({ where: { userId } });
  }

  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<PersonalAccessToken | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async update(pat: PersonalAccessToken): Promise<PersonalAccessToken> {
    return this.repo.save(pat);
  }
}
