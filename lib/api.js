import { buildJsonParams, get, parseBody, postJson, withTags } from './http.js';

export function createJsonParams(headers = {}) {
  return buildJsonParams(headers);
}

export function createTaggedParams(params, tags) {
  return withTags(params, tags);
}

export function ensureSuccess(response, operationName) {
  if (response.status < 200 || response.status >= 400) {
    const error = new Error(`${operationName} failed. Status=${response.status}, Body=${response.body}`);
    error.operationName = operationName;
    error.response = response;
    throw error;
  }

  return response;
}

export function getParsedBody(response, operationName) {
  const body = parseBody(response);

  if (!body) {
    const error = new Error(`${operationName} returned empty body. Status=${response.status}, Body=${response.body}`);
    error.operationName = operationName;
    error.response = response;
    error.isParseError = true;
    throw error;
  }

  return body;
}

export function deviceAuth(baseUrl, payload, params) { return postJson(`${baseUrl}/api/DeviceAuth`, payload, params); }
export function createCustomerSession(baseUrl, payload, params) { return postJson(`${baseUrl}/api/CustomerSessions/CreateSession`, payload, params); }
export function getProductList(baseUrl, payload, params) { return postJson(`${baseUrl}/api/ProductList`, { DeviceSessionToken: payload.deviceSessionToken }, params); }
export function getMarkingCodeVerificationResults(baseUrl, payload, params) { return postJson(`${baseUrl}/api/MarkingCodeVerificationResults/GetList`, payload, params); }
export function registerBalancePayment(baseUrl, payload, params) { return postJson(`${baseUrl}/api/Balance/Payment`, payload, params); }
export function registerPurchase(baseUrl, payload, params) { return postJson(`${baseUrl}/api/Purchase`, payload, params); }
export function generateReceiptLink(baseUrl, payload, params) { return postJson(`${baseUrl}/api/KitOnline/GenerateReceiptLink`, payload, params); }
export function timeoutDisconnect(baseUrl, payload, params) { return postJson(`${baseUrl}/api/Auth/TimeOutDisconnect`, payload, params); }
export function getCellsPlanogram(baseUrl, serialNumber, params) { return get(`${baseUrl}/api/cells/get-list/${encodeURIComponent(serialNumber)}`, params); }
export function getCellsPlanogramList(baseUrl, params) { return get(`${baseUrl}/api/cells/v2/get-list`, params); }
export function registerHardware(baseUrl, payload, params) { return postJson(`${baseUrl}/api/initial-installation/hardware/register`, payload, params); }
export function authorizeEmployee(baseUrl, payload, params) { return postJson(`${baseUrl}/api/EmployeesAuth/Authorize`, payload, params); }
export function getServiceSettings(baseUrl, payload, params) { return postJson(`${baseUrl}/api/service-settings`, payload, params); }
export function getWorkingDays(baseUrl, payload, params) { return postJson(`${baseUrl}/api/WorkingDays/GetList`, payload, params); }
export function openWorkingDay(baseUrl, payload, params) { return postJson(`${baseUrl}/api/WorkingDays/Open`, payload, params); }
export function closeWorkingDay(baseUrl, payload, params) { return postJson(`${baseUrl}/api/WorkingDays/Close`, payload, params); }
export function getForwarderRouteSheets(baseUrl, payload, params) { return postJson(`${baseUrl}/api/RouteSheets/GetForwarderList`, payload, params); }
export function getDeviceConfiguration(baseUrl, payload, params) { return postJson(`${baseUrl}/api/EmployeesAuth/GetDeviceConfiguration`, payload, params); }
export function getDisplacements(baseUrl, payload, params) { return postJson(`${baseUrl}/api/Displacements/GetList`, payload, params); }
export function getDeviceContents(baseUrl, payload, params) { return postJson(`${baseUrl}/api/DisplacementsFromDevice/GetDeviceContents`, payload, params); }
export function getDisplacementToDeviceDocumentData(baseUrl, payload, params) { return postJson(`${baseUrl}/api/DisplacementsToDevice/GetDocumentData`, payload, params); }
export function confirmDisplacementToDevice(baseUrl, payload, params) { return postJson(`${baseUrl}/api/DisplacementsToDevice/Confirm`, payload, params); }
export function getProductsRecalculationTasks(baseUrl, payload, params) { return postJson(`${baseUrl}/api/ProductsRecalculationTasks/GetList`, payload, params); }
export function requestProductsRecalculationDocument(baseUrl, payload, params) { return postJson(`${baseUrl}/api/ProductsRecalculationTasks/RequestDocument`, payload, params); }
export function generateProductsRecalculationQrCode(baseUrl, payload, params) { return postJson(`${baseUrl}/api/ProductsRecalculationTasks/GenerateQrCode`, payload, params); }
export function getProductsRecalculationDocumentData(baseUrl, payload, params) { return postJson(`${baseUrl}/api/ProductsRecalculations/GetDocumentData`, payload, params); }
export function confirmProductsRecalculation(baseUrl, payload, params) { return postJson(`${baseUrl}/api/ProductsRecalculations/Confirm`, payload, params); }
export function startVisit(baseUrl, payload, params) { return postJson(`${baseUrl}/api/Visits/Start`, payload, params); }
export function endVisit(baseUrl, payload, params) { return postJson(`${baseUrl}/api/Visits/End`, payload, params); }
export function validateTrueMark(baseUrl, payload, params) { return postJson(`${baseUrl}/api/true-mark/validate`, payload, params); }
export function confirmProductsScanning(baseUrl, payload, params) { return postJson(`${baseUrl}/api/products-scanning/confirm`, payload, params); }
export function frontendLogin(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/account/login`, payload, params); }
export function frontendRefresh(baseUrl, params) { return postJson(`${baseUrl}/api/frontend/account/refresh`, {}, params); }
export function frontendMe(baseUrl, params) { return get(`${baseUrl}/api/frontend/account/me`, params); }
export function frontendLogout(baseUrl, params) { return postJson(`${baseUrl}/api/frontend/account/logout`, {}, params); }
export function frontendGetCustomizableOptions(baseUrl, params) { return get(`${baseUrl}/api/frontend/customizable-options`, params); }
export function frontendGetCustomizableOptionsGlobal(baseUrl, params) { return get(`${baseUrl}/api/frontend/customizable-options/global`, params); }
export function frontendGetDevicesList(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/devices/get-list`, payload, params); }
export function frontendGetOrdersList(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/orders/get-list`, payload, params); }
export function frontendGetPaymentsList(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/payments/get-list`, payload, params); }
export function frontendGetApiCallHistoryList(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/api-call-history/get-list`, payload, params); }
export function frontendGetIncidentsList(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/incidents/get-list`, payload, params); }
export function frontendGetEmployeesList(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/employees/get-list`, payload, params); }
export function frontendGetEmployeesRoutes(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/employees/get-routes`, payload, params); }
export function frontendGetInitialInstallation(baseUrl, payload, params) { return postJson(`${baseUrl}/api/frontend/initial-installation`, payload, params); }

