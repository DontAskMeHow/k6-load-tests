import {KioskScenario } from './kiosk-main.js';
import {OfficeScenario } from './office-main.js';
import {RobotScenario } from './robot-main.js';
import {FieldScenario } from './field-main.js';

const scenarios = {
  'kiosk':KioskScenario,
  'office':OfficeScenario,
  'robot':RobotScenario,
  'field':FieldScenario,
};

export function getAppScenario(name) {
  const scenario = scenarios[name];

  if (!scenario) {
    const supported = Object.keys(scenarios).join(', ');
    throw new Error(`Unsupported APP="${name}". Supported values: ${supported}`);
  }

  return scenario;
}

