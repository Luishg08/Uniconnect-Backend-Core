import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UniconnectLogger } from './uniconnect-logger.singleton';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {

  use(req: Request, res: Response, next: NextFunction): void {
    const logger = UniconnectLogger.getInstance();
    
    logger.info(`${req.method} ${req.originalUrl}`);
    
    next();
  }
}