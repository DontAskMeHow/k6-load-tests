import { sleep } from 'k6';
import {
  authorizeEmployee,
  closeWorkingDay,
  confirmDisplacementToDevice,
  confirmProductsRecalculation,
  confirmProductsScanning,
  createJsonParams,
  createTaggedParams,
  ensureSuccess,
  endVisit,
  generateProductsRecalculationQrCode,
  getDisplacementToDeviceDocumentData,
  getDisplacements,
  getForwarderRouteSheets,
  getParsedBody,
  getProductsRecalculationDocumentData,
  getProductsRecalculationTasks,
  getServiceSettings,
  getDeviceConfiguration,
  getDeviceContents,
  getWorkingDays,
  openWorkingDay,
  requestProductsRecalculationDocument,
  startVisit,
  validateTrueMark,
} from '../lib/api.js';
import {
  createServiceBaseTags,
  createServiceRequestTags,
  recordActiveCycles,
  recordCycleCompleted,
  recordCycleDuration,
  recordCycleOutcome,
  recordCycleStarted,
  recordDisplacementToDeviceDocumentConfirmed,
  recordDisplacementToDeviceDocumentFetched,
  recordProductsScanningConfirmed,
  recordRecalculationDocumentConfirmed,
  recordRecalculationDocumentFetched,
  recordRecalculationDocumentRequested,
  recordRecalculationQrGenerated,
  recordStepException,
  recordStepResult,
  recordTokenError,
  recordTrueMarkRequest,
  recordVisitEnded,
  recordVisitStarted,
  recordWorkingDayClosed,
  recordWorkingDayOpened,
} from '../lib/fieldMetrics.js';
import { chance, think } from '../lib/random.js';
import { loadProfile, loadSharedRecords, createPerVuState, getVuRecord, buildOptions, ensureUniqueField, secondsPerDayEvent } from '../lib/scenarioRuntime.js';
import { createServiceState } from '../lib/fieldState.js';

const profilePath = import.meta.resolve('../config/field-load-profile.example.json');
const dataPath = import.meta.resolve('../data/field-employees.example.json');

const profile = loadProfile(profilePath);
const employees = loadSharedRecords('field-employees', dataPath);
ensureUniqueField(employees, dataPath, 'employeeId');
const getState = createPerVuState(createServiceState);
const scenarioMode = (__ENV.FIELD_SCENARIO_MODE ?? 'simple').toLowerCase();

function cycleIntervalSeconds() { return secondsPerDayEvent(profile.workCyclesPerDay, profile.timeCompression); }
function isFullMode() { return scenarioMode === 'full'; }
function getEmployee() { return getVuRecord(employees, dataPath); }
function getStepParams(params, baseTags, step, endpoint) { return createTaggedParams(params, createServiceRequestTags(baseTags, step, endpoint)); }
function pickRandomItem(items) { return !items || items.length === 0 ? null : items[Math.floor(Math.random() * items.length)]; }

function ensureAuthorized(baseUrl, employee, state, params, baseTags) {
  if (state.isAuthorized && state.employeeSessionToken) return;
  const response = authorizeEmployee(baseUrl, { login: employee.login, password: employee.password, sessionToken: '', version: employee.version }, getStepParams(params, baseTags, 'authorize', '/api/EmployeesAuth/Authorize'));
  recordStepResult('authorize', '/api/EmployeesAuth/Authorize', response, baseTags);
  const body = getParsedBody(response, 'EmployeesAuth/Authorize');
  state.employeeSessionToken = body?.SessionToken ?? body?.sessionToken ?? null;
  state.isAuthorized = Boolean(state.employeeSessionToken);
  if (!state.employeeSessionToken) {
    recordTokenError(baseTags, 'authorize', '/api/EmployeesAuth/Authorize');
    throw new Error(`EmployeesAuth/Authorize did not return SessionToken. Status=${response.status}, Body=${response.body}`);
  }
}

function maybeGetServiceSettings(baseUrl, state, params, baseTags) {
  if (!chance(profile.serviceSettingsProbability)) return;
  const response = getServiceSettings(baseUrl, { employeeSessionToken: state.employeeSessionToken }, getStepParams(params, baseTags, 'service_settings', '/api/service-settings'));
  recordStepResult('service_settings', '/api/service-settings', response, baseTags);
  ensureSuccess(response, 'service-settings');
}

