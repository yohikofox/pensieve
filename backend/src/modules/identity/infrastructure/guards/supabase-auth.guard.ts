import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_ANON_KEY') || '',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      console.log('❌ Auth failed: No authorization header');
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // Verify token with Supabase
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser(token);

      if (error) {
        console.log('❌ Auth failed: Supabase error:', error.message);
        throw new UnauthorizedException(`Invalid token: ${error.message}`);
      }

      if (!user) {
        console.log('❌ Auth failed: No user returned');
        throw new UnauthorizedException('Invalid token: no user');
      }

      // Inject user into request
      request.user = user;
      console.log(`✅ Auth successful: ${user.email} (${user.id})`);

      return true;
    } catch (error: any) {
      console.log('❌ Auth failed: Exception:', error.message);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
