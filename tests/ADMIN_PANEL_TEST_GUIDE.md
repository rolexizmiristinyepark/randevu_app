# Admin Panel Test Guide

**Comprehensive testing guide for admin-panel.ts regions**

## 📋 Overview

This guide documents the test patterns established for admin-panel.ts testing. The admin-panel.ts file has been organized into 8 VSCode regions for better navigation. This guide provides a blueprint for testing each region systematically.

### Current Test Status

- ✅ **Region 4: Staff Management** (Lines 104-401) - **COMPLETE** - 55 tests
- ⏳ **Region 1: Imports & Configuration** (Lines 1-24) - Pending
- ⏳ **Region 2: Data Management** (Lines 26-62) - Pending
- ⏳ **Region 3: API Settings** (Lines 64-102) - Pending
- ⏳ **Region 5: Shift Management** (Lines 403-756) - Pending
- ⏳ **Region 6: Appointment Management** (Lines 758-1159) - Pending
- ⏳ **Region 7: UI Utilities** (Lines 1161-1250) - Pending
- ⏳ **Region 8: Initialization** (Lines 1252-1614) - Pending

**Total Tests:** 55 / ~400-500 estimated
**Coverage:** ~20% of admin-panel.ts functionality

---

## 🏗️ Test Infrastructure

### Helper Utilities

Located in `tests/helpers/`:

#### 1. `dom-helpers.ts` - DOM Manipulation & Queries
**Purpose:** Advanced DOM utilities for admin panel UI testing

**Key Functions:**
- `setupAdminPanelDOM()` - Setup complete admin panel DOM structure
- `cleanupAdminPanelDOM()` - Cleanup after tests
- `getElement<T>(id)` - Type-safe element retrieval
- `setInputValue(id, value)` - Set input value + trigger events
- `clickButton(id)` - Click button element
- `isVisible(id)` - Check element visibility
- `isModalOpen(modalId)` - Check modal state
- `getAlerts()` - Get all alert messages
- `getStaffItems()` - Get staff list items
- `findStaffItem(name)` - Find staff by name
- `waitForElement(id)` - Wait for element to appear
- `waitFor(condition)` - Wait for condition to be true
- `nextTick()` - Wait for next microtask

**Example Usage:**
```typescript
import { setupAdminPanelDOM, getElement, setInputValue, clickButton } from './helpers/dom-helpers';

beforeEach(() => {
  setupAdminPanelDOM();
});

it('should add staff', () => {
  setInputValue('newStaffName', 'John Doe');
  clickButton('addStaffBtn');

  const staffList = getElement('staffList');
  expect(staffList.textContent).toContain('John Doe');
});
```

#### 2. `api-helpers.ts` - API Mocking & Data Generation
**Purpose:** Mock API responses and generate test data

**Key Functions:**
- `createMockStaff(overrides)` - Generate mock staff data
- `createMockStaffList(count)` - Generate multiple staff
- `createMockSettings(overrides)` - Generate mock settings
- `mockFetchSuccess(data)` - Mock successful API response
- `mockFetchError(error)` - Mock error response
- `setupFetchMock()` - Setup global fetch mock
- `mockStaffAPI.getStaff(list)` - Mock get staff endpoint
- `mockStaffAPI.addStaff(staff)` - Mock add staff endpoint
- `mockStaffAPI.updateStaff(staff)` - Mock update staff endpoint
- `mockStaffAPI.deleteStaff(id)` - Mock delete staff endpoint
- `verifyFetchCalledWith(url, options)` - Verify fetch calls

**Example Usage:**
```typescript
import { createMockStaff, mockStaffAPI, mockFetch } from './helpers/api-helpers';

it('should add staff via API', async () => {
  const newStaff = createMockStaff({ name: 'Jane Doe' });
  mockFetch(mockStaffAPI.addStaff(newStaff));

  // Trigger add staff action
  await addStaffAction();

  // Verify API was called
  expect(verifyFetchCalledWith('/api/addStaff')).toBe(true);
});
```

#### 3. `test-utils.ts` - High-Level Test Utilities
**Purpose:** Combine DOM + API helpers for complete test scenarios

