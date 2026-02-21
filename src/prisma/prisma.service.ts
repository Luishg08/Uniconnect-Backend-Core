import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private pool: Pool;

    constructor() {
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL,
            max: 20, 
            idleTimeoutMillis: 30000, 
            connectionTimeoutMillis: 10000,
            allowExitOnIdle: false,
            ssl: {
                rejectUnauthorized: false,
            },
        });

        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
        
        const adapter = new PrismaPg(pool);
        
        super({
            adapter,
        });

        this.pool = pool;
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('Database connected successfully');
        } catch (error) {
            this.logger.error('Failed to connect to database', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }

}
