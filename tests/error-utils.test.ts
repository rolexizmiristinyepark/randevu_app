import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorUtils } from '../error-utils';

describe('ErrorUtils', () => {
    let mockShowAlert: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        mockShowAlert = vi.fn();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleApiError', () => {
        it('should display error message from API response', () => {
            const response = { error: 'Staff not found' };

            ErrorUtils.handleApiError(response, 'saveSettings', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Hata: Staff not found',
                'error'
            );
        });

        it('should handle missing error field', () => {
            const response = {};

            ErrorUtils.handleApiError(response, 'getStaff', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Hata: Bilinmeyen hata',
                'error'
            );
        });

        it('should log error with context', () => {
            const response = { error: 'Database error', code: 500 };

            ErrorUtils.handleApiError(response, 'deleteStaff', mockShowAlert);

            // Check that error was logged (console.error called)
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should handle empty error string', () => {
            const response = { error: '' };

            ErrorUtils.handleApiError(response, 'test', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Hata: Bilinmeyen hata',
                'error'
            );
        });
    });

    describe('handleException', () => {
        it('should display error message from Error object', () => {
            const error = new Error('Network timeout');

            ErrorUtils.handleException(error, 'Kaydetme', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Kaydetme hatası: Network timeout',
                'error'
            );
        });

        it('should handle string error', () => {
            const error = 'Something went wrong';

            ErrorUtils.handleException(error, 'Ekleme', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Ekleme hatası: Something went wrong',
                'error'
            );
        });

        it('should handle null error', () => {
            const error = null;

            ErrorUtils.handleException(error, 'Silme', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Silme hatası: null',
                'error'
            );
        });

        it('should handle undefined error', () => {
            const error = undefined;

            ErrorUtils.handleException(error, 'Güncelleme', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Güncelleme hatası: undefined',
                'error'
            );
        });

        it('should log error with context', () => {
            const error = new Error('Test error');

            ErrorUtils.handleException(error, 'testAction', mockShowAlert);

            // Check that error was logged
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('withErrorHandling', () => {
        it('should return result on success', async () => {
            const asyncFn = async () => {
                return { data: 'success' };
            };

            const result = await ErrorUtils.withErrorHandling(asyncFn, 'testAction', mockShowAlert);

            expect(result).toEqual({ data: 'success' });
            expect(mockShowAlert).not.toHaveBeenCalled();
        });

        it('should handle API error response', async () => {
            const asyncFn = async () => {
                return { error: 'API error occurred' };
            };

            const result = await ErrorUtils.withErrorHandling(asyncFn, 'fetchData', mockShowAlert);

            expect(result).toBeUndefined();
            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Hata: API error occurred',
                'error'
            );
        });

        it('should handle exception', async () => {
            const asyncFn = async () => {
                throw new Error('Network error');
            };

            const result = await ErrorUtils.withErrorHandling(asyncFn, 'uploadData', mockShowAlert);

            expect(result).toBeUndefined();
            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ uploadData hatası: Network error',
                'error'
            );
        });

        it('should handle non-Error exceptions', async () => {
            const asyncFn = async () => {
                throw 'String error';
            };

            const result = await ErrorUtils.withErrorHandling(asyncFn, 'processData', mockShowAlert);

            expect(result).toBeUndefined();
            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ processData hatası: String error',
                'error'
            );
        });

        it('should preserve return type for successful calls', async () => {
            const asyncFn = async () => {
                return { id: 123, name: 'Test' };
            };

            const result = await ErrorUtils.withErrorHandling(asyncFn, 'getData', mockShowAlert);

            expect(result).toEqual({ id: 123, name: 'Test' });
        });

        it('should detect API errors in nested objects', async () => {
            const asyncFn = async () => {
                return {
                    error: 'Nested error',
                    additionalData: 'some data'
                };
            };

            const result = await ErrorUtils.withErrorHandling(asyncFn, 'complexAction', mockShowAlert);

            expect(result).toBeUndefined();
            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Hata: Nested error',
                'error'
            );
        });

        it('should not interfere with falsy return values', async () => {
            const asyncFn1 = async () => false;
            const asyncFn2 = async () => 0;
            const asyncFn3 = async () => '';
            const asyncFn4 = async () => null;

            const result1 = await ErrorUtils.withErrorHandling(asyncFn1, 'test', mockShowAlert);
            const result2 = await ErrorUtils.withErrorHandling(asyncFn2, 'test', mockShowAlert);
            const result3 = await ErrorUtils.withErrorHandling(asyncFn3, 'test', mockShowAlert);
            const result4 = await ErrorUtils.withErrorHandling(asyncFn4, 'test', mockShowAlert);

            expect(result1).toBe(false);
            expect(result2).toBe(0);
            expect(result3).toBe('');
            expect(result4).toBe(null);
        });
    });

    describe('DRY Principle Verification', () => {
        it('should replace admin-panel.ts:120 pattern (API error)', () => {
            // Old pattern: UI.showAlert('❌ Hata: ' + response.error, 'error');
            const response = { error: 'Settings not saved' };

            // Old way (duplicated 10+ times)
            const oldWayMessage = '❌ Hata: ' + response.error;
            mockShowAlert(oldWayMessage, 'error');

            // New way (DRY)
            vi.clearAllMocks();
            ErrorUtils.handleApiError(response, 'saveSettings', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(oldWayMessage, 'error');
        });

        it('should replace admin-panel.ts:123 pattern (exception)', () => {
            // Old pattern: UI.showAlert('❌ Kaydetme hatası: ' + error.message, 'error');
            const error = new Error('Validation failed');

            // Old way
            const oldWayMessage = '❌ Kaydetme hatası: ' + error.message;
            mockShowAlert(oldWayMessage, 'error');

            // New way
            vi.clearAllMocks();
            ErrorUtils.handleException(error, 'Kaydetme', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(oldWayMessage, 'error');
        });

        it('should replace admin-panel.ts:178, 194, 215 patterns (multiple API errors)', () => {
            const testCases = [
                { error: 'Staff not added', action: 'addStaff' },
                { error: 'Staff not updated', action: 'updateStaff' },
                { error: 'Staff not removed', action: 'removeStaff' }
            ];

            testCases.forEach(({ error: errorMsg, action }) => {
                vi.clearAllMocks();

                const response = { error: errorMsg };
                ErrorUtils.handleApiError(response, action, mockShowAlert);

                expect(mockShowAlert).toHaveBeenCalledWith(
                    `❌ Hata: ${errorMsg}`,
                    'error'
                );
            });
        });

        it('should replace admin-panel.ts:181, 197, 218 patterns (multiple exceptions)', () => {
            const testCases = [
                { message: 'Network error', action: 'Ekleme' },
                { message: 'Database error', action: 'Güncelleme' },
                { message: 'Permission denied', action: 'Silme' }
            ];

            testCases.forEach(({ message, action }) => {
                vi.clearAllMocks();

                const error = new Error(message);
                ErrorUtils.handleException(error, action, mockShowAlert);

                expect(mockShowAlert).toHaveBeenCalledWith(
                    `❌ ${action} hatası: ${message}`,
                    'error'
                );
            });
        });

        it('should replace entire try-catch pattern with withErrorHandling', async () => {
            // New pattern (DRY):
            const asyncFn = async () => {
                return { data: 'saved' };
            };

            const result = await ErrorUtils.withErrorHandling(asyncFn, 'saveData', mockShowAlert);

            expect(result).toEqual({ data: 'saved' });
            expect(mockShowAlert).not.toHaveBeenCalled();
        });
    });

    describe('Real-world usage scenarios', () => {
        it('should handle saveSettings API error (admin-panel.ts:120)', () => {
            const response = { error: 'PropertiesService quota exceeded' };

            ErrorUtils.handleApiError(response, 'saveSettings', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Hata: PropertiesService quota exceeded',
                'error'
            );
        });

        it('should handle addStaff exception (admin-panel.ts:181)', () => {
            const error = new Error('Invalid staff data');

            ErrorUtils.handleException(error, 'Ekleme', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Ekleme hatası: Invalid staff data',
                'error'
            );
        });

        it('should handle deleteAppointment error (admin-panel.ts:869)', () => {
            const result = { error: 'Calendar API rate limit exceeded' };

            ErrorUtils.handleApiError(result, 'deleteAppointment', mockShowAlert);

            expect(mockShowAlert).toHaveBeenCalledWith(
                '❌ Hata: Calendar API rate limit exceeded',
                'error'
            );
        });
    });
});
