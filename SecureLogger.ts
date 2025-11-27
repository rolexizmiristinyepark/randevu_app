/**
 * SecureLogger.ts
 *
 * KVKK/GDPR uyumlu güvenli loglama
 * PII (Kişisel Tanımlanabilir Bilgi) otomatik maskeleme
 */

import { maskEmail, maskPhone, maskName } from './security-helpers';

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// PII patterns for auto-detection
const PII_PATTERNS = [
    { pattern: /[\w.-]+@[\w.-]+\.\w+/g, type: 'email' },
    { pattern: /(?:\+90|0)?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, type: 'phone' },
    { pattern: /\b\d{11}\b/g, type: 'tcno' },  // TC Kimlik No
];

/**
 * Mesajdaki PII'leri otomatik maskeler
 */
function sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') return message;

    let sanitized = message;

    // Email maskeleme
    sanitized = sanitized.replace(
        /[\w.-]+@[\w.-]+\.\w+/g,
        (match) => maskEmail(match)
    );

    // Telefon maskeleme (Türkiye formatı)
    sanitized = sanitized.replace(
        /(?:\+90|0)?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g,
        (match) => maskPhone(match)
    );

    // TC Kimlik No maskeleme (11 haneli sayı)
    sanitized = sanitized.replace(
        /\b\d{11}\b/g,
        '[TC_NO]'
    );

    return sanitized;
}

/**
 * Object içindeki PII'leri maskeler
 */
function sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeMessage(obj);
    if (typeof obj !== 'object') return obj;

    // Array ise
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    // Object ise
    const sanitized: any = {};
    const sensitiveKeys = ['email', 'phone', 'tel', 'telefon', 'eposta', 'name', 'ad', 'soyad', 'customerName', 'customerPhone', 'customerEmail'];

    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
            // Hassas alan - maskele
            if (lowerKey.includes('email') || lowerKey.includes('eposta')) {
                sanitized[key] = maskEmail(value as string);
            } else if (lowerKey.includes('phone') || lowerKey.includes('tel')) {
                sanitized[key] = maskPhone(value as string);
            } else if (lowerKey.includes('name') || lowerKey.includes('ad') || lowerKey.includes('soyad')) {
                sanitized[key] = maskName(value as string);
            } else {
                sanitized[key] = '[REDACTED]';
            }
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        } else if (typeof value === 'string') {
            sanitized[key] = sanitizeMessage(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * SecureLogger class
 * Console.log yerine kullanılmalı
 */
export class SecureLogger {
    private static isProduction = typeof window !== 'undefined' &&
        !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1');

    private static shouldLog(level: LogLevel): boolean {
        // Production'da sadece warn ve error
        if (this.isProduction) {
            return level === 'warn' || level === 'error';
        }
        return true;
    }

    private static formatMessage(level: LogLevel, message: string, data?: any): string[] {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        const sanitizedMessage = sanitizeMessage(message);

        if (data !== undefined) {
            const sanitizedData = sanitizeObject(data);
            return [prefix, sanitizedMessage, sanitizedData];
        }

        return [prefix, sanitizedMessage];
    }

    static debug(message: string, data?: any): void {
        if (!this.shouldLog('debug')) return;
        const args = this.formatMessage('debug', message, data);
        console.debug(...args);
    }

    static info(message: string, data?: any): void {
        if (!this.shouldLog('info')) return;
        const args = this.formatMessage('info', message, data);
        console.info(...args);
    }

    static warn(message: string, data?: any): void {
        if (!this.shouldLog('warn')) return;
        const args = this.formatMessage('warn', message, data);
        console.warn(...args);
    }

    static error(message: string, data?: any): void {
        if (!this.shouldLog('error')) return;
        const args = this.formatMessage('error', message, data);
        console.error(...args);
    }

    /**
     * Objeyi güvenli şekilde loglar (PII maskelenerek)
     */
    static logSafe(label: string, obj: any): void {
        if (!this.shouldLog('info')) return;
        const sanitizedObj = sanitizeObject(obj);
        console.log(`[SAFE] ${label}:`, sanitizedObj);
    }
}

// Default export
export default SecureLogger;

// Window export for global access
if (typeof window !== 'undefined') {
    (window as any).SecureLogger = SecureLogger;
}
