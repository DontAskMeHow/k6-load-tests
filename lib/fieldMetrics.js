import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

const cycleSuccessRate = new Rate('k6_field_cycle_success_rate');
const authorizeSuccessRate = new Rate('k6_field_authorize_success_rate');
const serviceSettingsSuccessRate = new Rate('k6_field_service_settings_success_rate');
const workingDaysSuccessRate = new Rate('k6_field_working_days_success_rate');
const workingDayOpenSuccessRate = new Rate('k6_field_working_day_open_success_rate');
const workingDayCloseSuccessRate = new Rate('k6_field_working_day_close_success_rate');
const routeSheetsSuccessRate = new Rate('k6_field_route_sheets_success_rate');
const deviceConfigurationSuccessRate = new Rate('k6_field_device_configuration_success_rate');
const displacementsSuccessRate = new Rate('k6_field_displacements_success_rate');
const deviceContentsSuccessRate = new Rate('k6_field_device_contents_success_rate');
const displacementToDeviceGetDocumentSuccessRate = new Rate('k6_field_displacement_to_device_get_document_success_rate');
const displacementToDeviceConfirmSuccessRate = new Rate('k6_field_displacement_to_device_confirm_success_rate');
const recalculationTasksSuccessRate = new Rate('k6_field_recalculation_tasks_success_rate');
const recalculationRequestDocumentSuccessRate = new Rate('k6_field_recalculation_request_document_success_rate');
const recalculationGenerateQrSuccessRate = new Rate('k6_field_recalculation_generate_qr_success_rate');
const recalculationGetDocumentSuccessRate = new Rate('k6_field_recalculation_get_document_success_rate');
const recalculationConfirmSuccessRate = new Rate('k6_field_recalculation_confirm_success_rate');
const visitStartSuccessRate = new Rate('k6_field_visit_start_success_rate');
const visitEndSuccessRate = new Rate('k6_field_visit_end_success_rate');
const trueMarkValidateSuccessRate = new Rate('k6_field_true_mark_validate_success_rate');
const productsScanningConfirmSuccessRate = new Rate('k6_field_products_scanning_confirm_success_rate');

const cyclesStarted = new Counter('k6_field_cycles_started');
const cyclesCompleted = new Counter('k6_field_cycles_completed');
const workingDaysOpened = new Counter('k6_field_working_days_opened');
const workingDaysClosed = new Counter('k6_field_working_days_closed');
const visitsStarted = new Counter('k6_field_visits_started');
const visitsEnded = new Counter('k6_field_visits_ended');
const trueMarkRequests = new Counter('k6_field_true_mark_requests');
const displacementToDeviceDocumentsFetched = new Counter('k6_field_displacement_to_device_documents_fetched');
const displacementToDeviceDocumentsConfirmed = new Counter('k6_field_displacement_to_device_documents_confirmed');
const recalculationDocumentsFetched = new Counter('k6_field_recalculation_documents_fetched');
const recalculationDocumentsConfirmed = new Counter('k6_field_recalculation_documents_confirmed');
const recalculationDocumentRequests = new Counter('k6_field_recalculation_document_requests');
const recalculationQrGenerated = new Counter('k6_field_recalculation_qr_generated');
const productsScanningConfirmed = new Counter('k6_field_products_scanning_confirmed');
const deviceErrors = new Counter('k6_field_device_errors');
const businessErrors = new Counter('k6_field_business_errors');
const serverErrors = new Counter('k6_field_server_errors');
const parseErrors = new Counter('k6_field_parse_errors');
const tokenErrors = new Counter('k6_field_token_errors');
const notFoundErrors = new Counter('k6_field_not_found_errors');
const conflictErrors = new Counter('k6_field_conflict_errors');

