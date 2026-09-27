import assert from 'node:assert/strict';
import { calendarOAuthConfiguration, calendarProviderIsConfigured } from './server-calendar';

assert.equal(calendarProviderIsConfigured('google'), false);
assert.equal(calendarProviderIsConfigured('outlook'), false);
assert.equal(calendarOAuthConfiguration('google'), null);
assert.equal(calendarOAuthConfiguration('outlook'), null);
console.log('Calendar adapter configuration tests passed');
