const { z } = require('zod');

// Formato YYYY-MM (espelha MONTH_KEY_PATTERN em routes/reportDeliveryTracking.js)
const monthKeyRegex = /^\d{4}-\d{2}$/;

const trackingDataSchema = z.object({
    id: z.string().trim().optional(),
    projectId: z.string().trim().min(1, 'projectId e obrigatorio.'),
    monthKey: z.string().regex(monthKeyRegex, 'monthKey deve ter formato YYYY-MM.'),
    status: z.string().optional(),
    deliveredAt: z.string().optional(),
    notes: z.string().optional(),
    reportJobId: z.string().optional(),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const reportDeliveryTrackingCreateSchema = z.object({
    data: trackingDataSchema,
    meta: metaSchema,
});

const reportDeliveryTrackingUpdateSchema = z.object({
    data: trackingDataSchema.partial().extend({
        projectId: z.string().trim().min(1).optional(),
        monthKey: z.string().regex(monthKeyRegex).optional(),
    }),
    meta: metaSchema,
});

module.exports = {
    reportDeliveryTrackingCreateSchema,
    reportDeliveryTrackingUpdateSchema,
};
