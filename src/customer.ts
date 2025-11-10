/**
 * Customer App Entry Point
 * Initializes the Vue 3 customer appointment booking application
 */

import { createApp } from 'vue';
import CustomerView from './views/CustomerView.vue';
import { initMonitoring } from '../monitoring';

// Initialize monitoring (Sentry, Web Vitals)
initMonitoring();

// Create Vue app
const app = createApp(CustomerView);

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err);
  console.error('Error Info:', info);

  // Report to monitoring service
  if (window.Sentry) {
    window.Sentry.captureException(err, {
      contexts: {
        vue: {
          componentName: instance?.$options.name || 'Unknown',
          errorInfo: info
        }
      }
    });
  }
};

// Mount the app
app.mount('#app');

// Log app initialization
console.log('✅ Customer App initialized successfully');

// Export app instance for testing/debugging
if (typeof window !== 'undefined') {
  (window as any).__VUE_APP__ = app;
}
