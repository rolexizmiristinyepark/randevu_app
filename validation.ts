/**
 * validation.ts
 *
 * Zod validation schemas for runtime type safety
 * Complements types.ts with runtime validation
 */

import { z } from 'zod';
import type {
    DayStatus,
    TimeSlot,
    Settings,
    GoogleCalendarEvent,
} from './types';

// ==================== PRIMITIVE SCHEMAS ====================

export const ShiftTypeSchema = z.enum(['morning', 'evening', 'full']);

export const AppointmentTypeSchema = z.enum(['delivery', 'service', 'consultation', 'general', 'management', 'meeting', 'shipping']);

// ==================== STAFF SCHEMAS ====================

export const StaffSchema = z.object({
    id: z.union([z.number(), z.string()]),
    personel_id: z.string().optional(),
    name: z.string().min(1),
    phone: z.union([z.string(), z.number()]),
    email: z.string().optional(),
    role: z.string().optional(),
    is_admin: z.boolean().optional(),
    is_vip: z.boolean().optional(),
    active: z.boolean(),
    permissions: z.record(z.unknown()).optional(),
});

export const StaffArraySchema = z.array(StaffSchema);

// ==================== TIME SLOT SCHEMAS ====================

export const TimeSlotSchema = z.object({
    start: z.string(),
    end: z.string(),
    hour: z.number().int().min(0).max(23),
    time: z.string(),
}) satisfies z.ZodType<TimeSlot>;

export const TimeSlotsArraySchema = z.array(TimeSlotSchema);

// ==================== DAY STATUS SCHEMAS ====================

export const DayStatusSchema = z.object({
    isDeliveryMaxed: z.boolean(),
    availableHours: z.array(z.number()),
    unavailableHours: z.array(z.number()),
    deliveryCount: z.number().optional(),
}) satisfies z.ZodType<DayStatus>;

// ==================== SETTINGS SCHEMAS ====================

export const SettingsSchema = z.object({
    interval: z.number().optional(),
    maxDaily: z.number().optional(),
}) satisfies z.ZodType<Settings>;

// ==================== CALENDAR EVENT SCHEMAS ====================

export const GoogleCalendarEventSchema = z.object({
    summary: z.string().optional(),
    start: z.object({
        dateTime: z.string().optional(),
        time: z.string().optional(),
    }).optional(),
    extendedProperties: z.object({
        private: z.object({
            appointmentType: z.string().optional(),
        }).optional(),
    }).optional(),
}) satisfies z.ZodType<GoogleCalendarEvent>;

export const GoogleCalendarEventsArraySchema = z.array(GoogleCalendarEventSchema);

// ==================== API RESPONSE SCHEMAS ====================

/**
 * Generic API response schema
 */
export const ApiResponseSchema = z.union([
    z.object({
        success: z.literal(true),
        data: z.any(),
    }),
    z.object({
        success: z.literal(false),
        error: z.string(),
    }),
]);