const fullCycleDuration = new Trend('k6_field_full_cycle_duration', true);
const authorizeDuration = new Trend('k6_field_authorize_duration', true);
const serviceSettingsDuration = new Trend('k6_field_service_settings_duration', true);
const workingDaysDuration = new Trend('k6_field_working_days_duration', true);
const workingDayOpenDuration = new Trend('k6_field_working_day_open_duration', true);
const workingDayCloseDuration = new Trend('k6_field_working_day_close_duration', true);
const routeSheetsDuration = new Trend('k6_field_route_sheets_duration', true);
const deviceConfigurationDuration = new Trend('k6_field_device_configuration_duration', true);
const displacementsDuration = new Trend('k6_field_displacements_duration', true);
const deviceContentsDuration = new Trend('k6_field_device_contents_duration', true);
const displacementToDeviceGetDocumentDuration = new Trend('k6_field_displacement_to_device_get_document_duration', true);
const displacementToDeviceConfirmDuration = new Trend('k6_field_displacement_to_device_confirm_duration', true);
const recalculationTasksDuration = new Trend('k6_field_recalculation_tasks_duration', true);
const recalculationRequestDocumentDuration = new Trend('k6_field_recalculation_request_document_duration', true);
const recalculationGenerateQrDuration = new Trend('k6_field_recalculation_generate_qr_duration', true);
const recalculationGetDocumentDuration = new Trend('k6_field_recalculation_get_document_duration', true);
const recalculationConfirmDuration = new Trend('k6_field_recalculation_confirm_duration', true);
const visitStartDuration = new Trend('k6_field_visit_start_duration', true);
const visitEndDuration = new Trend('k6_field_visit_end_duration', true);
const trueMarkValidateDuration = new Trend('k6_field_true_mark_validate_duration', true);
const productsScanningConfirmDuration = new Trend('k6_field_products_scanning_confirm_duration', true);
const activeCycles = new Gauge('k6_field_active_cycles');

const stepMetrics = {
  authorize: { duration: authorizeDuration, successRate: authorizeSuccessRate },
  service_settings: { duration: serviceSettingsDuration, successRate: serviceSettingsSuccessRate },
  working_days: { duration: workingDaysDuration, successRate: workingDaysSuccessRate },
  working_day_open: { duration: workingDayOpenDuration, successRate: workingDayOpenSuccessRate },
  working_day_close: { duration: workingDayCloseDuration, successRate: workingDayCloseSuccessRate },
  route_sheets: { duration: routeSheetsDuration, successRate: routeSheetsSuccessRate },
  device_configuration: { duration: deviceConfigurationDuration, successRate: deviceConfigurationSuccessRate },
  displacements: { duration: displacementsDuration, successRate: displacementsSuccessRate },
  device_contents: { duration: deviceContentsDuration, successRate: deviceContentsSuccessRate },
  displacement_to_device_get_document: { duration: displacementToDeviceGetDocumentDuration, successRate: displacementToDeviceGetDocumentSuccessRate },
  displacement_to_device_confirm: { duration: displacementToDeviceConfirmDuration, successRate: displacementToDeviceConfirmSuccessRate },
  recalculation_tasks: { duration: recalculationTasksDuration, successRate: recalculationTasksSuccessRate },
  recalculation_request_document: { duration: recalculationRequestDocumentDuration, successRate: recalculationRequestDocumentSuccessRate },
  recalculation_generate_qr: { duration: recalculationGenerateQrDuration, successRate: recalculationGenerateQrSuccessRate },
  recalculation_get_document: { duration: recalculationGetDocumentDuration, successRate: recalculationGetDocumentSuccessRate },
  recalculation_confirm: { duration: recalculationConfirmDuration, successRate: recalculationConfirmSuccessRate },
  visit_start: { duration: visitStartDuration, successRate: visitStartSuccessRate },
  visit_end: { duration: visitEndDuration, successRate: visitEndSuccessRate },
  true_mark_validate: { duration: trueMarkValidateDuration, successRate: trueMarkValidateSuccessRate },
  products_scanning_confirm: { duration: productsScanningConfirmDuration, successRate: productsScanningConfirmSuccessRate },
};

function normalizeStatus(status) { if (status >= 500) return 'server_error'; if (status >= 400) return 'business_error'; if (status >= 300) return 'redirect'; return 'success'; }
function addClassifiedError(status, tags) { if (status >= 500) { serverErrors.add(1, tags); return; } if (status >= 400) { businessErrors.add(1, tags); } if (status === 404) { notFoundErrors.add(1, tags); } if (status === 208 || status === 409) { conflictErrors.add(1, tags); } }
function stepTags(baseTags, step, endpoint, status, extra = {}) { return { ...baseTags, step, endpoint, status, ...extra }; }

export function createServiceBaseTags(employee) { return { app: 'field', scenario: 'field', employee: employee.employeeId, mode: ((__ENV.FIELD_SCENARIO_MODE ?? 'simple').toLowerCase()) }; }
export function createServiceRequestTags(baseTags, step, endpoint) { return stepTags(baseTags, step, endpoint, 'request'); }

