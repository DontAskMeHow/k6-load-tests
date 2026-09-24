import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

const cycleSuccessRate = new Rate('k6_robot_cycle_success_rate');
const registerSuccessRate = new Rate('k6_robot_register_success_rate');
const planogramSuccessRate = new Rate('k6_robot_planogram_success_rate');
const planogramListSuccessRate = new Rate('k6_robot_planogram_list_success_rate');

const cyclesStarted = new Counter('k6_robot_cycles_started');
const cyclesCompleted = new Counter('k6_robot_cycles_completed');
const registersStarted = new Counter('k6_robot_registers_started');
const registersCompleted = new Counter('k6_robot_registers_completed');
const planogramRequests = new Counter('k6_robot_planogram_requests');
const planogramListRequests = new Counter('k6_robot_planogram_list_requests');
const buildIdUpdates = new Counter('k6_robot_build_id_updates');
const deviceErrors = new Counter('k6_robot_device_errors');

const cycleDuration = new Trend('k6_robot_cycle_duration', true);
const planogramDuration = new Trend('k6_robot_planogram_duration', true);
const planogramListDuration = new Trend('k6_robot_planogram_list_duration', true);
const registerDuration = new Trend('k6_robot_register_duration', true);

const businessErrors = new Counter('k6_robot_business_errors');
const serverErrors = new Counter('k6_robot_server_errors');
const parseErrors = new Counter('k6_robot_parse_errors');
const notFoundErrors = new Counter('k6_robot_not_found_errors');
const conflictErrors = new Counter('k6_robot_conflict_errors');

const activeCycles = new Gauge('k6_robot_active_cycles');
const buildIdPresent = new Gauge('k6_robot_build_id_present');

const stepMetrics = {
  planogram: {
    duration: planogramDuration,
    successRate: planogramSuccessRate,
    counter: planogramRequests,
  },
  planogram_list: {
    duration: planogramListDuration,
    successRate: planogramListSuccessRate,
    counter: planogramListRequests,
  },
  register: {
    duration: registerDuration,
    successRate: registerSuccessRate,
    counter: registersStarted,
  },
};

function normalizeStatus(status) {
  if (status >= 500) {
    return 'server_error';
  }

  if (status >= 400) {
    return 'business_error';
  }

  return 'success';
}

function tags(baseTags, step, endpoint, status, extra = {}) {
  return {
    ...baseTags,
    step,
    endpoint,
    status,
    ...extra,
  };
}

function recordClassifiedError(status, metricTags) {
  if (status >= 500) {
    serverErrors.add(1, metricTags);
    return;
  }

  if (status >= 400) {
    businessErrors.add(1, metricTags);
  }

  if (status === 404) {
    notFoundErrors.add(1, metricTags);
  }

  if (status === 208 || status === 409) {
    conflictErrors.add(1, metricTags);
  }
}

export function createHardwareBaseTags(device) {
  return {
    app: 'robot',
    scenario: 'robot',
    device: device.serialNumber,
  };
}

export function createHardwareRequestTags(baseTags, step, endpoint) {
  return tags(baseTags, step, endpoint, 'request');
}

export function recordCycleStarted(baseTags) {
  cyclesStarted.add(1, baseTags);
  activeCycles.add(1, baseTags);
}

export function recordCycleCompleted(baseTags) {
  cyclesCompleted.add(1, baseTags);
}

export function recordCycleOutcome(success, baseTags) {
  cycleSuccessRate.add(success, baseTags);
}

export function recordCycleDuration(durationMs, baseTags) {
  cycleDuration.add(durationMs, baseTags);
}

export function recordStepResult(step, endpoint, response, baseTags, successStatuses = [200]) {
  const config = stepMetrics[step];
  const metricTags = tags(baseTags, step, endpoint, normalizeStatus(response.status), {
    http_status: String(response.status),
  });
  const isSuccess = successStatuses.includes(response.status);

  config.counter.add(1, metricTags);
  config.duration.add(response.timings?.duration ?? 0, metricTags);
  config.successRate.add(isSuccess, metricTags);

  if (!isSuccess) {
    recordClassifiedError(response.status, metricTags);
  }
}

export function recordStepException(step, endpoint, error, baseTags) {
  const config = stepMetrics[step];
  const response = error?.response;
  const status = response?.status ?? 0;
  const metricTags = tags(baseTags, step, endpoint, 'exception', {
    http_status: String(status),
  });

  if (config) {
    config.successRate.add(false, metricTags);

    if (response?.timings?.duration != null) {
      config.duration.add(response.timings.duration, metricTags);
    }
  }

  if (error?.isParseError) {
    parseErrors.add(1, metricTags);
  }

  if (status > 0) {
    recordClassifiedError(status, metricTags);
  }

  deviceErrors.add(1, metricTags);
}

export function recordRegisterCompleted(baseTags) {
  registersCompleted.add(1, tags(baseTags, 'register', '/api/initial-installation/hardware/register', 'completed'));
}

export function recordBuildIdUpdated(hasBuildId, baseTags) {
  if (hasBuildId) {
    buildIdUpdates.add(1, baseTags);
    buildIdPresent.add(1, baseTags);
  } else {
    buildIdPresent.add(0, baseTags);
  }
}

export function recordActiveCycles(value, baseTags) {
  activeCycles.add(value, baseTags);
}
