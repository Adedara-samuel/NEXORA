import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>("REDIS_URL");
        return new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
