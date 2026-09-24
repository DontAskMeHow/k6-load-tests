import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

const sessionSuccessRate = new Rate('k6_kiosk_session_success_rate');
const purchaseSuccessRate = new Rate('k6_kiosk_purchase_success_rate');
const receiptSuccessRate = new Rate('k6_kiosk_receipt_success_rate');

const sessionsStarted = new Counter('k6_kiosk_sessions_started');
const sessionsCompleted = new Counter('k6_kiosk_sessions_completed');
const purchasesStarted = new Counter('k6_kiosk_purchases_started');
const purchasesCompleted = new Counter('k6_kiosk_purchases_completed');
const receiptsGenerated = new Counter('k6_kiosk_receipts_generated');
const authRequests = new Counter('k6_kiosk_auth_requests');
const authFailures = new Counter('k6_kiosk_auth_failures');
const createSessionFailures = new Counter('k6_kiosk_create_session_failures');
const productListFailures = new Counter('k6_kiosk_product_list_failures');
const markingFailures = new Counter('k6_kiosk_marking_failures');
const paymentFailures = new Counter('k6_kiosk_payment_failures');
const purchaseFailures = new Counter('k6_kiosk_purchase_failures');
const receiptFailures = new Counter('k6_kiosk_receipt_failures');
const disconnectFailures = new Counter('k6_kiosk_disconnect_failures');

const authSuccessRate = new Rate('k6_kiosk_auth_success_rate');
const createSessionSuccessRate = new Rate('k6_kiosk_create_session_success_rate');
const productListSuccessRate = new Rate('k6_kiosk_product_list_success_rate');
const markingSuccessRate = new Rate('k6_kiosk_marking_success_rate');
const paymentSuccessRate = new Rate('k6_kiosk_payment_success_rate');
const purchaseStepSuccessRate = new Rate('k6_kiosk_purchase_step_success_rate');
const disconnectSuccessRate = new Rate('k6_kiosk_disconnect_success_rate');

const fullSessionDuration = new Trend('k6_kiosk_full_session_duration', true);
const authDuration = new Trend('k6_kiosk_auth_duration', true);
const createSessionDuration = new Trend('k6_kiosk_create_session_duration', true);
const productListDuration = new Trend('k6_kiosk_product_list_duration', true);
const markingDuration = new Trend('k6_kiosk_marking_duration', true);
const paymentDuration = new Trend('k6_kiosk_payment_duration', true);
const purchaseDuration = new Trend('k6_kiosk_purchase_duration', true);
const receiptDuration = new Trend('k6_kiosk_receipt_duration', true);
const disconnectDuration = new Trend('k6_kiosk_disconnect_duration', true);

const browseCyclesTotal = new Counter('k6_kiosk_browse_cycles_total');
const secondBrowseTriggered = new Counter('k6_kiosk_second_browse_triggered');
const thirdBrowseTriggered = new Counter('k6_kiosk_third_browse_triggered');
const purchaseFlowTriggered = new Counter('k6_kiosk_purchase_flow_triggered');
const reauthCount = new Counter('k6_kiosk_reauth_count');

const deviceErrors = new Counter('k6_kiosk_device_errors');
const deviceSessions = new Counter('k6_kiosk_device_sessions');
const devicePurchases = new Counter('k6_kiosk_device_purchases');

const orderTotal = new Trend('k6_kiosk_order_total', true);
const paymentIdMissing = new Counter('k6_kiosk_payment_id_missing');
const orderIdMissing = new Counter('k6_kiosk_order_id_missing');

const businessErrors = new Counter('k6_kiosk_business_errors');
const serverErrors = new Counter('k6_kiosk_server_errors');
const parseErrors = new Counter('k6_kiosk_parse_errors');
const tokenErrors = new Counter('k6_kiosk_token_errors');
const notFoundErrors = new Counter('k6_kiosk_not_found_errors');
const conflictErrors = new Counter('k6_kiosk_conflict_errors');

const activeDeviceSessions = new Gauge('k6_kiosk_active_device_sessions');
const lastOrderAmount = new Gauge('k6_kiosk_last_order_amount');
const lastPaymentAmount = new Gauge('k6_kiosk_last_payment_amount');

