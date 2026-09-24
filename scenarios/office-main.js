import exec from 'k6/execution';
import { sleep } from 'k6';
import {
  createJsonParams,
  createTaggedParams,
  ensureSuccess,
  frontendGetApiCallHistoryList,
  frontendGetCustomizableOptions,
  frontendGetCustomizableOptionsGlobal,
  frontendGetEmployeesList,
  frontendGetEmployeesRoutes,
  frontendGetIncidentsList,
  frontendGetInitialInstallation,
  frontendGetOrdersList,
  frontendGetPaymentsList,
  frontendGetDevicesList,
  frontendLogin,
  frontendMe,
  frontendRefresh,
  getParsedBody,
} from '../lib/api.js';
import {
  createFrontendBaseTags,
  createFrontendRequestTags,
  recordActiveSessions,
  recordAdminRequest,
  recordListRequest,
  recordLogin,
  recordRefresh,
  recordSessionCompleted,
  recordSessionDuration,
  recordSessionOutcome,
  recordSessionStarted,
  recordStepException,
  recordStepResult,
} from '../lib/officeMetrics.js';
import { chance, randomBetween, think } from '../lib/random.js';
import { loadProfile, loadSharedRecords, createPerVuState, getVuRecord, ensureUniqueField } from '../lib/scenarioRuntime.js';
import { createFrontendState } from '../lib/officeState.js';

const profilePath = import.meta.resolve('../config/office-load-profile.example.json');
const dataPath = import.meta.resolve('../data/office-users.example.json');

const profile = loadProfile(profilePath);
const users = loadSharedRecords('office-users', dataPath);
ensureUniqueField(users, dataPath, 'userId');
const getState = createPerVuState(createFrontendState);
const frontendMode = (__ENV.OFFICE_MODE ?? 'mixed').toLowerCase();

const scenarioNames = {
  keepalive: 'frontend_session_keepalive',
  lists: 'frontend_lists',
  admin: 'frontend_admin_light',
};

function getUser() {
  return getVuRecord(users, dataPath);
}

function getStepParams(params, baseTags, step, endpoint) {
  return createTaggedParams(params, createFrontendRequestTags(baseTags, step, endpoint));
}

function createPagedRequest(payload = {}) {
  return {
    page: payload.page ?? 1,
    rows: payload.rows ?? 20,
    filterOptions: payload.filterOptions ?? [],
    sortOptions: payload.sortOptions ?? [],
  };
}

function createRoutesRequest(payload = {}) {
  const now = new Date();
  return {
    date: payload.date ?? now.toISOString(),
    officeId: payload.officeId ?? null,
  };
}

function setNextRefreshAt(user, state) {
  const minSeconds = user.timeouts?.refreshMinSeconds ?? 20;
  const maxSeconds = user.timeouts?.refreshMaxSeconds ?? 40;
  state.nextRefreshAt = Date.now() + randomBetween(minSeconds, maxSeconds) * 1000;
}

function resetAuthState(state) {
  state.isLoggedIn = false;
  state.lastLoginAt = null;
  state.nextRefreshAt = null;
  state.profile = null;
}

function ensureLoggedIn(baseUrl, user, state, params, baseTags) {
  if (state.isLoggedIn) {
    return;
  }

  const response = frontendLogin(
    baseUrl,
    {
      login: user.login,
      password: user.password,
    },
    getStepParams(params, baseTags, 'login', '/api/frontend/account/login'),
  );

  recordStepResult('login', '/api/frontend/account/login', response, baseTags);
  ensureSuccess(response, 'frontend/account/login');
  state.isLoggedIn = true;
  state.lastLoginAt = Date.now();
  setNextRefreshAt(user, state);
  recordLogin(baseTags);
}

function fetchMe(baseUrl, state, params, baseTags) {
  const response = frontendMe(
    baseUrl,
    getStepParams(params, baseTags, 'me', '/api/frontend/account/me'),
  );

  recordStepResult('me', '/api/frontend/account/me', response, baseTags);
  const body = getParsedBody(response, 'frontend/account/me');
  state.profile = body;

  return body;
}

function maybeRefresh(baseUrl, user, state, params, baseTags, force = false) {
  if (!state.isLoggedIn) {
    return;
  }

  if (!force && state.nextRefreshAt && Date.now() < state.nextRefreshAt) {
    return;
  }

  const response = frontendRefresh(
    baseUrl,
    getStepParams(params, baseTags, 'refresh', '/api/frontend/account/refresh'),
  );

  recordStepResult('refresh', '/api/frontend/account/refresh', response, baseTags);
  ensureSuccess(response, 'frontend/account/refresh');
  setNextRefreshAt(user, state);
  recordRefresh(baseTags);
}

