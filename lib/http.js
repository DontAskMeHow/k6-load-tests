import http from 'k6/http';
import { check } from 'k6';

export function buildJsonParams(headers = {}) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
}

export function withTags(params = {}, tags = {}) {
  return {
    ...params,
    tags: {
      ...(params.tags ?? {}),
      ...tags,
    },
  };
}

export function parseBody(response) {
  if (!response || typeof response.body !== 'string' || response.body.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(response.body);
    if (typeof parsed === 'string') {
      try {
        return JSON.parse(parsed);
      } catch (_) {
        return parsed;
      }
    }

    return parsed;
  } catch (_) {
    return response.body;
  }
}

export function postJson(url, payload, params = {}) {
  const response = http.post(url, JSON.stringify(payload ?? {}), params);

  check(response, {
    'status is < 500': (r) => r.status < 500,
  });

  return response;
}

export function get(url, params = {}) {
  const response = http.get(url, params);

  check(response, {
    'status is < 500': (r) => r.status < 500,
  });

  return response;
}
