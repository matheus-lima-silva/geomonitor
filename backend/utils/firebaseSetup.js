const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db;

const BASE_PATH = ['shared', 'geomonitor'];

function initFirebase() {
    if (admin.apps.length > 0) {
        return;
    }

    let serviceAccount = null;

    // 1) Try env var first (Fly.io / cloud deployment)
    const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (envJson) {
        try {
            serviceAccount = JSON.parse(envJson);
            console.log('[Geomonitor API] Firebase credentials loaded from FIREBASE_SERVICE_ACCOUNT_JSON env var.');
        } catch (parseError) {
            console.error('[Geomonitor API] ERRO: Falha ao parsear FIREBASE_SERVICE_ACCOUNT_JSON:', parseError.message);
        }
    }

    // 2) Fall back to file (local development)
    if (!serviceAccount) {
        const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            try {
                serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
                console.log('[Geomonitor API] Firebase credentials loaded from serviceAccountKey.json file.');
            } catch (fileError) {
                console.error('[Geomonitor API] Erro ao carregar serviceAccountKey.json:', fileError.message);
            }
        }
    }

    if (!serviceAccount) {
        console.error('[Geomonitor API] ERRO: Nenhuma credencial Firebase encontrada. Defina FIREBASE_SERVICE_ACCOUNT_JSON ou coloque serviceAccountKey.json na pasta backend/.');
        return;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        console.log('[Geomonitor API] Firebase Admin SDK inicializado com sucesso (Firestore only).');
    } catch (error) {
        console.error('[Geomonitor API] Erro ao inicializar Firebase Admin:', error);
    }
}

function getDb() {
    if (!db) {
        initFirebase();
    }
    return db;
}

function getCollection(colName) {
    const firestore = getDb();
    return firestore.collection(BASE_PATH[0]).doc(BASE_PATH[1]).collection(colName);
}

function getDocRef(colName, docId) {
    return getCollection(colName).doc(docId);
}

module.exports = {
    initFirebase,
    getDb,
    getCollection,
    getDocRef,
    admin
};