const stepMetrics = {
  auth: {
    duration: authDuration,
    successRate: authSuccessRate,
    failures: authFailures,
  },
  create_session: {
    duration: createSessionDuration,
    successRate: createSessionSuccessRate,
    failures: createSessionFailures,
  },
  product_list: {
    duration: productListDuration,
    successRate: productListSuccessRate,
    failures: productListFailures,
  },
  marking: {
    duration: markingDuration,
    successRate: markingSuccessRate,
    failures: markingFailures,
  },
  payment: {
    duration: paymentDuration,
    successRate: paymentSuccessRate,
    failures: paymentFailures,
  },
  purchase: {
    duration: purchaseDuration,
    successRate: purchaseStepSuccessRate,
    failures: purchaseFailures,
  },
  receipt: {
    duration: receiptDuration,
    successRate: receiptSuccessRate,
    failures: receiptFailures,
  },
  disconnect: {
    duration: disconnectDuration,
    successRate: disconnectSuccessRate,
    failures: disconnectFailures,
  },
};

function normalizeStatus(status) {
  if (status >= 500) {
    return 'server_error';
  }

  if (status >= 400) {
    return 'business_error';
  }

  if (status >= 300) {
    return 'redirect';
  }

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

  if (status === 404) {
    notFoundErrors.add(1, tags);
  }

  if (status === 208 || status === 409) {
    conflictErrors.add(1, tags);
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

export function createClientBaseTags(device) {
  return {
    app: 'kiosk',
    scenario: 'kiosk',
    device: device.serialNumber,
  };
}

export function createRequestTags(baseTags, step, endpoint) {
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
    metrics.failures.add(1, tags);
    addClassifiedError(response.status, tags);
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
    metrics.failures.add(1, tags);

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

  if ((error?.message ?? '').includes('SessionToken') || (error?.message ?? '').includes('Device not found')) {
    tokenErrors.add(1, tags);
  }

  deviceErrors.add(1, tags);
}

export function recordSessionStarted(baseTags) {
  sessionsStarted.add(1, baseTags);
  deviceSessions.add(1, baseTags);
  activeDeviceSessions.add(1, baseTags);
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

export function recordAuthRequested(baseTags) {
  authRequests.add(1, stepTags(baseTags, 'auth', '/api/DeviceAuth', 'started'));
}

export function recordReauth(baseTags) {
  reauthCount.add(1, stepTags(baseTags, 'auth', '/api/DeviceAuth', 'reauth'));
}

export function recordBrowseCycle(baseTags) {
  browseCyclesTotal.add(1, stepTags(baseTags, 'browse_cycle', 'combined', 'completed'));
}

export function recordSecondBrowse(baseTags) {
  secondBrowseTriggered.add(1, stepTags(baseTags, 'browse_cycle', 'combined', 'second'));
}

export function recordThirdBrowse(baseTags) {
  thirdBrowseTriggered.add(1, stepTags(baseTags, 'browse_cycle', 'combined', 'third'));
}

export function recordPurchaseFlowTriggered(baseTags) {
  purchaseFlowTriggered.add(1, stepTags(baseTags, 'purchase_flow', 'combined', 'started'));
  purchasesStarted.add(1, stepTags(baseTags, 'purchase_flow', 'combined', 'started'));
  devicePurchases.add(1, stepTags(baseTags, 'purchase_flow', 'combined', 'started'));
}

export function recordPurchaseCompleted(baseTags) {
  purchasesCompleted.add(1, stepTags(baseTags, 'purchase_flow', 'combined', 'completed'));
  purchaseSuccessRate.add(true, stepTags(baseTags, 'purchase_flow', 'combined', 'completed'));
}

export function recordPurchaseFailed(baseTags) {
  purchaseSuccessRate.add(false, stepTags(baseTags, 'purchase_flow', 'combined', 'failed'));
}

export function recordReceiptGenerated(baseTags) {
  receiptsGenerated.add(1, stepTags(baseTags, 'receipt', '/api/KitOnline/GenerateReceiptLink', 'completed'));
}

export function recordPaymentAmount(amount, baseTags) {
  lastPaymentAmount.add(amount, baseTags);
}

export function recordOrderAmount(amount, baseTags) {
  orderTotal.add(amount, baseTags);
  lastOrderAmount.add(amount, baseTags);
}

export function recordPaymentIdMissing(baseTags) {
  paymentIdMissing.add(1, stepTags(baseTags, 'payment', '/api/Balance/Payment', 'missing_id'));
}

export function recordOrderIdMissing(baseTags) {
  orderIdMissing.add(1, stepTags(baseTags, 'purchase', '/api/Purchase', 'missing_id'));
}

export function recordTokenError(baseTags, step, endpoint) {
  tokenErrors.add(1, stepTags(baseTags, step, endpoint, 'token_error'));
}

export function recordActiveDeviceSessions(value, baseTags) {
  activeDeviceSessions.add(value, baseTags);
}
