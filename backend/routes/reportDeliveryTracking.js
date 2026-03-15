const createCrudRouter = require('../utils/crudFactory');

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const router = createCrudRouter('reportDeliveryTracking', {
    routerName: 'report-delivery-tracking',
    generateId: (data) => {
        const projectId = String(data.projectId || '').trim();
        const monthKey = String(data.monthKey || '').trim();
        if (!projectId || !MONTH_KEY_PATTERN.test(monthKey)) return '';
        return `${projectId}__${monthKey}`;
    },
});

module.exports = router;