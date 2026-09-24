export function createServiceState() {
  return {
    isAuthorized: false,
    employeeSessionToken: null,
    workingDayId: null,
    workingDay: null,
    routeSheets: [],
    routeSheetEntries: [],
    displacements: [],
    productsRecalculationTasks: [],
    currentRouteEntry: null,
    currentDeviceSerialNumber: null,
  };
}