function refreshWorkingDays(baseUrl, state, params, baseTags) {
  const response = getWorkingDays(baseUrl, { employeeSessionToken: state.employeeSessionToken }, getStepParams(params, baseTags, 'working_days', '/api/WorkingDays/GetList'));
  recordStepResult('working_days', '/api/WorkingDays/GetList', response, baseTags);
  const body = getParsedBody(response, 'WorkingDays/GetList');
  const days = Array.isArray(body) ? body : [];
  const openDay = days.find((d) => d.Status === 'Open' || d.status === 'Open');
  state.workingDay = openDay ?? null;
  state.workingDayId = openDay?.Id ?? openDay?.id ?? null;
}

function openWorkingDayIfNeeded(baseUrl, state, params, baseTags) {
  if (state.workingDayId || !chance(profile.workingDayOpenProbability)) return;
  const response = openWorkingDay(baseUrl, { employeeSessionToken: state.employeeSessionToken }, getStepParams(params, baseTags, 'working_day_open', '/api/WorkingDays/Open'));
  recordStepResult('working_day_open', '/api/WorkingDays/Open', response, baseTags, [200, 208]);
  ensureSuccess(response, 'WorkingDays/Open');
  const body = getParsedBody(response, 'WorkingDays/Open');
  state.workingDay = body;
  state.workingDayId = body?.Id ?? body?.id ?? null;
  recordWorkingDayOpened(baseTags);
}

function refreshRouteSheets(baseUrl, state, params, baseTags) {
  const response = getForwarderRouteSheets(baseUrl, { employeeSessionToken: state.employeeSessionToken }, getStepParams(params, baseTags, 'route_sheets', '/api/RouteSheets/GetForwarderList'));
  recordStepResult('route_sheets', '/api/RouteSheets/GetForwarderList', response, baseTags);
  const body = getParsedBody(response, 'RouteSheets/GetForwarderList');
  state.routeSheets = Array.isArray(body) ? body : [];
  state.routeSheetEntries = state.routeSheets.flatMap((sheet) => sheet.RouteSheetEntries ?? sheet.routeSheetEntries ?? []);
}

function ensureCurrentRouteEntry(state) {
  const routeEntry = pickRandomItem(state.routeSheetEntries);
  if (!routeEntry) return null;
  state.currentRouteEntry = routeEntry;
  state.currentDeviceSerialNumber = routeEntry.DeviceSerialNumber ?? routeEntry.deviceSerialNumber ?? null;
  return routeEntry;
}

function maybeVisitFlow(baseUrl, state, params, baseTags) {
  const routeEntry = ensureCurrentRouteEntry(state);
  if (!routeEntry || !chance(profile.visitProbability)) return;
  const routeSheetEntryId = routeEntry.Id ?? routeEntry.id;
  const serialNumber = routeEntry.DeviceSerialNumber ?? routeEntry.deviceSerialNumber;
  const startResponse = startVisit(baseUrl, { employeeSessionToken: state.employeeSessionToken, routeSheetEntryId }, getStepParams(params, baseTags, 'visit_start', '/api/Visits/Start'));
  recordStepResult('visit_start', '/api/Visits/Start', startResponse, baseTags);
  ensureSuccess(startResponse, 'Visits/Start');
  recordVisitStarted(baseTags);
  if (serialNumber && chance(profile.deviceConfigurationProbability)) {
    const deviceConfigResponse = getDeviceConfiguration(baseUrl, { employeeSessionToken: state.employeeSessionToken, deviceSerialNumber: serialNumber }, getStepParams(params, baseTags, 'device_configuration', '/api/EmployeesAuth/GetDeviceConfiguration'));
    recordStepResult('device_configuration', '/api/EmployeesAuth/GetDeviceConfiguration', deviceConfigResponse, baseTags);
    ensureSuccess(deviceConfigResponse, 'EmployeesAuth/GetDeviceConfiguration');
    think(1, 2);
  }
  const endResponse = endVisit(baseUrl, { employeeSessionToken: state.employeeSessionToken, routeSheetEntryId }, getStepParams(params, baseTags, 'visit_end', '/api/Visits/End'));
  recordStepResult('visit_end', '/api/Visits/End', endResponse, baseTags);
  ensureSuccess(endResponse, 'Visits/End');
  recordVisitEnded(baseTags);
}

function refreshDisplacements(baseUrl, state, params, baseTags) {
  if (!chance(profile.displacementsProbability)) { state.displacements = []; return; }
  const response = getDisplacements(baseUrl, { employeeSessionToken: state.employeeSessionToken }, getStepParams(params, baseTags, 'displacements', '/api/Displacements/GetList'));
  recordStepResult('displacements', '/api/Displacements/GetList', response, baseTags);
  const body = getParsedBody(response, 'Displacements/GetList');
  state.displacements = Array.isArray(body) ? body : [];
}

