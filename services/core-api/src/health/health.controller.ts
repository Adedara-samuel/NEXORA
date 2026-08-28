import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { Inject } from "@nestjs/common";
import { REDIS_CLIENT } from "../redis/redis.constants";
import type Redis from "ioredis";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check() {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    return {
      status: database && cache ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      dependencies: { database: database ? "up" : "down", redis: cache ? "up" : "down" },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }
}