**Key Functions:**
- `setupAdminPanelTest()` - Complete test setup (DOM + API mocks)
- `cleanupAdminPanelTest()` - Complete cleanup
- `fillStaffForm(staff)` - Fill add staff form
- `fillEditStaffForm(staff)` - Fill edit staff modal
- `addStaff(staff)` - Complete add staff flow
- `editStaff(name, updated)` - Complete edit staff flow
- `deleteStaff(name)` - Complete delete staff flow
- `switchTab(tabName)` - Switch to a tab
- `expectAlert(message)` - Assert alert is shown
- `waitForApiCall()` - Wait for API to complete

**Example Usage:**
```typescript
import {
  setupAdminPanelTest,
  cleanupAdminPanelTest,
  addStaff,
  expectAlert
} from './helpers/test-utils';

beforeEach(() => setupAdminPanelTest());
afterEach(() => cleanupAdminPanelTest());

it('should add staff and show success', async () => {
  await addStaff({ name: 'John Doe', phone: '0555 123 4567', email: 'john@example.com' });

  expectAlert('✅ John Doe eklendi!');
});
```

---

## 📝 Test Pattern Template

### Standard Test Structure

Each region test file should follow this structure:

```typescript
/**
 * ADMIN-PANEL [REGION NAME] TESTS
 * Comprehensive test suite for [Region Name] (admin-panel.ts lines X-Y)
 *
 * Test Coverage:
 * - [Feature 1]
 * - [Feature 2]
 * - [Feature 3]
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupAdminPanelTest,
  cleanupAdminPanelTest,
  // ... other imports
} from './helpers/test-utils';

describe('Admin Panel - [Region Name]', () => {

  beforeEach(() => {
    setupAdminPanelTest();
  });

  afterEach(() => {
    cleanupAdminPanelTest();
  });

  //#region Test Group 1
  describe('[Feature Group 1]', () => {
    it('should [do something]', async () => {
      // Arrange
      const mockData = createMockData();
      mockFetch(mockAPI.getData(mockData));

      // Act
      await performAction();

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle errors', async () => {
      // Arrange
      mockFetch(mockAPI.error('Error message'));

      // Act
      await performAction();

      // Assert
      expectAlert('Error message');
    });
  });
  //#endregion

  //#region Test Group 2
  describe('[Feature Group 2]', () => {
    // ... more tests
  });
  //#endregion
});
```

---

## 🎯 Test Categories

Each region should have tests in these categories:

### 1. **Data Loading Tests**
- Load data on initialization
- Handle empty data
- Handle API errors
- Handle malformed data

### 2. **User Action Tests**
- Valid input scenarios
- Invalid input scenarios (validation)
- Button clicks and interactions
- Form submissions

### 3. **API Integration Tests**
- Successful API calls
- Failed API calls
- Network errors
- Timeout handling

### 4. **Rendering Tests**
- Initial render
- Empty state render
- Populated state render
- Dynamic updates after actions

### 5. **Error Handling Tests**
- Validation errors
- API errors
- Network errors
- Edge cases (null, undefined, etc.)

### 6. **Integration Tests**
- Complete user flows
- Multiple operations in sequence
- Data consistency across operations

---

## 📚 Example: Staff Management Tests

**File:** `tests/admin-panel-staff.test.ts`

### Test Organization

