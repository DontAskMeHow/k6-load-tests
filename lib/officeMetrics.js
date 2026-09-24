import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

const sessionSuccessRate = new Rate('k6_office_session_success_rate');
const loginSuccessRate = new Rate('k6_office_login_success_rate');
const meSuccessRate = new Rate('k6_office_me_success_rate');
const refreshSuccessRate = new Rate('k6_office_refresh_success_rate');
const listsSuccessRate = new Rate('k6_office_lists_success_rate');
const adminSuccessRate = new Rate('k6_office_admin_success_rate');

const sessionsStarted = new Counter('k6_office_sessions_started');
const sessionsCompleted = new Counter('k6_office_sessions_completed');
const logins = new Counter('k6_office_logins');
const refreshes = new Counter('k6_office_refreshes');
const listRequests = new Counter('k6_office_list_requests');
const adminRequests = new Counter('k6_office_admin_requests');
const authFailures = new Counter('k6_office_auth_failures');
const businessErrors = new Counter('k6_office_business_errors');
const serverErrors = new Counter('k6_office_server_errors');
const parseErrors = new Counter('k6_office_parse_errors');
const tokenErrors = new Counter('k6_office_token_errors');
const activeSessions = new Gauge('k6_office_active_sessions');

const fullSessionDuration = new Trend('k6_office_full_session_duration', true);
const loginDuration = new Trend('k6_office_login_duration', true);
const meDuration = new Trend('k6_office_me_duration', true);
const refreshDuration = new Trend('k6_office_refresh_duration', true);
const listDuration = new Trend('k6_office_list_duration', true);
const adminDuration = new Trend('k6_office_admin_duration', true);

const stepMetrics = {
  login: { duration: loginDuration, successRate: loginSuccessRate },
  me: { duration: meDuration, successRate: meSuccessRate },
  refresh: { duration: refreshDuration, successRate: refreshSuccessRate },
  list: { duration: listDuration, successRate: listsSuccessRate },
  admin: { duration: adminDuration, successRate: adminSuccessRate },
};

function normalizeStatus(status) {
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'business_error';
  if (status >= 300) return 'redirect';
  return 'success';
}

function addClassifiedError(status, tags) {
  if (status >= 500) {
    serverErrors.add(1, tags);
    return;
  }

  if (status >= 400) {
    businessErrors.add(1, tags);
  }
}

function stepTags(baseTags, step, endpoint, status, extra = {}) {
  return {
    ...baseTags,
    step,
    endpoint,
    status,
    ...extra,
  };
}

export function createFrontendBaseTags(user, scenarioName) {
  return {
    app: 'office',
    scenario: scenarioName,
    user: user.userId,
    mode: (__ENV.OFFICE_MODE ?? 'mixed').toLowerCase(),
  };
}

export function createFrontendRequestTags(baseTags, step, endpoint) {
  return stepTags(baseTags, step, endpoint, 'request');
}

export function recordStepResult(step, endpoint, response, baseTags, successStatuses = [200]) {
  const metrics = stepMetrics[step];
  const isSuccess = successStatuses.includes(response.status);
  const tags = stepTags(baseTags, step, endpoint, normalizeStatus(response.status), {
    http_status: String(response.status),
  });

  metrics.duration.add(response.timings?.duration ?? 0, tags);
  metrics.successRate.add(isSuccess, tags);

  if (!isSuccess) {
    addClassifiedError(response.status, tags);
    if (response.status === 401) {
      authFailures.add(1, tags);
      tokenErrors.add(1, tags);
    }
  }

  return isSuccess;
}

export function recordStepException(step, endpoint, error, baseTags) {
  const metrics = stepMetrics[step];
  const response = error?.response;
  const status = response?.status ?? 0;
  const tags = stepTags(baseTags, step, endpoint, 'exception', {
    http_status: String(status),
  });

  if (metrics) {
    metrics.successRate.add(false, tags);

    if (response?.timings?.duration != null) {
      metrics.duration.add(response.timings.duration, tags);
    }
  }

  if (error?.isParseError) {
    parseErrors.add(1, tags);
  }

  if (status > 0) {
    addClassifiedError(status, tags);
  }

  if (status === 401 || (error?.message ?? '').includes('Unauthorized')) {
    authFailures.add(1, tags);
    tokenErrors.add(1, tags);
  }
}

export function recordSessionStarted(baseTags) {
  sessionsStarted.add(1, baseTags);
  activeSessions.add(1, baseTags);
}

export function recordSessionCompleted(baseTags) {
  sessionsCompleted.add(1, baseTags);
}

export function recordSessionOutcome(success, baseTags) {
  sessionSuccessRate.add(success, baseTags);
}

export function recordSessionDuration(durationMs, baseTags) {
  fullSessionDuration.add(durationMs, baseTags);
}

export function recordLogin(baseTags) {
  logins.add(1, stepTags(baseTags, 'login', '/api/frontend/account/login', 'completed'));
}

export function recordRefresh(baseTags) {
  refreshes.add(1, stepTags(baseTags, 'refresh', '/api/frontend/account/refresh', 'completed'));
}

export function recordListRequest(baseTags, endpoint) {
  listRequests.add(1, stepTags(baseTags, 'list', endpoint, 'completed'));
}

export function recordAdminRequest(baseTags, endpoint) {
  adminRequests.add(1, stepTags(baseTags, 'admin', endpoint, 'completed'));
}

export function recordActiveSessions(value, baseTags) {
  activeSessions.add(value, baseTags);
}
