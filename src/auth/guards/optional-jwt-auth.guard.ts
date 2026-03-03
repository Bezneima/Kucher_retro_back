import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: { message?: string } | undefined,
  ): TUser | null {
    if (user) {
      return user;
    }

    const message = info?.message?.toLowerCase();
    if (!err && (message === 'no auth token' || message === 'no authorization header')) {
      return null;
    }

    if (err instanceof Error) {
      throw err;
    }

    throw new UnauthorizedException();
  }
}
