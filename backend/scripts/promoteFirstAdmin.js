#!/usr/bin/env node
/**
 * Promove o primeiro admin do sistema por email.
 * Uso: node backend/scripts/promoteFirstAdmin.js l1ma@live.com
 */

const { getCollection } = require('../utils/firebaseSetup');

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Uso: node backend/scripts/promoteFirstAdmin.js <email>');
        process.exit(1);
    }

    const snapshot = await getCollection('users').where('email', '==', email).get();

    if (snapshot.empty) {
        console.error(`Nenhum utilizador encontrado com email: ${email}`);
        process.exit(1);
    }

    for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`Encontrado: id=${doc.id}, perfil=${data.perfil}, status=${data.status}`);

        await doc.ref.set(
            {
                perfil: 'Administrador',
                status: 'Ativo',
                updatedAt: new Date().toISOString(),
                updatedBy: 'promoteFirstAdmin-script',
            },
            { merge: true },
        );

        console.log(`Promovido: id=${doc.id} → perfil=Administrador, status=Ativo`);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('Erro:', err);
    process.exit(1);
});
