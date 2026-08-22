import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createDatabase,
  validateProductivePassword
} = require('../js/backend/db.js');

const name = String(process.env.BANCUS_BOOTSTRAP_ADMIN_NAME || '').trim();
const email = String(process.env.BANCUS_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.BANCUS_BOOTSTRAP_ADMIN_PASSWORD || '');

if (!name || !email || !password) {
  console.error('Defina BANCUS_BOOTSTRAP_ADMIN_NAME, BANCUS_BOOTSTRAP_ADMIN_EMAIL e BANCUS_BOOTSTRAP_ADMIN_PASSWORD no gerenciador de segredos.');
  process.exit(2);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@bankfratern.local')) {
  console.error('Informe um e-mail produtivo valido; identidades de demonstracao nao sao aceitas.');
  process.exit(2);
}

const policy = validateProductivePassword(password, { name, email });
if (!policy.ok) {
  console.error(policy.message);
  process.exit(2);
}

const database = await Promise.resolve(createDatabase({
  authMode: 'production',
  seedUsers: false
}));

try {
  const existing = await Promise.resolve(database.getUserByEmail(email));
  if (existing) {
    console.error('O administrador informado ja existe. Use o fluxo administrativo de redefinicao de senha.');
    process.exitCode = 3;
  } else {
    const result = await Promise.resolve(database.createUser({
      name,
      email,
      role: 'admin',
      status: 'active',
      department: 'Operacao',
      password,
      mustChangePassword: true
    }));
    if (!result.ok) {
      console.error(result.message || 'Nao foi possivel criar o administrador produtivo.');
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({
        ok: true,
        provider: database.provider,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          mustChangePassword: result.user.mustChangePassword
        }
      }, null, 2));
    }
  }
} finally {
  await Promise.resolve(database.close());
}