function maybeGetDeviceContents(baseUrl, state, params, baseTags) {
  if (!isFullMode() || !state.currentDeviceSerialNumber || !chance(profile.deviceContentsProbability)) return;
  const response = getDeviceContents(baseUrl, { employeeSessionToken: state.employeeSessionToken, deviceSerialNumber: state.currentDeviceSerialNumber }, getStepParams(params, baseTags, 'device_contents', '/api/DisplacementsFromDevice/GetDeviceContents'));
  recordStepResult('device_contents', '/api/DisplacementsFromDevice/GetDeviceContents', response, baseTags);
  ensureSuccess(response, 'DisplacementsFromDevice/GetDeviceContents');
}

function normalizeConfirmedProducts(products) {
  return (products ?? []).map((product) => ({ ...product, ActualQuantity: product.ActualQuantity ?? product.actualQuantity ?? product.Quantity ?? product.quantity ?? 0 }));
}

function maybeDisplacementToDeviceFlow(baseUrl, state, params, baseTags) {
  const routeEntry = state.currentRouteEntry;
  const documentId = routeEntry?.DisplacementToDeviceId ?? routeEntry?.displacementToDeviceId;
  if (!isFullMode() || !documentId || !chance(profile.displacementToDeviceFlowProbability)) return;
  const getResponse = getDisplacementToDeviceDocumentData(baseUrl, { employeeSessionToken: state.employeeSessionToken, documentId }, getStepParams(params, baseTags, 'displacement_to_device_get_document', '/api/DisplacementsToDevice/GetDocumentData'));
  recordStepResult('displacement_to_device_get_document', '/api/DisplacementsToDevice/GetDocumentData', getResponse, baseTags);
  const products = getParsedBody(getResponse, 'DisplacementsToDevice/GetDocumentData');
  recordDisplacementToDeviceDocumentFetched(baseTags);
  const confirmResponse = confirmDisplacementToDevice(baseUrl, { employeeSessionToken: state.employeeSessionToken, documentId, products: normalizeConfirmedProducts(products) }, getStepParams(params, baseTags, 'displacement_to_device_confirm', '/api/DisplacementsToDevice/Confirm'));
  recordStepResult('displacement_to_device_confirm', '/api/DisplacementsToDevice/Confirm', confirmResponse, baseTags);
  ensureSuccess(confirmResponse, 'DisplacementsToDevice/Confirm');
  recordDisplacementToDeviceDocumentConfirmed(baseTags);
}

function refreshProductsRecalculationTasks(baseUrl, state, params, baseTags) {
  if (!chance(profile.productsRecalculationTasksProbability)) { state.productsRecalculationTasks = []; return; }
  const response = getProductsRecalculationTasks(baseUrl, { employeeSessionToken: state.employeeSessionToken }, getStepParams(params, baseTags, 'recalculation_tasks', '/api/ProductsRecalculationTasks/GetList'));
  recordStepResult('recalculation_tasks', '/api/ProductsRecalculationTasks/GetList', response, baseTags);
  const body = getParsedBody(response, 'ProductsRecalculationTasks/GetList');
  state.productsRecalculationTasks = Array.isArray(body) ? body : [];
}

function buildScannedProducts(products, employee) {
  const codeMap = employee.productCodesByProductId ?? {};
  const result = [];
  for (const product of products ?? []) {
    const productId = product.ProductId ?? product.productId;
    const codes = codeMap[String(productId)] ?? [];
    if (!codes.length) continue;
    result.push({ productId, stockCell: false, codes });
  }
  return result;
}

