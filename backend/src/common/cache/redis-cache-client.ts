/**
 * RedisCacheClient — Implémentation Redis de ICacheClient
 *
 * ADR-027: Cache distribué pour données référentielles.
 * Pattern calqué sur RedisProgressStore.
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import type { ICacheClient } from './i-cache-client.interface';

@Injectable()
export class RedisCacheClient
  implements ICacheClient, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCacheClient.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.client = createClient({ url: redisUrl }) as RedisClientType;

    this.client.on('error', (err) => {
      this.logger.error('Redis CacheClient connection error:', err);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('✓ Redis CacheClient connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis CacheClient disconnected');
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (data === null) return null;
    return JSON.parse(data) as T;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const results = await this.client.mGet(keys);
    return results.map((data) =>
      data === null ? null : (JSON.parse(data) as T),
    );
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.client.set(key, JSON.stringify(value));
  }

  async mset<T>(entries: { key: string; value: T }[]): Promise<void> {
    if (entries.length === 0) return;
    const pairs = entries.flatMap(({ key, value }) => [
      key,
      JSON.stringify(value),
    ]);
    await this.client.mSet(pairs);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