function runListStep(baseUrl, params, baseTags, endpoint, fn, payload) {
  const response = fn(
    baseUrl,
    payload,
    getStepParams(params, baseTags, 'list', endpoint),
  );

  recordStepResult('list', endpoint, response, baseTags);
  ensureSuccess(response, endpoint);
  recordListRequest(baseTags, endpoint);
}

function runAdminStep(baseUrl, params, baseTags, endpoint, fn, payload) {
  const response = fn(
    baseUrl,
    payload,
    getStepParams(params, baseTags, 'admin', endpoint),
  );

  recordStepResult('admin', endpoint, response, baseTags);
  ensureSuccess(response, endpoint);
  recordAdminRequest(baseTags, endpoint);
}

function runGetListStep(baseUrl, params, baseTags, endpoint, fn) {
  const response = fn(
    baseUrl,
    getStepParams(params, baseTags, 'list', endpoint),
  );

  recordStepResult('list', endpoint, response, baseTags);
  ensureSuccess(response, endpoint);
  recordListRequest(baseTags, endpoint);
}

function runGetAdminStep(baseUrl, params, baseTags, endpoint, fn) {
  const response = fn(
    baseUrl,
    getStepParams(params, baseTags, 'admin', endpoint),
  );

  recordStepResult('admin', endpoint, response, baseTags);
  ensureSuccess(response, endpoint);
  recordAdminRequest(baseTags, endpoint);
}

function getThinkRange(user) {
  return {
    min: user.timeouts?.betweenRequestsMinSeconds ?? 1,
    max: user.timeouts?.betweenRequestsMaxSeconds ?? 3,
  };
}

function runKeepaliveCycle(baseUrl, user, state, params, baseTags) {
  ensureLoggedIn(baseUrl, user, state, params, baseTags);
  fetchMe(baseUrl, state, params, baseTags);
  maybeRefresh(baseUrl, user, state, params, baseTags, true);

  if (chance(profile.keepalive.meProbability ?? 0.3)) {
    think(0.5, 1.5);
    fetchMe(baseUrl, state, params, baseTags);
  }

  sleep(randomBetween(
    user.timeouts?.refreshMinSeconds ?? 20,
    user.timeouts?.refreshMaxSeconds ?? 40,
  ));
}

function runListsCycle(baseUrl, user, state, params, baseTags) {
  const payloads = user.payloads ?? {};
  const thinkRange = getThinkRange(user);

  ensureLoggedIn(baseUrl, user, state, params, baseTags);
  fetchMe(baseUrl, state, params, baseTags);
  runGetListStep(baseUrl, params, baseTags, '/api/frontend/customizable-options/global', frontendGetCustomizableOptionsGlobal);
  think(thinkRange.min, thinkRange.max);
  runListStep(baseUrl, params, baseTags, '/api/frontend/devices/get-list', frontendGetDevicesList, createPagedRequest(payloads.devices));
  think(thinkRange.min, thinkRange.max);
  runListStep(baseUrl, params, baseTags, '/api/frontend/orders/get-list', frontendGetOrdersList, createPagedRequest(payloads.orders));
  think(thinkRange.min, thinkRange.max);
  runListStep(baseUrl, params, baseTags, '/api/frontend/payments/get-list', frontendGetPaymentsList, createPagedRequest(payloads.payments));
  think(thinkRange.min, thinkRange.max);
  runListStep(baseUrl, params, baseTags, '/api/frontend/api-call-history/get-list', frontendGetApiCallHistoryList, createPagedRequest(payloads.apiCallHistory));
  think(thinkRange.min, thinkRange.max);
  runListStep(baseUrl, params, baseTags, '/api/frontend/incidents/get-list', frontendGetIncidentsList, createPagedRequest(payloads.incidents));
  maybeRefresh(baseUrl, user, state, params, baseTags, true);
  sleep(randomBetween(thinkRange.min, thinkRange.max));
}

function runAdminCycle(baseUrl, user, state, params, baseTags) {
  const payloads = user.payloads ?? {};
  const thinkRange = getThinkRange(user);

  ensureLoggedIn(baseUrl, user, state, params, baseTags);
  fetchMe(baseUrl, state, params, baseTags);
  runGetAdminStep(baseUrl, params, baseTags, '/api/frontend/customizable-options', frontendGetCustomizableOptions);
  think(thinkRange.min, thinkRange.max);
  runAdminStep(baseUrl, params, baseTags, '/api/frontend/employees/get-list', frontendGetEmployeesList, createPagedRequest(payloads.employees));
  think(thinkRange.min, thinkRange.max);
  runAdminStep(baseUrl, params, baseTags, '/api/frontend/employees/get-routes', frontendGetEmployeesRoutes, createRoutesRequest(payloads.employeeRoutes));
  think(thinkRange.min, thinkRange.max);
  runAdminStep(baseUrl, params, baseTags, '/api/frontend/initial-installation', frontendGetInitialInstallation, createPagedRequest(payloads.initialInstallation));
  maybeRefresh(baseUrl, user, state, params, baseTags, true);
  sleep(randomBetween(thinkRange.min, thinkRange.max));
}

