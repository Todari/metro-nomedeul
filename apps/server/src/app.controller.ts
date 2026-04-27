import { Controller, Get, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Res } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health(@Res() res: Response) {
    const timestamp = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(HttpStatus.OK).json({
        status: 'ok',
        db: 'ok',
        timestamp,
      });
    } catch (error) {
      this.logger.error(
        `Health check DB failure: ${error instanceof Error ? error.message : String(error)}`,
      );
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'degraded',
        db: 'error',
        timestamp,
      });
    }
  }
}
