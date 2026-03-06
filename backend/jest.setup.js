jest.mock('./utils/firebaseSetup', () => {
    const db = new Map();

    const deepClone = (value) => JSON.parse(JSON.stringify(value || {}));

    const makeKey = (collectionName, docId) => `${String(collectionName)}:${String(docId)}`;

    const getCollectionDocs = (collectionName) => {
        const prefix = `${String(collectionName)}:`;
        const docs = [];
        db.forEach((value, key) => {
            if (!key.startsWith(prefix)) return;
            const id = key.slice(prefix.length);
            docs.push({
                id,
                data: () => deepClone(value),
            });
        });
        docs.sort((a, b) => a.id.localeCompare(b.id));
        return docs;
    };

    const createDocRef = (collectionName, docId) => ({
        get: jest.fn(async () => {
            const key = makeKey(collectionName, docId);
            const value = db.get(key);
            return {
                exists: value !== undefined,
                id: String(docId),
                data: () => deepClone(value),
            };
        }),
        set: jest.fn(async (payload, options = {}) => {
            const key = makeKey(collectionName, docId);
            const current = db.get(key);
            if (options && options.merge && current && typeof current === 'object') {
                db.set(key, { ...deepClone(current), ...deepClone(payload) });
                return;
            }
            db.set(key, deepClone(payload));
        }),
        delete: jest.fn(async () => {
            const key = makeKey(collectionName, docId);
            db.delete(key);
        }),
    });

    const createCollectionRef = (collectionName) => ({
        get: jest.fn(async () => ({
            docs: getCollectionDocs(collectionName),
        })),
        doc: jest.fn((docId) => createDocRef(collectionName, docId)),
    });

    const getDb = jest.fn(() => ({
        collection: jest.fn((name) => {
            if (String(name) === 'shared') {
                return {
                    doc: jest.fn(() => ({
                        collection: jest.fn((collectionName) => createCollectionRef(collectionName)),
                    })),
                };
            }
            return createCollectionRef(name);
        }),
    }));

    const getCollection = jest.fn((collectionName) => createCollectionRef(collectionName));
    const getDocRef = jest.fn((collectionName, docId) => createDocRef(collectionName, docId));

    const __resetMockDb = () => db.clear();

    return {
        getDb,
        getCollection,
        getDocRef,
        initFirebase: jest.fn(),
        getAuth: jest.fn(),
        __resetMockDb,
    };
});

jest.mock('./utils/authMiddleware', () => ({
    verifyToken: (req, res, next) => {
        const authHeader = String(req.headers?.authorization || '');
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'Token nao informado',
            });
        }

        req.user = {
            uid: 'test-admin-123',
            email: 'admin@test.com',
        };
        next();
    },
    requireActiveUser: (req, res, next) => { req.userProfile = { status: 'Ativo', perfil: 'Admin' }; next(); },
    requireEditor: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
}));

const { __resetMockDb } = require('./utils/firebaseSetup');

beforeEach(() => {
    __resetMockDb();
});
