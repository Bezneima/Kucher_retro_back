import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user.type';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (!data) {
      return user;
    }

    return user?.[data];
  },
);