function buildOptionsForMode() {
  const scenarios = {};

  if (frontendMode === 'mixed' || frontendMode === 'keepalive') {
    scenarios[scenarioNames.keepalive] = {
      executor: 'constant-vus',
      vus: profile.keepalive.vus,
      duration: profile.duration,
    };
  }

  if (frontendMode === 'mixed' || frontendMode === 'lists') {
    scenarios[scenarioNames.lists] = {
      executor: 'constant-vus',
      vus: profile.lists.vus,
      duration: profile.duration,
    };
  }

  if (frontendMode === 'mixed' || frontendMode === 'admin') {
    scenarios[scenarioNames.admin] = {
      executor: 'constant-vus',
      vus: profile.admin.vus,
      duration: profile.duration,
    };
  }

  if (Object.keys(scenarios).length === 0) {
    throw new Error(`Unsupported OFFICE_MODE="${frontendMode}". Supported values: mixed, keepalive, lists, admin`);
  }

  return {
    scenarios,
    thresholds: profile.thresholds,
  };
}

function run() {
  const baseUrl = __ENV.BASE_URL;
  const user = getUser();
  const state = getState();
  const params = createJsonParams(user.headers);
  const rawScenarioName = exec.scenario.name;
  const scenarioName = rawScenarioName === 'default'
    ? (frontendMode === 'mixed' ? scenarioNames.keepalive : scenarioNames[frontendMode])
    : rawScenarioName;
  const baseTags = createFrontendBaseTags(user, scenarioName ?? rawScenarioName);
  const startedAt = Date.now();
  let succeeded = false;

  recordSessionStarted(baseTags);

  try {
    if (!baseUrl) {
      throw new Error('BASE_URL is required');
    }

    if (scenarioName === scenarioNames.keepalive) {
      runKeepaliveCycle(baseUrl, user, state, params, baseTags);
    } else if (scenarioName === scenarioNames.lists) {
      runListsCycle(baseUrl, user, state, params, baseTags);
    } else if (scenarioName === scenarioNames.admin) {
      runAdminCycle(baseUrl, user, state, params, baseTags);
    } else {
      throw new Error(`Unsupported office scenario raw=${rawScenarioName} effective=${scenarioName}`);
    }

    succeeded = true;
    recordSessionCompleted(baseTags);
  } catch (error) {
    const stepMap = {
      'frontend/account/login': ['login', '/api/frontend/account/login'],
      'frontend/account/me': ['me', '/api/frontend/account/me'],
      'frontend/account/refresh': ['refresh', '/api/frontend/account/refresh'],
      '/api/frontend/customizable-options': ['admin', '/api/frontend/customizable-options'],
      '/api/frontend/customizable-options/global': ['list', '/api/frontend/customizable-options/global'],
      '/api/frontend/devices/get-list': ['list', '/api/frontend/devices/get-list'],
      '/api/frontend/orders/get-list': ['list', '/api/frontend/orders/get-list'],
      '/api/frontend/payments/get-list': ['list', '/api/frontend/payments/get-list'],
      '/api/frontend/api-call-history/get-list': ['list', '/api/frontend/api-call-history/get-list'],
      '/api/frontend/incidents/get-list': ['list', '/api/frontend/incidents/get-list'],
      '/api/frontend/employees/get-list': ['admin', '/api/frontend/employees/get-list'],
      '/api/frontend/employees/get-routes': ['admin', '/api/frontend/employees/get-routes'],
      '/api/frontend/initial-installation': ['admin', '/api/frontend/initial-installation'],
    };

    const [step, endpoint] = stepMap[error?.operationName] ?? ['login', 'combined'];
    recordStepException(step, endpoint, error, baseTags);

    if (error?.response?.status === 401) {
      resetAuthState(state);
    }
  } finally {
    recordSessionOutcome(succeeded, baseTags);
    recordSessionDuration(Date.now() - startedAt, baseTags);
    recordActiveSessions(0, baseTags);
  }
}

export constOfficeScenario = {
  name: 'office',
  options: buildOptionsForMode(),
  run,
};




