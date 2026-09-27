import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
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

  /**
   * Deliberately answers with a real 503 (not a 200 carrying
   * `status: "degraded"` in the body) when a dependency is down — an
   * external monitor (UptimeRobot, the keep-alive workflow, Render's own
   * restart-on-failed-health-check) only needs the status code, and a
   * uniform 200 regardless of health would make automated monitoring blind
   * to exactly the failure it exists to catch.
   */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const healthy = database && cache;
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? "ok" : "degraded",
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