```typescript
describe('Admin Panel - Staff Management', () => {
  //#region Data Loading Tests (6 tests)
  describe('Data Loading', () => {
    it('should load staff list on initialization')
    it('should handle empty staff list')
    it('should handle API error on load')
  });
  //#endregion

  //#region Add Staff Tests (7 tests)
  describe('Adding Staff', () => {
    it('should validate required fields before adding')
    it('should validate email format')
    it('should validate phone format')
    it('should add staff with valid data')
    it('should show success message after adding')
    it('should handle API error when adding')
    it('should clear form fields after successful add')
  });
  //#endregion

  //#region Edit Staff Tests (7 tests)
  describe('Editing Staff', () => {
    it('should open edit modal with staff data')
    it('should populate edit form with existing staff data')
    it('should validate edit form before saving')
    it('should save edited staff with valid data')
    it('should close edit modal on cancel')
    it('should handle API error when saving edit')
    it('should show success message after editing')
  });
  //#endregion

  //#region Delete Staff Tests (6 tests)
  describe('Deleting Staff', () => {
    it('should show confirmation dialog before deleting')
    it('should not delete if user cancels confirmation')
    it('should delete staff after confirmation')
    it('should show success message after deleting')
    it('should handle API error when deleting')
    it('should update staff count after deleting')
  });
  //#endregion

  //#region Toggle Staff Tests (6 tests)
  describe('Toggling Staff Active State', () => {
    it('should toggle staff from active to inactive')
    it('should toggle staff from inactive to active')
    it('should show success message after toggling')
    it('should handle API error when toggling')
    it('should update staff count when toggling to inactive')
    it('should update staff count when toggling to active')
  });
  //#endregion

  //#region Rendering Tests (9 tests)
  describe('Rendering Staff List', () => {
    it('should show empty message when no staff exists')
    it('should render staff items correctly')
    it('should show staff details (name, phone, email)')
    it('should show active/inactive status')
    it('should show action buttons (Edit, Toggle, Delete)')
    it('should update staff count correctly')
    it('should only count active staff in staff count')
    it('should use DocumentFragment for performance')
  });
  //#endregion

  //#region Staff Links Tests (8 tests)
  describe('Staff Links', () => {
    it('should render staff links for active staff')
    it('should show empty message when no active staff')
    it('should generate correct link URL for staff')
    it('should show copy and open buttons for each link')
    it('should copy link to clipboard')
    it('should open link in new window')
    it('should show success message after copying link')
    it('should not render links for inactive staff')
  });
  //#endregion

  //#region Error Handling Tests (9 tests)
  describe('Error Handling', () => {
    it('should handle network errors gracefully')
    it('should handle API error responses')
    it('should show error alert for failed operations')
    it('should handle missing staff data gracefully')
    it('should validate staff ID before operations')
    it('should handle empty form submissions')
    it('should handle malformed data from API')
  });
  //#endregion

  //#region Integration Tests (3 tests)
  describe('Integration Scenarios', () => {
    it('should complete full staff lifecycle (add, edit, toggle, delete)')
    it('should handle multiple rapid add operations')
    it('should maintain data consistency across operations')
  });
  //#endregion
});
```

**Total:** 55 tests across 9 test groups

---

## 🎨 Best Practices

### 1. **Use Descriptive Test Names**
```typescript
// ✅ Good
it('should show validation error when name is empty')

// ❌ Bad
it('test validation')
```

### 2. **Follow AAA Pattern** (Arrange, Act, Assert)
```typescript
it('should add staff', async () => {
  // Arrange
  const newStaff = createMockStaff({ name: 'John Doe' });
  mockFetch(mockStaffAPI.addStaff(newStaff));

  // Act
  await addStaff(newStaff);

  // Assert
  expectAlert('✅ John Doe eklendi!');
});
```

### 3. **Test One Thing Per Test**
```typescript
// ✅ Good - Tests one specific behavior
it('should show success alert after adding staff')

// ❌ Bad - Tests multiple behaviors
it('should add staff, show alert, and update count')
```

### 4. **Use Test Helpers for Common Operations**
```typescript
// ✅ Good
await addStaff({ name: 'John Doe', phone: '0555 123 4567', email: 'john@example.com' });

// ❌ Bad - Repeating code
setInputValue('newStaffName', 'John Doe');
setInputValue('newStaffPhone', '0555 123 4567');
setInputValue('newStaffEmail', 'john@example.com');
clickButton('addStaffBtn');
await nextTick();
```

### 5. **Mock External Dependencies**
```typescript
beforeEach(() => {
  // Mock fetch
  setupFetchMock();

  // Mock window functions
  global.confirm = vi.fn(() => true);
  global.alert = vi.fn();
});
```

### 6. **Clean Up After Tests**
```typescript
afterEach(() => {
  cleanupAdminPanelTest();
  vi.clearAllMocks();
});
```

### 7. **Use Regions for Organization**
```typescript
//#region Data Loading Tests
describe('Data Loading', () => {
  // ... tests
});
//#endregion

//#region Add Staff Tests
describe('Adding Staff', () => {
  // ... tests
});
//#endregion
```

### 8. **Test Both Success and Failure Paths**
```typescript
it('should add staff successfully', async () => {
  mockFetch(mockStaffAPI.addStaff(newStaff));
  // ... test success
});

it('should handle error when adding staff', async () => {
  mockFetch(mockStaffAPI.error('Server error'));
  // ... test error handling
});
```

---

## 🚀 Next Steps: Testing Remaining Regions

