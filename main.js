import { getAppScenario } from './scenarios/index.js';

const appName = __ENV.APP ?? 'kiosk';
const scenario = getAppScenario(appName);

export const options = scenario.options;

export default function () {
  scenario.run();
}
