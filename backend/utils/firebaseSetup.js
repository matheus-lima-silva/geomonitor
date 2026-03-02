const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db;
let auth;

function initFirebase() {
    if (admin.apps.length > 0) {
        return;
    }

    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

    if (!fs.existsSync(serviceAccountPath)) {
        console.error('[Geomonitor API] ERRO: Arquivo serviceAccountKey.json não encontrado na raiz da pasta backend/. O Firebase Admin não pode ser inicializado.');
        return;
    }

    try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        auth = admin.auth();
        console.log('[Geomonitor API] Firebase Admin SDK inicializado com sucesso.');
    } catch (error) {
        console.error('[Geomonitor API] Erro ao carregar serviceAccountKey.json:', error);
    }
}

function getDb() {
    if (!db) {
        initFirebase();
    }
    return db;
}

function getAuth() {
    if (!auth) {
        initFirebase();
    }
    return auth;
}

module.exports = {
    initFirebase,
    getDb,
    getAuth,
    admin
};
