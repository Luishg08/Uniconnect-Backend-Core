import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables
config();

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

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de roles...');

  // Definir los 3 roles oficiales del sistema
  const officialRoles = ['student', 'admin', 'superadmin'];

  for (const roleName of officialRoles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {}, // No actualizar si ya existe
      create: { name: roleName },
    });

    console.log(`✅ Rol '${role.name}' asegurado en la base de datos (ID: ${role.id_role})`);
  }

  console.log('✅ Sistema de roles estandarizado: student, admin, superadmin');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('✅ Seed completado');
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
