#!/usr/bin/env node
/**
 * Migra usuários do Firebase Authentication para a tabela auth_credentials (PostgreSQL).
 *
 * Uso:
 *   node backend/scripts/migrateFirebaseUsers.js
 *
 * Requer as variáveis de ambiente:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON ou serviceAccountKey.json
 *   - DATABASE_URL / POSTGRES_URL
 *   - FRONTEND_URL (para montar o link de reset no email)
 *   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (opcional — para envio de email)
 *
 * Cada usuário migrado recebe password_hash = 'MIGRATION_PENDING',
 * o que obriga a redefinir a senha no primeiro login.
 *
 * Emails de reset são enviados APENAS para usuários que fizeram login
 * nos últimos 2 dias (lastSignInTime).
 */

require('dotenv').config();
const { initFirebase, admin } = require('../utils/firebaseSetup');
const postgresStore = require('../data/postgresStore');
const authCredentials = require('../repositories/authCredentialsRepository');
const { getMailTransport, sendMigrationResetEmail } = require('../utils/mailer');
const crypto = require('crypto');

const MIGRATION_PENDING_HASH = 'MIGRATION_PENDING';
const RESET_TOKEN_EXPIRY_HOURS = 48;
const RECENT_LOGIN_THRESHOLD_DAYS = 2;

async function listAllFirebaseUsers() {
    const users = [];
    let nextPageToken;

    do {
        const result = await admin.auth().listUsers(1000, nextPageToken);
        users.push(...result.users);
        nextPageToken = result.pageToken;
    } while (nextPageToken);

    return users;
}

function hadRecentLogin(fbUser) {
    const lastSignIn = fbUser.metadata?.lastSignInTime;
    if (!lastSignIn) return false;
    const thresholdMs = RECENT_LOGIN_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - new Date(lastSignIn).getTime() <= thresholdMs;
}

async function run() {
    initFirebase();

    const transport = getMailTransport();
    if (!transport) {
        console.warn('[migrate] SMTP não configurado — emails de reset NÃO serão enviados.');
    }

    console.log('[migrate] Listando usuários do Firebase Auth...');
    const firebaseUsers = await listAllFirebaseUsers();
    console.log(`[migrate] ${firebaseUsers.length} usuário(s) encontrado(s) no Firebase Auth.`);

    let created = 0;
    let skipped = 0;
    let emailsSent = 0;
    let errors = 0;

    for (const fbUser of firebaseUsers) {
        const userId = fbUser.uid;
        const email = (fbUser.email || '').trim().toLowerCase();

        if (!email) {
            console.warn(`[migrate] Pulando usuário ${userId}: sem email.`);
            skipped++;
            continue;
        }

        try {
            const existing = await postgresStore.query(
                'SELECT user_id FROM auth_credentials WHERE user_id = $1 OR LOWER(email) = LOWER($2)',
                [userId, email],
            );

            if (existing.rows.length > 0) {
                console.log(`[migrate] Já existe: ${email} (${userId}) — pulando.`);
                skipped++;
                continue;
            }

            await postgresStore.query(
                `INSERT INTO auth_credentials (user_id, email, password_hash)
                 VALUES ($1, $2, $3)`,
                [userId, email, MIGRATION_PENDING_HASH],
            );

            console.log(`[migrate] Criado: ${email} (${userId})`);
            created++;

            // Envia email de reset apenas para quem logou nos últimos 2 dias
            if (transport && hadRecentLogin(fbUser)) {
                try {
                    const resetToken = crypto.randomBytes(32).toString('hex');
                    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
                    await authCredentials.setResetToken(email, resetToken, expiresAt);
                    await sendMigrationResetEmail(transport, email, resetToken, RESET_TOKEN_EXPIRY_HOURS);
                    console.log(`[migrate] Email enviado: ${email} (último login: ${fbUser.metadata?.lastSignInTime})`);
                    emailsSent++;
                } catch (emailErr) {
                    console.error(`[migrate] Falha ao enviar email para ${email}:`, emailErr.message);
                }
            } else if (transport) {
                const lastSignIn = fbUser.metadata?.lastSignInTime || 'nunca';
                console.log(`[migrate] Sem email (login inativo): ${email} — último login: ${lastSignIn}`);
            }
        } catch (err) {
            console.error(`[migrate] Erro ao migrar ${email} (${userId}):`, err.message);
            errors++;
        }
    }

    console.log(`\n[migrate] Concluído: ${created} criado(s), ${emailsSent} email(s) enviado(s), ${skipped} pulado(s), ${errors} erro(s).`);
    process.exit(errors > 0 ? 1 : 0);
}

run().catch((err) => {
    console.error('[migrate] Erro fatal:', err);
    process.exit(1);
});
