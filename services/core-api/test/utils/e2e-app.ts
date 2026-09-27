import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";

/**
 * Boots the REAL app (every module, every guard, the real Postgres/Redis
 * the dev stack already has running) — no mocking. Phase 12's whole point
 * is proving tenant isolation and RBAC hold across the actual wiring, not a
 * simplified stand-in of it.
 */
export async function createE2eApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

/** Every response is wrapped in { success, data } or { success, error } — see ResponseInterceptor / GlobalExceptionFilter. */
export function data<T = unknown>(response: request.Response): T {
  return response.body.data as T;
}

export function errorCode(response: request.Response): string | undefined {
  return response.body.error?.code;
}

let counter = 0;
/** Unique per test run AND per call, so parallel test files (or reruns without a DB reset) never collide on slug/email uniqueness. */
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}
