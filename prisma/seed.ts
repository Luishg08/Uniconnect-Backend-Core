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

  // Check if 'user' role exists
  const userRole = await prisma.role.findFirst({ where: { name: 'user' } });
  
  if (userRole) {
    console.log(`✅ Rol 'user' ya existe en la base de datos (ID: ${userRole.id_role})`);
    return;
  }

  // Create 'user' role if it doesn't exist
  const newRole = await prisma.role.create({
    data: {
      name: 'user',
    },
  });

  console.log('✅ Rol creado exitosamente:');
  console.log(`   - ${newRole.name} (ID: ${newRole.id_role})`);
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
