import { sleep } from 'k6';
import {
  createCustomerSession as createCustomerSessionRequest,
  createJsonParams,
  createTaggedParams,
  deviceAuth,
  ensureSuccess,
  generateReceiptLink,
  getMarkingCodeVerificationResults,
  getParsedBody,
  getProductList,
  registerBalancePayment,
  registerPurchase as registerPurchaseRequest,
  timeoutDisconnect,
} from '../lib/api.js';
import {
  createClientBaseTags,
  createRequestTags,
  recordActiveDeviceSessions,
  recordAuthRequested,
  recordBrowseCycle,
  recordOrderAmount,
  recordOrderIdMissing,
  recordPaymentAmount,
  recordPaymentIdMissing,
  recordPurchaseCompleted,
  recordPurchaseFailed,
  recordPurchaseFlowTriggered,
  recordReceiptGenerated,
  recordReauth,
  recordSecondBrowse,
  recordSessionCompleted,
  recordSessionDuration,
  recordSessionOutcome,
  recordSessionStarted,
  recordStepException,
  recordStepResult,
  recordThirdBrowse,
  recordTokenError,
} from '../lib/kioskMetrics.js';
import { chance, think } from '../lib/random.js';
import { loadProfile, loadSharedRecords, createPerVuState, getVuRecord, buildOptions, ensureUniqueField, secondsPerDayEvent } from '../lib/scenarioRuntime.js';
import { createDeviceState } from '../lib/deviceState.js';

const profilePath = import.meta.resolve('../config/kiosk-load-profile.example.json');
const dataPath = import.meta.resolve('../data/kiosk-devices.example.json');

const profile = loadProfile(profilePath);
const devices = loadSharedRecords('kiosk-devices', dataPath);
ensureUniqueField(devices, dataPath, 'serialNumber');
const getState = createPerVuState(createDeviceState);

function sessionIntervalSeconds() {
  return secondsPerDayEvent(profile.sessionsPerDay, profile.timeCompression);
}

function getDevice() {
  return getVuRecord(devices, dataPath);
}

function authPayload(device) {
  return {
    serialNumber: device.serialNumber,
    pin: device.pin,
    version: device.version,
    hardwareVersion: device.hardwareVersion,
  };
}

function getStepParams(params, baseTags, step, endpoint) {
  return createTaggedParams(params, createRequestTags(baseTags, step, endpoint));
}

function ensureAuthorized(baseUrl, device, state, params, baseTags) {
  if (state.isAuthorized && state.deviceSessionToken) {
    return;
  }

  if (state.isAuthorized && !state.deviceSessionToken) {
    recordReauth(baseTags);
  }

  recordAuthRequested(baseTags);

  const response = deviceAuth(
    baseUrl,
    authPayload(device),
    getStepParams(params, baseTags, 'auth', '/api/DeviceAuth'),
  );
  recordStepResult('auth', '/api/DeviceAuth', response, baseTags);

  const body = getParsedBody(response, 'DeviceAuth');

  if (!body.DeviceSessionToken) {
    recordTokenError(baseTags, 'auth', '/api/DeviceAuth');
    throw new Error(`DeviceAuth did not return DeviceSessionToken. Status=${response.status}, Body=${response.body}`);
  }

  state.deviceSessionToken = body.DeviceSessionToken;
  state.isAuthorized = true;
}

function createSession(baseUrl, state, params, baseTags) {
  const response = createCustomerSessionRequest(
    baseUrl,
    { DeviceSessionToken: state.deviceSessionToken },
    getStepParams(params, baseTags, 'create_session', '/api/CustomerSessions/CreateSession'),
  );

  recordStepResult('create_session', '/api/CustomerSessions/CreateSession', response, baseTags);
  ensureSuccess(response, 'CreateSession');
}

