import { describe, it, expect } from 'vitest';
import { ValidationUtils } from '../validation-utils';

describe('ValidationUtils', () => {
    describe('validateRequired', () => {
        it('should return invalid for empty string', () => {
            const result = ValidationUtils.validateRequired('', 'isim');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen isim girin!');
        });

        it('should return invalid for whitespace-only string', () => {
            const result = ValidationUtils.validateRequired('   ', 'telefon');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen telefon girin!');
        });

        it('should return invalid for null', () => {
            const result = ValidationUtils.validateRequired(null, 'e-posta');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen e-posta girin!');
        });

        it('should return invalid for undefined', () => {
            const result = ValidationUtils.validateRequired(undefined, 'adres');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen adres girin!');
        });

        it('should return valid for non-empty string', () => {
            const result = ValidationUtils.validateRequired('Serdar Benli', 'isim');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should trim and validate', () => {
            const result = ValidationUtils.validateRequired('  Serdar  ', 'isim');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });
    });

    describe('validateEmail', () => {
        it('should return invalid for empty string', () => {
            const result = ValidationUtils.validateEmail('');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen e-posta girin!');
        });

        it('should return invalid for null', () => {
            const result = ValidationUtils.validateEmail(null);
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen e-posta girin!');
        });

        it('should return invalid for invalid format (no @)', () => {
            const result = ValidationUtils.validateEmail('invalidemail.com');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Geçersiz e-posta formatı!');
        });

        it('should return invalid for invalid format (no domain)', () => {
            const result = ValidationUtils.validateEmail('test@');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Geçersiz e-posta formatı!');
        });

        it('should return invalid for invalid format (no TLD)', () => {
            const result = ValidationUtils.validateEmail('test@example');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Geçersiz e-posta formatı!');
        });

        it('should return valid for standard email', () => {
            const result = ValidationUtils.validateEmail('serdar@rolex.com');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should return valid for email with subdomain', () => {
            const result = ValidationUtils.validateEmail('test@mail.rolex.com');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should return valid for email with plus sign', () => {
            const result = ValidationUtils.validateEmail('test+tag@example.com');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should trim whitespace', () => {
            const result = ValidationUtils.validateEmail('  test@example.com  ');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });
    });

    describe('validatePhone', () => {
        it('should return invalid for empty string', () => {
            const result = ValidationUtils.validatePhone('');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen telefon girin!');
        });

        it('should return invalid for null', () => {
            const result = ValidationUtils.validatePhone(null);
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen telefon girin!');
        });

        it('should return invalid for too short number', () => {
            const result = ValidationUtils.validatePhone('123');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Geçersiz telefon formatı! (örn: 0555 123 45 67)');
        });

        it('should return invalid for landline (not starting with 5)', () => {
            const result = ValidationUtils.validatePhone('02121234567');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Geçersiz telefon formatı! (örn: 0555 123 45 67)');
        });

        it('should return valid for Turkish mobile (0555...)', () => {
            const result = ValidationUtils.validatePhone('05551234567');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should return valid for Turkish mobile with spaces', () => {
            const result = ValidationUtils.validatePhone('0555 123 45 67');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should return valid for Turkish mobile with +90', () => {
            const result = ValidationUtils.validatePhone('+905551234567');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should return valid for Turkish mobile with +90 and spaces', () => {
            const result = ValidationUtils.validatePhone('+90 555 123 45 67');
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should handle different mobile prefixes (533, 534, 535, etc.)', () => {
            expect(ValidationUtils.validatePhone('05331234567').valid).toBe(true);
            expect(ValidationUtils.validatePhone('05341234567').valid).toBe(true);
            expect(ValidationUtils.validatePhone('05351234567').valid).toBe(true);
            expect(ValidationUtils.validatePhone('05361234567').valid).toBe(true);
        });
    });

    describe('validateAllRequired', () => {
        it('should return invalid if any field is empty', () => {
            const result = ValidationUtils.validateAllRequired({
                'isim': 'Serdar',
                'telefon': '',
                'e-posta': 'test@example.com'
            });
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen telefon girin!');
        });

        it('should return invalid for first empty field', () => {
            const result = ValidationUtils.validateAllRequired({
                'isim': '',
                'telefon': '',
                'e-posta': ''
            });
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen isim girin!');
        });

        it('should return valid if all fields are filled', () => {
            const result = ValidationUtils.validateAllRequired({
                'isim': 'Serdar',
                'telefon': '0555 123 45 67',
                'e-posta': 'test@example.com'
            });
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should handle single field', () => {
            const result = ValidationUtils.validateAllRequired({
                'isim': 'Serdar'
            });
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should handle empty object', () => {
            const result = ValidationUtils.validateAllRequired({});
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });
    });

    describe('validateStaffForm', () => {
        it('should return invalid if name is empty', () => {
            const result = ValidationUtils.validateStaffForm(
                '',
                '0555 123 45 67',
                'test@example.com'
            );
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen isim girin!');
        });

        it('should return invalid if phone is empty', () => {
            const result = ValidationUtils.validateStaffForm(
                'Serdar',
                '',
                'test@example.com'
            );
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen telefon girin!');
        });

        it('should return invalid if phone format is wrong', () => {
            const result = ValidationUtils.validateStaffForm(
                'Serdar',
                '123',
                'test@example.com'
            );
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Geçersiz telefon formatı! (örn: 0555 123 45 67)');
        });

        it('should return invalid if email is empty', () => {
            const result = ValidationUtils.validateStaffForm(
                'Serdar',
                '0555 123 45 67',
                ''
            );
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen e-posta girin!');
        });

        it('should return invalid if email format is wrong', () => {
            const result = ValidationUtils.validateStaffForm(
                'Serdar',
                '0555 123 45 67',
                'invalidemail'
            );
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Geçersiz e-posta formatı!');
        });

        it('should return valid if all fields are correct', () => {
            const result = ValidationUtils.validateStaffForm(
                'Serdar Benli',
                '0555 123 45 67',
                'serdar@rolex.com'
            );
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should handle null values', () => {
            const result = ValidationUtils.validateStaffForm(null, null, null);
            expect(result.valid).toBe(false);
            expect(result.message).toBe('❌ Lütfen isim girin!');
        });
    });

    describe('DRY Principle Verification', () => {
        it('should replace admin-panel.ts:153 pattern (name validation)', () => {
            // Old pattern: if (!staffName.value.trim()) { UI.showAlert('❌ Lütfen isim girin!', 'error'); return; }
            const staffNameValue = '';

            // Old way (duplicated code)
            const oldWayValid = staffNameValue.trim() !== '';
            const oldWayMessage = '❌ Lütfen isim girin!';

            // New way (DRY)
            const newWay = ValidationUtils.validateRequired(staffNameValue, 'isim');

            expect(newWay.valid).toBe(oldWayValid);
            expect(newWay.message).toBe(oldWayMessage);
        });

        it('should replace admin-panel.ts:158 pattern (phone validation)', () => {
            const staffPhoneValue = '';

            // Old way
            const oldWayValid = staffPhoneValue.trim() !== '';
            const oldWayMessage = '❌ Lütfen telefon girin!';

            // New way
            const newWay = ValidationUtils.validateRequired(staffPhoneValue, 'telefon');

            expect(newWay.valid).toBe(oldWayValid);
            expect(newWay.message).toBe(oldWayMessage);
        });

        it('should replace admin-panel.ts:163 pattern (email validation)', () => {
            const staffEmailValue = '';

            // Old way
            const oldWayValid = staffEmailValue.trim() !== '';
            const oldWayMessage = '❌ Lütfen e-posta girin!';

            // New way
            const newWay = ValidationUtils.validateRequired(staffEmailValue, 'e-posta');

            expect(newWay.valid).toBe(oldWayValid);
            expect(newWay.message).toBe(oldWayMessage);
        });

        it('should replace entire staff form validation (lines 153, 158, 163)', () => {
            // Simulated form values
            const staffName = { value: 'Serdar' };
            const staffPhone = { value: '0555 123 45 67' };
            const staffEmail = { value: 'serdar@rolex.com' };

            // New way: Single function call
            const result = ValidationUtils.validateStaffForm(
                staffName.value,
                staffPhone.value,
                staffEmail.value
            );

            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });

        it('should replace admin-panel.ts:409-419 pattern (second staff form)', () => {
            // Same validation pattern repeated at lines 409, 414, 419
            const result = ValidationUtils.validateStaffForm(
                'Ali Veli',
                '0533 987 65 43',
                'ali@rolex.com'
            );

            expect(result.valid).toBe(true);
        });
    });

    describe('Integration with UI flow', () => {
        it('should provide user-friendly error messages in Turkish', () => {
            const nameResult = ValidationUtils.validateRequired('', 'isim');
            const phoneResult = ValidationUtils.validatePhone('123');
            const emailResult = ValidationUtils.validateEmail('invalid');

            expect(nameResult.message).toContain('❌');
            expect(nameResult.message).toContain('isim');

            expect(phoneResult.message).toContain('❌');
            expect(phoneResult.message).toContain('Geçersiz');
            expect(phoneResult.message).toContain('örn:');

            expect(emailResult.message).toContain('❌');
            expect(emailResult.message).toContain('e-posta');
        });

        it('should work with conditional logic (early return pattern)', () => {
            const formData = {
                name: '',
                phone: '0555 123 45 67',
                email: 'test@example.com'
            };

            const result = ValidationUtils.validateStaffForm(
                formData.name,
                formData.phone,
                formData.email
            );

            // Simulated early return
            if (!result.valid) {
                // UI.showAlert(result.message, 'error');
                // return;
                expect(result.message).toBe('❌ Lütfen isim girin!');
            }
        });
    });
});
