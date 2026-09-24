# k6 Load Tests

Проект для нагрузочного тестирования платформы управления сетью устройств через k6.

В проекте одна входная точка `main.js`, которая переключает симуляцию по `APP`.

## Что сейчас моделируется
### `APP=kiosk`
- редкая авторизация устройства через `POST /api/DeviceAuth`
- типовая пользовательская сессия устройства

### `APP=robot`
- получение планограммы и регистрация robot-приложения

### `APP=field`
- авторизация сотрудника через `POST /api/EmployeesAuth/Authorize`
- получение настроек приложения через `POST /api/service-settings`
- получение/открытие/закрытие рабочего дня через `POST /api/WorkingDays/*`
- получение маршрутных листов через `POST /api/RouteSheets/GetForwarderList`
- визиты через `POST /api/Visits/Start` и `POST /api/Visits/End`
- получение конфигурации устройства через `POST /api/EmployeesAuth/GetDeviceConfiguration`
- получение списка перемещений через `POST /api/Displacements/GetList`
- получение содержимого устройства через `POST /api/DisplacementsFromDevice/GetDeviceContents`
- получение и подтверждение `DisplacementsToDevice` через `POST /api/DisplacementsToDevice/GetDocumentData` и `POST /api/DisplacementsToDevice/Confirm`
- получение списка задач пересчета через `POST /api/ProductsRecalculationTasks/GetList`
- опционально `RequestDocument` и `GenerateQrCode`
- получение и подтверждение `ProductsRecalculations` через `POST /api/ProductsRecalculations/GetDocumentData` и `POST /api/ProductsRecalculations/Confirm`
- подтверждение сканирования через `POST /api/products-scanning/confirm`
- пачки проверок маркировки через `POST /api/true-mark/validate`

Для `field`:
- `1 VU = 1 сотрудник`
- `FIELD_SCENARIO_MODE=simple|full`
- `simple` использует упрощенный flow
- `full` включает document/scanning ветки

### `APP=office`
- cookie-based авторизация через `POST /api/frontend/account/login`
- поддержание office-сессии через `GET /api/frontend/account/me` и `POST /api/frontend/account/refresh`
- read-only lists через:
  - `GET /api/frontend/customizable-options/global`
  - `POST /api/frontend/devices/get-list`
  - `POST /api/frontend/orders/get-list`
  - `POST /api/frontend/payments/get-list`
  - `POST /api/frontend/api-call-history/get-list`
  - `POST /api/frontend/incidents/get-list`
- легкий admin flow через:
  - `GET /api/frontend/customizable-options`
  - `POST /api/frontend/employees/get-list`
  - `POST /api/frontend/employees/get-routes`
  - `POST /api/frontend/initial-installation`

Для `office`:
- `1 VU = 1 office user`
- `OFFICE_MODE=mixed|keepalive|lists|admin`
- `mixed` запускает три office-сценария параллельно
- `keepalive`, `lists`, `admin` запускают только выбранный сценарий
- office сценарий требует `https://` в `BASE_URL`, потому что auth cookie на сервере выставляются с `Secure=true`

## Структура
- `main.js` — единая точка входа
- `scenarios/` — app-specific сценарии
- `lib/` — общие API/runtime/metrics/state helper'ы
- `config/` — профили нагрузки
- `data/` — тестовые данные
- `grafana/` — готовые dashboards

## Базовый запуск
```bash
k6 run -e BASE_URL=http://localhost:5000 -e APP=field -e FIELD_SCENARIO_MODE=simple main.js
```

```bash
k6 run -e BASE_URL=http://localhost:5000 -e APP=field -e FIELD_SCENARIO_MODE=full main.js
```

```bash
k6 run -e BASE_URL=https://localhost:5001 -e APP=office -e OFFICE_MODE=mixed main.js
```

```bash
k6 run -e BASE_URL=https://localhost:5001 -e APP=office -e OFFICE_MODE=lists main.js
```

## Через `.env`
1. Скопировать `.env.example` в `.env`
2. Заполнить `BASE_URL`, `APP`, `K6_PROMETHEUS_RW_*`
3. Для field/office-сценариев при необходимости задать `FIELD_SCENARIO_MODE` и/или `OFFICE_MODE`
4. Запустить:

```powershell
.\run-k6.ps1
```

## Графана
Готовые dashboards:
- `grafana/kiosk-dashboard.json`
- `grafana/robot-dashboard.json`
- `grafana/field-dashboard.json`
- `grafana/office-dashboard.json`

## Настройка
- Для `field` заполнить `data/field-employees.example.json`
- Проверить `trueMarkCodes`, `productCodesByProductId`, `productsScanningStage`
- При необходимости скорректировать `config/field-load-profile.example.json`
- Для `office` заполнить `data/office-users.example.json`
- Для `office` проверить, что тест идет по `https://`, иначе `Secure` cookie не будут работать как в реальном браузерном flow