/**
 * Create a typed API response schema
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
    return z.union([
        z.object({
            success: z.literal(true),
            data: dataSchema,
        }),
        z.object({
            success: z.literal(false),
            error: z.string(),
        }),
    ]);
}

// ==================== ENDPOINT-SPECIFIC RESPONSE SCHEMAS ====================

export const GetStaffResponseSchema = createApiResponseSchema(StaffArraySchema);

export const GetSettingsResponseSchema = createApiResponseSchema(SettingsSchema);

export const GetMonthShiftsResponseSchema = createApiResponseSchema(
    z.record(z.string(), z.record(z.union([z.number(), z.string()]), ShiftTypeSchema))
);

export const GetMonthAppointmentsResponseSchema = createApiResponseSchema(
    z.record(z.string(), z.array(z.any()))
);

export const GetGoogleCalendarEventsResponseSchema = createApiResponseSchema(
    z.record(z.string(), GoogleCalendarEventsArraySchema)
);

// ⚡ FIX: getDayStatus returns fields directly in response (not wrapped in data)
export const GetDayStatusResponseSchema = z.union([
    z.object({
        success: z.literal(true),
        isDeliveryMaxed: z.boolean(),
        availableHours: z.array(z.number()),
        unavailableHours: z.array(z.number()),
        deliveryCount: z.number().optional(),
    }),
    z.object({
        success: z.literal(false),
        error: z.string(),
    }),
]);

// ⚡ FIX: getDailySlots returns slots directly in response (not wrapped in data)
export const GetDailySlotsResponseSchema = z.union([
    z.object({
        success: z.literal(true),
        slots: TimeSlotsArraySchema,
    }),
    z.object({
        success: z.literal(false),
        error: z.string(),
    }),
]);

export const GetManagementSlotAvailabilityResponseSchema = createApiResponseSchema(
    z.object({
        slots: z.array(z.object({
            time: z.string(),
            hour: z.number().optional(),
            available: z.boolean().optional(),
            count: z.number().optional(),
        })),
    })
);

export const GetDataVersionResponseSchema = createApiResponseSchema(z.string());

export const CreateAppointmentResponseSchema = createApiResponseSchema(
    z.object({
        appointmentId: z.string().optional(),
        message: z.string().optional(),
    }).optional()
);

// ==================== VALIDATION UTILITIES ====================

/**
 * Validate data against a schema
 * Throws error if validation fails
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        const errors = result.error.issues
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
        const errorMessage = context
            ? `Validation failed for ${context}: ${errors}`
            : `Validation failed: ${errors}`;

        console.error(errorMessage, { data, errors: result.error.issues });
        throw new Error(errorMessage);
    }

    return result.data;
}

/**
 * Safely validate data (returns null on error)
 * Useful for non-critical validations
 */
export function tryValidateData<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T | null {
    const result = schema.safeParse(data);

    if (!result.success) {
        const errors = result.error.issues
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
        const errorMessage = context
            ? `Validation warning for ${context}: ${errors}`
            : `Validation warning: ${errors}`;

        console.warn(errorMessage, { data, errors: result.error.issues });
        return null;
    }

    return result.data;
}

/**
 * Validate API response
 * Ensures response has correct structure and validates data if success
 */
export function validateApiResponse<T>(
    responseSchema: z.ZodSchema<T>,
    response: unknown,
    endpoint: string
): T {
    try {
        return validateData(responseSchema, response, `API response from ${endpoint}`);
    } catch (error) {
        console.error(`API validation failed for ${endpoint}:`, error);
        throw error;
    }
}

// ==================== EXPORT ALL SCHEMAS ====================

export const Schemas = {
    // Primitive
    ShiftType: ShiftTypeSchema,
    AppointmentType: AppointmentTypeSchema,

    // Data Models
    Staff: StaffSchema,
    StaffArray: StaffArraySchema,
    TimeSlot: TimeSlotSchema,
    TimeSlotsArray: TimeSlotsArraySchema,
    DayStatus: DayStatusSchema,
    Settings: SettingsSchema,
    GoogleCalendarEvent: GoogleCalendarEventSchema,
    GoogleCalendarEventsArray: GoogleCalendarEventsArraySchema,

    // API Responses
    GetStaff: GetStaffResponseSchema,
    GetSettings: GetSettingsResponseSchema,
    GetMonthShifts: GetMonthShiftsResponseSchema,
    GetMonthAppointments: GetMonthAppointmentsResponseSchema,
    GetGoogleCalendarEvents: GetGoogleCalendarEventsResponseSchema,
    GetDayStatus: GetDayStatusResponseSchema,
    GetDailySlots: GetDailySlotsResponseSchema,
    GetManagementSlotAvailability: GetManagementSlotAvailabilityResponseSchema,
    GetDataVersion: GetDataVersionResponseSchema,
    CreateAppointment: CreateAppointmentResponseSchema,
};
