import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Headers } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  platformLoginSchema,
  refreshTokenSchema,
  type PlatformLoginInput,
  type RefreshTokenInput,
} from "@nexora/validation";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("platform/login")
  @HttpCode(HttpStatus.OK)
  platformLogin(
    @Body(new ZodValidationPipe(platformLoginSchema)) body: PlatformLoginInput,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.authService.platformLogin(body.email, body.password, { ip, userAgent });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput) {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput) {
    await this.authService.logout(body.refreshToken);
    return { loggedOut: true };
  }
}
