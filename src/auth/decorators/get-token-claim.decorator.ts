import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetClaim = createParamDecorator(
  (claimName: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return claimName ? user?.[claimName] : user;
  },
);