export function recordStepResult(step, endpoint, response, baseTags, successStatuses = [200]) {
  const metrics = stepMetrics[step];
  const isSuccess = successStatuses.includes(response.status);
  const tags = stepTags(baseTags, step, endpoint, normalizeStatus(response.status), { http_status: String(response.status) });
  metrics.duration.add(response.timings?.duration ?? 0, tags);
  metrics.successRate.add(isSuccess, tags);
  if (!isSuccess) { addClassifiedError(response.status, tags); }
  return isSuccess;
}

export function recordStepException(step, endpoint, error, baseTags) {
  const metrics = stepMetrics[step];
  const response = error?.response;
  const status = response?.status ?? 0;
  const tags = stepTags(baseTags, step, endpoint, 'exception', { http_status: String(status) });
  if (metrics) { metrics.successRate.add(false, tags); if (response?.timings?.duration != null) { metrics.duration.add(response.timings.duration, tags); } }
  if (error?.isParseError) { parseErrors.add(1, tags); }
  if (status > 0) { addClassifiedError(status, tags); }
  if ((error?.message ?? '').includes('SessionToken') || (error?.message ?? '').includes('Employee is not found')) { tokenErrors.add(1, tags); }
  deviceErrors.add(1, tags);
}

export function recordCycleStarted(baseTags) { cyclesStarted.add(1, baseTags); activeCycles.add(1, baseTags); }
export function recordCycleCompleted(baseTags) { cyclesCompleted.add(1, baseTags); }
export function recordCycleOutcome(success, baseTags) { cycleSuccessRate.add(success, baseTags); }
export function recordCycleDuration(durationMs, baseTags) { fullCycleDuration.add(durationMs, baseTags); }
export function recordWorkingDayOpened(baseTags) { workingDaysOpened.add(1, stepTags(baseTags, 'working_day_open', '/api/WorkingDays/Open', 'completed')); }
export function recordWorkingDayClosed(baseTags) { workingDaysClosed.add(1, stepTags(baseTags, 'working_day_close', '/api/WorkingDays/Close', 'completed')); }
export function recordVisitStarted(baseTags) { visitsStarted.add(1, stepTags(baseTags, 'visit_start', '/api/Visits/Start', 'completed')); }
export function recordVisitEnded(baseTags) { visitsEnded.add(1, stepTags(baseTags, 'visit_end', '/api/Visits/End', 'completed')); }
export function recordTrueMarkRequest(baseTags) { trueMarkRequests.add(1, stepTags(baseTags, 'true_mark_validate', '/api/true-mark/validate', 'request')); }
export function recordDisplacementToDeviceDocumentFetched(baseTags) { displacementToDeviceDocumentsFetched.add(1, stepTags(baseTags, 'displacement_to_device_get_document', '/api/DisplacementsToDevice/GetDocumentData', 'completed')); }
export function recordDisplacementToDeviceDocumentConfirmed(baseTags) { displacementToDeviceDocumentsConfirmed.add(1, stepTags(baseTags, 'displacement_to_device_confirm', '/api/DisplacementsToDevice/Confirm', 'completed')); }
export function recordRecalculationDocumentRequested(baseTags) { recalculationDocumentRequests.add(1, stepTags(baseTags, 'recalculation_request_document', '/api/ProductsRecalculationTasks/RequestDocument', 'completed')); }
export function recordRecalculationQrGenerated(baseTags) { recalculationQrGenerated.add(1, stepTags(baseTags, 'recalculation_generate_qr', '/api/ProductsRecalculationTasks/GenerateQrCode', 'completed')); }
export function recordRecalculationDocumentFetched(baseTags) { recalculationDocumentsFetched.add(1, stepTags(baseTags, 'recalculation_get_document', '/api/ProductsRecalculations/GetDocumentData', 'completed')); }
export function recordRecalculationDocumentConfirmed(baseTags) { recalculationDocumentsConfirmed.add(1, stepTags(baseTags, 'recalculation_confirm', '/api/ProductsRecalculations/Confirm', 'completed')); }
export function recordProductsScanningConfirmed(baseTags) { productsScanningConfirmed.add(1, stepTags(baseTags, 'products_scanning_confirm', '/api/products-scanning/confirm', 'completed')); }
export function recordTokenError(baseTags, step, endpoint) { tokenErrors.add(1, stepTags(baseTags, step, endpoint, 'token_error')); }
export function recordActiveCycles(value, baseTags) { activeCycles.add(value, baseTags); }