function maybeProductsRecalculationFullFlow(baseUrl, employee, state, params, baseTags) {
  if (!isFullMode()) return;
  const task = pickRandomItem(state.productsRecalculationTasks);
  const taskId = task?.Id ?? task?.id;
  const deviceSerialNumber = task?.DeviceSerialNumber ?? task?.deviceSerialNumber ?? state.currentDeviceSerialNumber;
  if (!taskId) return;
  if (chance(profile.recalculationRequestDocumentProbability)) {
    const requestResponse = requestProductsRecalculationDocument(baseUrl, { employeeSessionToken: state.employeeSessionToken, productsRecalculationTaskId: taskId }, getStepParams(params, baseTags, 'recalculation_request_document', '/api/ProductsRecalculationTasks/RequestDocument'));
    recordStepResult('recalculation_request_document', '/api/ProductsRecalculationTasks/RequestDocument', requestResponse, baseTags);
    ensureSuccess(requestResponse, 'ProductsRecalculationTasks/RequestDocument');
    recordRecalculationDocumentRequested(baseTags);
  }
  if (deviceSerialNumber && chance(profile.recalculationGenerateQrProbability)) {
    const qrResponse = generateProductsRecalculationQrCode(baseUrl, { employeeSessionToken: state.employeeSessionToken, deviceSerialNumber: deviceSerialNumber, productsRecalculationTaskId: taskId }, getStepParams(params, baseTags, 'recalculation_generate_qr', '/api/ProductsRecalculationTasks/GenerateQrCode'));
    recordStepResult('recalculation_generate_qr', '/api/ProductsRecalculationTasks/GenerateQrCode', qrResponse, baseTags);
    ensureSuccess(qrResponse, 'ProductsRecalculationTasks/GenerateQrCode');
    recordRecalculationQrGenerated(baseTags);
  }
  if (!chance(profile.recalculationConfirmProbability)) return;
  const getResponse = getProductsRecalculationDocumentData(baseUrl, { employeeSessionToken: state.employeeSessionToken, productsRecalculationTaskId: taskId }, getStepParams(params, baseTags, 'recalculation_get_document', '/api/ProductsRecalculations/GetDocumentData'));
  recordStepResult('recalculation_get_document', '/api/ProductsRecalculations/GetDocumentData', getResponse, baseTags);
  const products = getParsedBody(getResponse, 'ProductsRecalculations/GetDocumentData');
  recordRecalculationDocumentFetched(baseTags);
  const confirmResponse = confirmProductsRecalculation(baseUrl, { employeeSessionToken: state.employeeSessionToken, productsRecalculationTaskId: taskId, products: normalizeConfirmedProducts(products) }, getStepParams(params, baseTags, 'recalculation_confirm', '/api/ProductsRecalculations/Confirm'));
  recordStepResult('recalculation_confirm', '/api/ProductsRecalculations/Confirm', confirmResponse, baseTags);
  ensureSuccess(confirmResponse, 'ProductsRecalculations/Confirm');
  recordRecalculationDocumentConfirmed(baseTags);
  if (deviceSerialNumber && chance(profile.productsScanningProbability)) {
    const scannedProducts = buildScannedProducts(products, employee);
    if (scannedProducts.length > 0) {
      const scanningResponse = confirmProductsScanning(baseUrl, { employeeSessionToken: state.employeeSessionToken, stage: employee.productsScanningStage ?? 4, deviceSerialNumber: deviceSerialNumber, scannedProducts }, getStepParams(params, baseTags, 'products_scanning_confirm', '/api/products-scanning/confirm'));
      recordStepResult('products_scanning_confirm', '/api/products-scanning/confirm', scanningResponse, baseTags, [204]);
      if (scanningResponse.status >= 400) ensureSuccess(scanningResponse, 'products-scanning/confirm');
      recordProductsScanningConfirmed(baseTags);
    }
  }
}

function trueMarkBurst(baseUrl, employee, state, params, baseTags) {
  const min = profile.trueMarkValidateMinPerCycle;
  const max = profile.trueMarkValidateMaxPerCycle;
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const codes = employee.trueMarkCodes ?? [];
  if (codes.length === 0) return;
  for (let i = 0; i < count; i += 1) {
    recordTrueMarkRequest(baseTags);
    const response = validateTrueMark(baseUrl, { employeeSessionToken: state.employeeSessionToken, codes }, getStepParams(params, baseTags, 'true_mark_validate', '/api/true-mark/validate'));
    recordStepResult('true_mark_validate', '/api/true-mark/validate', response, baseTags);
    ensureSuccess(response, 'true-mark/validate');
    think(employee.timeouts?.betweenValidateMinSeconds ?? 0.2, employee.timeouts?.betweenValidateMaxSeconds ?? 0.8);
  }
}

function maybeCloseWorkingDay(baseUrl, state, params, baseTags) {
  if (!state.workingDay || !chance(profile.workingDayCloseProbability)) return;
  const response = closeWorkingDay(baseUrl, { employeeSessionToken: state.employeeSessionToken, workingDay: state.workingDay }, getStepParams(params, baseTags, 'working_day_close', '/api/WorkingDays/Close'));
  recordStepResult('working_day_close', '/api/WorkingDays/Close', response, baseTags);
  ensureSuccess(response, 'WorkingDays/Close');
  state.workingDay = null;
  state.workingDayId = null;
  recordWorkingDayClosed(baseTags);
}

