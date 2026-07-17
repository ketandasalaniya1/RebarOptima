import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: {
      email: string;
      password?: string;
      firstName: string;
      lastName: string;
      role: string;
      companyName: string;
      projectName: string;
      location: string;
      mobileNumber: string;
      promoConsent?: boolean;
      newsletterConsent?: boolean;
    },
  ) {
    return this.authService.signup(dto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() dto: { email: string; password?: string },
  ) {
    return this.authService.signin(dto);
  }
}
