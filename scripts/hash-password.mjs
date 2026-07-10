// Gera um hash bcrypt (cost 10, compatível com o Spring Security do backend)
// a partir de uma senha digitada no terminal. Uso ÚNICO: repor a senha do
// admin direto na base (campo users.password_hash no Railway) quando não há
// email de recuperação.
//
//   cd fittrainly-app
//   node scripts/hash-password.mjs
//
// A senha é lida do stdin (não vai para argv nem para o histórico do shell).
// Copie a linha "HASH:" para o campo password_hash e grave. Login passa a
// funcionar com a senha que você digitou aqui.
import bcrypt from 'bcryptjs'
import readline from 'node:readline'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Nova senha do admin: ', (senha) => {
  const pwd = senha.trim()
  if (pwd.length < 8) {
    console.error('\n⚠️  Use pelo menos 8 caracteres. Nada foi gerado.')
    rl.close()
    process.exit(1)
  }
  const hash = bcrypt.hashSync(pwd, 10)
  console.log('\n──────────────────────────────────────────────')
  console.log('HASH (cole no campo password_hash do Railway):')
  console.log(hash)
  console.log('──────────────────────────────────────────────')
  console.log('Depois, faça login com a senha que você acabou de digitar.')
  rl.close()
})