function browseCycle(baseUrl, device, state, params, baseTags) {
  const productListResponse = getProductList(
    baseUrl,
    { deviceSessionToken: state.deviceSessionToken },
    getStepParams(params, baseTags, 'product_list', '/api/ProductList'),
  );
  recordStepResult('product_list', '/api/ProductList', productListResponse, baseTags);
  ensureSuccess(productListResponse, 'ProductList');
  think(device.timeouts?.catalogMinSeconds ?? 1, device.timeouts?.catalogMaxSeconds ?? 2);

  const markingResponse = getMarkingCodeVerificationResults(
    baseUrl,
    { deviceSessionToken: state.deviceSessionToken },
    getStepParams(params, baseTags, 'marking', '/api/MarkingCodeVerificationResults/GetList'),
  );
  recordStepResult('marking', '/api/MarkingCodeVerificationResults/GetList', markingResponse, baseTags);
  ensureSuccess(markingResponse, 'MarkingCodeVerificationResults/GetList');

  recordBrowseCycle(baseTags);
  think(device.timeouts?.catalogMinSeconds ?? 1, device.timeouts?.catalogMaxSeconds ?? 2);
}

function registerPayment(baseUrl, device, state, params, baseTags) {
  const template = device.paymentTemplate;
  const response = registerBalancePayment(
    baseUrl,
    {
      deviceSessionToken: state.deviceSessionToken,
      delta: template.delta,
      paymentTypeId: template.paymentTypeId,
      cardTransactionDetails: template.cardTransactionDetails,
      sbpTransactionDetails: template.sbpTransactionDetails,
    },
    getStepParams(params, baseTags, 'payment', '/api/Balance/Payment'),
  );
  recordStepResult('payment', '/api/Balance/Payment', response, baseTags);
  const body = getParsedBody(response, 'Balance/Payment');

  state.lastPaymentId = body?.Id ?? body?.id ?? null;
  recordPaymentAmount(template.delta ?? 0, baseTags);

  if (!state.lastPaymentId) {
    recordPaymentIdMissing(baseTags);
    throw new Error(`Balance/Payment did not return payment id. Status=${response.status}, Body=${response.body}`);
  }
}

function registerPurchase(baseUrl, device, state, params, baseTags) {
  const template = device.purchaseTemplate;
  const response = registerPurchaseRequest(
    baseUrl,
    {
      deviceSessionToken: state.deviceSessionToken,
      deviceSerialNumber: template.deviceSerialNumber ?? device.serialNumber,
      orderTotal: template.orderTotal,
      paidByPA: template.paidByPA ?? 0,
      paidByCash: template.paidByCash ?? 0,
      paidByCard: template.paidByCard ?? 0,
      paidBySBP: template.paidBySBP ?? 0,
      stockedItemsL: template.stockedItemsL,
      stockedItemsR: template.stockedItemsR,
      cassettesToDrop: template.cassettesToDrop,
      paymentIds: state.lastPaymentId ? [state.lastPaymentId] : [],
    },
    getStepParams(params, baseTags, 'purchase', '/api/Purchase'),
  );
  recordStepResult('purchase', '/api/Purchase', response, baseTags);
  const body = getParsedBody(response, 'Purchase');

  state.lastOrderId = body?.orderId ?? null;
  recordOrderAmount(template.orderTotal ?? 0, baseTags);

  if (!state.lastOrderId) {
    recordOrderIdMissing(baseTags);
    throw new Error(`Purchase did not return orderId. Status=${response.status}, Body=${response.body}`);
  }
}

function generateReceipt(baseUrl, device, state, params, baseTags) {
  const template = device.receiptTemplate ?? {};
  const response = generateReceiptLink(
    baseUrl,
    {
      deviceSessionToken: state.deviceSessionToken,
      orderId: state.lastOrderId,
      userEmail: template.userEmail,
      userPhoneNumber: template.userPhoneNumber,
    },
    getStepParams(params, baseTags, 'receipt', '/api/KitOnline/GenerateReceiptLink'),
  );

  recordStepResult('receipt', '/api/KitOnline/GenerateReceiptLink', response, baseTags);
  ensureSuccess(response, 'KitOnline/GenerateReceiptLink');
  recordReceiptGenerated(baseTags);
}