### Phase 2: Data Management (Region 2)
**Estimated:** ~30 tests, 1-1.5 hours

**Test Areas:**
- `loadStaff()` - Load staff data
- `loadShifts()` - Load shifts data
- `loadSettings()` - Load settings data
- Caching and data consistency

**Test File:** `tests/admin-panel-data.test.ts`

### Phase 3: API Settings (Region 3)
**Estimated:** ~25 tests, 1 hour

**Test Areas:**
- `API.save()` - Save data via API
- `API.load()` - Load data from API
- Error handling and retries

**Test File:** `tests/admin-panel-api.test.ts`

### Phase 4: Shift Management (Region 5)
**Estimated:** ~60 tests, 2-3 hours

**Test Areas:**
- Week selector
- Shift table rendering
- Add/edit/delete shifts
- Save shifts
- Shift validation

**Test File:** `tests/admin-panel-shifts.test.ts`

### Phase 5: Appointment Management (Region 6)
**Estimated:** ~80 tests, 3-4 hours

**Test Areas:**
- Load appointments
- Filter by week
- Edit appointment (modal, date, time)
- Delete appointment
- Assign staff to appointment
- WhatsApp integration
- Slack integration

**Test File:** `tests/admin-panel-appointments.test.ts`

### Phase 6: UI Utilities (Region 7)
**Estimated:** ~20 tests, 1 hour

**Test Areas:**
- `UI.showAlert()` - Show alerts
- Link helpers (copy, open)
- Loading states

**Test File:** `tests/admin-panel-ui.test.ts`

### Phase 7: Initialization (Region 8)
**Estimated:** ~30 tests, 1.5-2 hours

**Test Areas:**
- `initAdmin()` - Admin initialization
- `startApp()` - App startup
- Event listeners setup
- Tab switching
- URL parameter handling

**Test File:** `tests/admin-panel-init.test.ts`

---

## 📊 Coverage Goals

### Current Coverage
- **Staff Management (Region 4):** 100% (55 tests)
- **Overall admin-panel.ts:** ~20%

### Target Coverage
- **Total Tests:** 400-500 tests
- **Overall Coverage:** 80%+
- **Per Region:** 80%+ coverage

### Estimated Timeline
- **Phase 1:** ✅ Staff Management - COMPLETE (55 tests)
- **Phase 2:** Data Management - 1-1.5 hours (30 tests)
- **Phase 3:** API Settings - 1 hour (25 tests)
- **Phase 4:** Shift Management - 2-3 hours (60 tests)
- **Phase 5:** Appointment Management - 3-4 hours (80 tests)
- **Phase 6:** UI Utilities - 1 hour (20 tests)
- **Phase 7:** Initialization - 1.5-2 hours (30 tests)
- **Phase 8:** Integration & E2E - 2-3 hours (50 tests)

**Total Estimated Time:** 12-18 hours (8 sessions)

---

## 🔍 Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- admin-panel-staff.test.ts
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run dev
# (in test files)
```

### Run Tests with UI
```bash
npm run test:ui
```

---

## 📖 Resources

- **Vitest Docs:** https://vitest.dev/
- **Happy-DOM:** https://github.com/capricorn86/happy-dom
- **Testing Best Practices:** https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

## ✅ Checklist for New Region Tests

When creating tests for a new region:

- [ ] Create test file: `tests/admin-panel-[region].test.ts`
- [ ] Import necessary helpers from `test-utils`
- [ ] Add `beforeEach(setupAdminPanelTest)`
- [ ] Add `afterEach(cleanupAdminPanelTest)`
- [ ] Organize tests into logical groups with `//#region` markers
- [ ] Include all test categories:
  - [ ] Data loading tests
  - [ ] User action tests
  - [ ] API integration tests
  - [ ] Rendering tests
  - [ ] Error handling tests
  - [ ] Integration tests
- [ ] Write descriptive test names
- [ ] Follow AAA pattern (Arrange, Act, Assert)
- [ ] Test both success and failure paths
- [ ] Use test helpers for common operations
- [ ] Mock external dependencies
- [ ] Run tests to verify they pass
- [ ] Check coverage report
- [ ] Update this guide if new patterns emerge

---

**Last Updated:** 2024-11-23
**Author:** Claude Code
**Status:** Phase 1 Complete ✅