function run() {
  const baseUrl = __ENV.BASE_URL;
  const employee = getEmployee();
  const state = getState();
  const params = createJsonParams(employee.headers);
  const baseTags = createServiceBaseTags(employee);
  const startedAt = Date.now();
  let cycleSucceeded = false;
  recordCycleStarted(baseTags);
  try {
    ensureAuthorized(baseUrl, employee, state, params, baseTags);
    think(employee.timeouts?.afterAuthMinSeconds ?? 1, employee.timeouts?.afterAuthMaxSeconds ?? 2);
    maybeGetServiceSettings(baseUrl, state, params, baseTags);
    refreshWorkingDays(baseUrl, state, params, baseTags);
    openWorkingDayIfNeeded(baseUrl, state, params, baseTags);
    refreshRouteSheets(baseUrl, state, params, baseTags);
    maybeVisitFlow(baseUrl, state, params, baseTags);
    refreshDisplacements(baseUrl, state, params, baseTags);
    maybeGetDeviceContents(baseUrl, state, params, baseTags);
    maybeDisplacementToDeviceFlow(baseUrl, state, params, baseTags);
    refreshProductsRecalculationTasks(baseUrl, state, params, baseTags);
    maybeProductsRecalculationFullFlow(baseUrl, employee, state, params, baseTags);
    trueMarkBurst(baseUrl, employee, state, params, baseTags);
    maybeCloseWorkingDay(baseUrl, state, params, baseTags);
    cycleSucceeded = true;
    recordCycleCompleted(baseTags);
  } catch (error) {
    const stepMap = {
      'EmployeesAuth/Authorize': ['authorize', '/api/EmployeesAuth/Authorize'],
      'service-settings': ['service_settings', '/api/service-settings'],
      'WorkingDays/GetList': ['working_days', '/api/WorkingDays/GetList'],
      'WorkingDays/Open': ['working_day_open', '/api/WorkingDays/Open'],
      'WorkingDays/Close': ['working_day_close', '/api/WorkingDays/Close'],
      'RouteSheets/GetForwarderList': ['route_sheets', '/api/RouteSheets/GetForwarderList'],
      'EmployeesAuth/GetDeviceConfiguration': ['device_configuration', '/api/EmployeesAuth/GetDeviceConfiguration'],
      'Displacements/GetList': ['displacements', '/api/Displacements/GetList'],
      'DisplacementsFromDevice/GetDeviceContents': ['device_contents', '/api/DisplacementsFromDevice/GetDeviceContents'],
      'DisplacementsToDevice/GetDocumentData': ['displacement_to_device_get_document', '/api/DisplacementsToDevice/GetDocumentData'],
      'DisplacementsToDevice/Confirm': ['displacement_to_device_confirm', '/api/DisplacementsToDevice/Confirm'],
      'ProductsRecalculationTasks/GetList': ['recalculation_tasks', '/api/ProductsRecalculationTasks/GetList'],
      'ProductsRecalculationTasks/RequestDocument': ['recalculation_request_document', '/api/ProductsRecalculationTasks/RequestDocument'],
      'ProductsRecalculationTasks/GenerateQrCode': ['recalculation_generate_qr', '/api/ProductsRecalculationTasks/GenerateQrCode'],
      'ProductsRecalculations/GetDocumentData': ['recalculation_get_document', '/api/ProductsRecalculations/GetDocumentData'],
      'ProductsRecalculations/Confirm': ['recalculation_confirm', '/api/ProductsRecalculations/Confirm'],
      'Visits/Start': ['visit_start', '/api/Visits/Start'],
      'Visits/End': ['visit_end', '/api/Visits/End'],
      'true-mark/validate': ['true_mark_validate', '/api/true-mark/validate'],
      'products-scanning/confirm': ['products_scanning_confirm', '/api/products-scanning/confirm'],
    };
    const [step, endpoint] = stepMap[error?.operationName] ?? ['cycle', 'combined'];
    recordStepException(step, endpoint, error, baseTags);
    if ((error?.message ?? '').includes('SessionToken') || (error?.message ?? '').includes('Employee is not found')) {
      state.isAuthorized = false;
      state.employeeSessionToken = null;
      recordTokenError(baseTags, step, endpoint);
    }
  } finally {
    recordCycleOutcome(cycleSucceeded, baseTags);
    recordCycleDuration(Date.now() - startedAt, baseTags);
    recordActiveCycles(0, baseTags);
    sleep(cycleIntervalSeconds());
  }
}

export constFieldScenario = { name: 'field', options: buildOptions(profile), run };