function disconnect(baseUrl, state, params, baseTags) {
  const response = timeoutDisconnect(
    baseUrl,
    { deviceSessionToken: state.deviceSessionToken },
    getStepParams(params, baseTags, 'disconnect', '/api/Auth/TimeOutDisconnect'),
  );

  recordStepResult('disconnect', '/api/Auth/TimeOutDisconnect', response, baseTags);
  ensureSuccess(response, 'Auth/TimeOutDisconnect');
}

function run() {
  const baseUrl = __ENV.BASE_URL;
  const device = getDevice();
  const state = getState();
  const params = createJsonParams(device.headers);
  const baseTags = createClientBaseTags(device);
  const startedAt = Date.now();

  recordSessionStarted(baseTags);

  let sessionSucceeded = false;
  let purchaseTriggered = false;
  let purchaseCompleted = false;

  try {
    ensureAuthorized(baseUrl, device, state, params, baseTags);
    createSession(baseUrl, state, params, baseTags);
    think(1, 2);

    browseCycle(baseUrl, device, state, params, baseTags);

    if (chance(profile.secondBrowseProbability)) {
      recordSecondBrowse(baseTags);
      browseCycle(baseUrl, device, state, params, baseTags);
    }

    if (chance(profile.thirdBrowseProbability)) {
      recordThirdBrowse(baseTags);
      browseCycle(baseUrl, device, state, params, baseTags);
    }

    if (chance(profile.purchaseProbability)) {
      purchaseTriggered = true;
      recordPurchaseFlowTriggered(baseTags);
      registerPayment(baseUrl, device, state, params, baseTags);
      think(device.timeouts?.afterPaymentMinSeconds ?? 1, device.timeouts?.afterPaymentMaxSeconds ?? 2);
      registerPurchase(baseUrl, device, state, params, baseTags);
      think(device.timeouts?.afterPurchaseMinSeconds ?? 1, device.timeouts?.afterPurchaseMaxSeconds ?? 2);
      generateReceipt(baseUrl, device, state, params, baseTags);
      purchaseCompleted = true;
      recordPurchaseCompleted(baseTags);
    }

    think(device.timeouts?.beforeDisconnectMinSeconds ?? 1, device.timeouts?.beforeDisconnectMaxSeconds ?? 3);
    disconnect(baseUrl, state, params, baseTags);

    sessionSucceeded = true;
    recordSessionCompleted(baseTags);
  } catch (error) {
    const operationName = error?.operationName ?? '';
    const operationStepMap = {
      DeviceAuth: ['auth', '/api/DeviceAuth'],
      CreateSession: ['create_session', '/api/CustomerSessions/CreateSession'],
      ProductList: ['product_list', '/api/ProductList'],
      'MarkingCodeVerificationResults/GetList': ['marking', '/api/MarkingCodeVerificationResults/GetList'],
      'Balance/Payment': ['payment', '/api/Balance/Payment'],
      Purchase: ['purchase', '/api/Purchase'],
      'KitOnline/GenerateReceiptLink': ['receipt', '/api/KitOnline/GenerateReceiptLink'],
      'Auth/TimeOutDisconnect': ['disconnect', '/api/Auth/TimeOutDisconnect'],
    };

    const [step, endpoint] = operationStepMap[operationName] ?? ['session', 'combined'];
    recordStepException(step, endpoint, error, baseTags);

    if ((error?.message ?? '').includes('Device not found') || (error?.message ?? '').includes('SessionToken')) {
      state.isAuthorized = false;
      state.deviceSessionToken = null;
      recordTokenError(baseTags, step, endpoint);
    }

    if (purchaseTriggered && !purchaseCompleted) {
      recordPurchaseFailed(baseTags);
    }
  } finally {
    recordSessionOutcome(sessionSucceeded, baseTags);
    recordSessionDuration(Date.now() - startedAt, baseTags);
    recordActiveDeviceSessions(0, baseTags);
    sleep(sessionIntervalSeconds());
  }
}

export constKioskScenario = {
  name: 'kiosk',
  options: buildOptions(profile),
  run,
};
