import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

const CORS = { origin: true, credentials: true };

@Controller('auth')
export class AuthController {
  @Get('profile')
  getProfile(@Res() res: Response) {
    return res.json({ ok: true });
  }
}

export const corsConfig = CORS;
export const dbConfig = { synchronize: true };
