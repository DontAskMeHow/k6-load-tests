export function createDeviceState() {
  return {
    isAuthorized: false,
    deviceSessionToken: null,
    lastPaymentId: null,
    lastOrderId: null,
  };
}
