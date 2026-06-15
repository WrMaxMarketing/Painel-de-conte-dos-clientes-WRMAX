// Cria um usuario-cliente no Supabase (uso do ADMIN, com service role).
// O `cliente` e o valor do select "Cliente" do Notion (ex.: "Tmax") e fica
// gravado em app_metadata.cliente — que so o service role consegue alterar.
//
// Uso:
//   node --env-file=.env.local scripts/create-client-user.mjs <email> <senha> "<Cliente>"
// Ex.:
//   node --env-file=.env.local scripts/create-client-user.mjs joao@tmax.com Senha123 "Tmax"
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [, , email, password, cliente] = process.argv;

if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}
if (!email || !password || !cliente) {
  console.error('Uso: node --env-file=.env.local scripts/create-client-user.mjs <email> <senha> "<Cliente>"');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // ja ativo, sem precisar confirmar email
  app_metadata: { cliente },
});

if (error) {
  console.error("Erro ao criar usuario:", error.message);
  process.exit(1);
}

console.log(`\nUsuario criado:`);
console.log(`  email:   ${data.user.email}`);
console.log(`  cliente: ${data.user.app_metadata?.cliente}`);
console.log(`  id:      ${data.user.id}\n`);
