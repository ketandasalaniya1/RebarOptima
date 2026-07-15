import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private companiesService: CompaniesService,
  ) {}

  async signup(dto: { 
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
  }) {
    const email = dto.email.toLowerCase().trim();
    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create Company
    const company = await this.companiesService.create(dto.companyName, dto.projectName, dto.location);

    // Hash Password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create User (default role to OWNER for the company creator)
    const user = await this.usersService.create({
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role || 'OWNER',
      companyId: company._id as any,
      mobileNumber: dto.mobileNumber,
      promoConsent: !!dto.promoConsent,
      newsletterConsent: !!dto.newsletterConsent
    });

    const userIdStr = user._id.toString();
    const tokens = this.generateTokens(userIdStr, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: userIdStr,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId.toString(),
        companyName: company.name,
      },
    };
  }

  async signin(dto: { email: string; password?: string }) {
    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const company = await this.companiesService.findById(user.companyId.toString());
    const companyName = company ? company.name : 'Unknown Firm';

    const userIdStr = user._id.toString();
    const tokens = this.generateTokens(userIdStr, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: userIdStr,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId.toString(),
        companyName,
      },
    };
  }

  private generateTokens(userId: string, email: string, role: string) {
    const accessSecret = (process.env.JWT_ACCESS_SECRET || 'fallback-access-secret') as jwt.Secret;
    const refreshSecret = (process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret') as jwt.Secret;
    const accessExpiry = (process.env.ACCESS_TOKEN_EXPIRATION || '15m') as any;
    const refreshExpiry = (process.env.REFRESH_TOKEN_EXPIRATION || '7d') as any;

    const accessToken = jwt.sign(
      { sub: userId, email, role },
      accessSecret,
      { expiresIn: accessExpiry },
    );

    const refreshToken = jwt.sign(
      { sub: userId },
      refreshSecret,
      { expiresIn: refreshExpiry },
    );

    return { accessToken, refreshToken };
  }
}

