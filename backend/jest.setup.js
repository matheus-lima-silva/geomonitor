jest.mock('./utils/firebaseSetup', () => {
    // A fake Firestore Database implementation in memory
    const getDb = jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve({
                    exists: false,
                    data: () => null
                })),
                set: jest.fn(() => Promise.resolve()),
                delete: jest.fn(() => Promise.resolve())
            })),
            get: jest.fn(() => Promise.resolve({
                docs: []
            }))
        }))
    }));

    return {
        getDb,
        initFirebase: jest.fn(),
        getAuth: jest.fn()
    };
});

// Mock the Auth Middleware to always assume the user is authenticated
jest.mock('./utils/authMiddleware', () => {
    return {
        verifyToken: (req, res, next) => {
            // Fake authorized user
            req.user = {
                uid: 'test-admin-123',
                email: 'admin@test.com'
            };
            next();
        }
    };
});
