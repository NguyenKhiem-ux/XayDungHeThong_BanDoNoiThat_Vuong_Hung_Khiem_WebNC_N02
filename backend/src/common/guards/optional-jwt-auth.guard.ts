import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    // Anonymous product questions stay public; supplied credentials must pass the existing JWT strategy.
    if (!context.switchToHttp().getRequest().headers.authorization) return true;
    return super.canActivate(context);
  }
}
