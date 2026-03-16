import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Configurar el pool de conexiones igual que en PrismaService
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

const prisma = new PrismaClient({
  adapter,
});

async function cleanOldInvitationsAndRequests() {
  console.log('🧹 Limpiando invitaciones y solicitudes antiguas...');

  try {
    // Limpiar invitaciones antiguas rechazadas o aceptadas (>30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cleanedOldInvitations = await prisma.group_invitation.deleteMany({
      where: {
        status: { in: ['rejected', 'accepted'] },
        responded_at: { lt: thirtyDaysAgo },
      },
    });

    console.log(`✅ Limpiadas ${cleanedOldInvitations.count} invitaciones antiguas`);

    // Limpiar solicitudes antiguas rechazadas o aceptadas (>30 días)
    const cleanedOldRequests = await prisma.group_join_request.deleteMany({
      where: {
        status: { in: ['rejected', 'accepted'] },
        responded_at: { lt: thirtyDaysAgo },
      },
    });

    console.log(`✅ Limpiadas ${cleanedOldRequests.count} solicitudes antiguas`);

    // Limpiar invitaciones pendientes muy antiguas (>90 días)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const cleanedOldPendingInvitations = await prisma.group_invitation.deleteMany({
      where: {
        status: 'pending',
        invited_at: { lt: ninetyDaysAgo },
      },
    });

    console.log(`✅ Limpiadas ${cleanedOldPendingInvitations.count} invitaciones pendientes antiguas`);

    // Limpiar solicitudes pendientes muy antiguas (>90 días)
    const cleanedOldPendingRequests = await prisma.group_join_request.deleteMany({
      where: {
        status: 'pending',
        requested_at: { lt: ninetyDaysAgo },
      },
    });

    console.log(`✅ Limpiadas ${cleanedOldPendingRequests.count} solicitudes pendientes antiguas`);

  } catch (error) {
    console.error('❌ Error durante limpieza:', error);
    throw error;
  }
}

async function main() {
  try {
    await cleanOldInvitationsAndRequests();
    console.log('✨ Limpieza completada exitosamente');
  } catch (error) {
    console.error('❌ Error durante limpieza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

export { cleanOldInvitationsAndRequests };