import { sleep } from 'k6';
import {
  createJsonParams,
  createTaggedParams,
  ensureSuccess,
  getCellsPlanogram,
  getCellsPlanogramList,
  getParsedBody,
  registerHardware,
} from '../lib/api.js';
import {
  createHardwareBaseTags,
  createHardwareRequestTags,
  recordActiveCycles,
  recordBuildIdUpdated,
  recordCycleCompleted,
  recordCycleDuration,
  recordCycleOutcome,
  recordCycleStarted,
  recordRegisterCompleted,
  recordStepException,
  recordStepResult,
} from '../lib/robotMetrics.js';
import { chance, think } from '../lib/random.js';
import { loadProfile, loadSharedRecords, createPerVuState, getVuRecord, buildOptions, ensureUniqueField, secondsPerDayEvent } from '../lib/scenarioRuntime.js';
import { createHardwareState } from '../lib/robotState.js';

const profilePath = import.meta.resolve('../config/robot-load-profile.example.json');
const dataPath = import.meta.resolve('../data/robot-devices.example.json');

const profile = loadProfile(profilePath);
const devices = loadSharedRecords('robot-devices', dataPath);
ensureUniqueField(devices, dataPath, 'serialNumber');
const getState = createPerVuState(createHardwareState);

function sessionIntervalSeconds() {
  return secondsPerDayEvent(profile.planogramRequestsPerDay, profile.timeCompression);
}

function getDevice() {
  return getVuRecord(devices, dataPath);
}

function getStepParams(params, baseTags, step, endpoint) {
  return createTaggedParams(params, createHardwareRequestTags(baseTags, step, endpoint));
}

function getPlanogram(baseUrl, device, params, baseTags) {
  const response = getCellsPlanogram(
    baseUrl,
    device.serialNumber,
    getStepParams(params, baseTags, 'planogram', '/api/cells/get-list/{serialNumber}'),
  );

  recordStepResult('planogram', '/api/cells/get-list/{serialNumber}', response, baseTags);
  ensureSuccess(response, 'cells/get-list');
}

function getAvailablePlanograms(baseUrl, params, baseTags) {
  const response = getCellsPlanogramList(
    baseUrl,
    getStepParams(params, baseTags, 'planogram_list', '/api/cells/v2/get-list'),
  );

  recordStepResult('planogram_list', '/api/cells/v2/get-list', response, baseTags);
  ensureSuccess(response, 'cells/v2/get-list');
}

function registerHardwareIfNeeded(baseUrl, device, state, params, baseTags) {
  const response = registerHardware(
    baseUrl,
    {
      deviceSerialNumber: device.serialNumber,
      pin: device.pin,
      buildId: state.buildId,
      modules: device.modules,
    },
    getStepParams(params, baseTags, 'register', '/api/initial-installation/hardware/register'),
  );
  recordStepResult('register', '/api/initial-installation/hardware/register', response, baseTags);
  const body = getParsedBody(response, 'initial-installation/hardware/register');

  const previousBuildId = state.buildId;
  state.buildId = body.BuildId ?? state.buildId;
  recordBuildIdUpdated(Boolean(state.buildId && state.buildId !== previousBuildId), baseTags);
  recordRegisterCompleted(baseTags);
}

function run() {
  const baseUrl = __ENV.BASE_URL;
  const device = getDevice();
  const state = getState();
  const params = createJsonParams(device.headers);
  const baseTags = createHardwareBaseTags(device);
  const startedAt = Date.now();
  let cycleSucceeded = false;

  recordCycleStarted(baseTags);

  try {
    getPlanogram(baseUrl, device, params, baseTags);
    think(device.timeouts?.afterPlanogramMinSeconds ?? 1, device.timeouts?.afterPlanogramMaxSeconds ?? 2);

    if (chance(profile.availablePlanogramsProbability)) {
      getAvailablePlanograms(baseUrl, params, baseTags);
      think(device.timeouts?.afterPlanogramListMinSeconds ?? 1, device.timeouts?.afterPlanogramListMaxSeconds ?? 2);
    }

    if (chance(profile.hardwareRegisterProbability)) {
      registerHardwareIfNeeded(baseUrl, device, state, params, baseTags);
      think(device.timeouts?.afterRegisterMinSeconds ?? 1, device.timeouts?.afterRegisterMaxSeconds ?? 2);
    }

    cycleSucceeded = true;
    recordCycleCompleted(baseTags);
  } catch (error) {
    const stepMap = {
      'cells/get-list': ['planogram', '/api/cells/get-list/{serialNumber}'],
      'cells/v2/get-list': ['planogram_list', '/api/cells/v2/get-list'],
      'initial-installation/hardware/register': ['register', '/api/initial-installation/hardware/register'],
    };
    const [step, endpoint] = stepMap[error?.operationName] ?? ['cycle', 'combined'];
    recordStepException(step, endpoint, error, baseTags);
  } finally {
    recordCycleOutcome(cycleSucceeded, baseTags);
    recordCycleDuration(Date.now() - startedAt, baseTags);
    recordActiveCycles(0, baseTags);
    sleep(sessionIntervalSeconds());
  }
}

export constRobotScenario = {
  name: 'robot',
  options: buildOptions(profile),
  run,
};
