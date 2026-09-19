'use strict';
/**
 * Netlify Functions adapter. All logic lives in lib/api.js so the hosted
 * deployment and the self-hosted container behave identically.
 *
 * netlify.toml rewrites /api/* to this function, so the incoming path can
 * arrive either as /api/<route> or as /.netlify/functions/api/<route>
 * depending on how the request reached us — strip whichever prefix is there.
 */
const { handleApi } = require('../../lib/api');

const stripPrefix = (path = '') =>
  path
    .replace(/^\/?\.netlify\/functions\/api/, '')
    .replace(/^\/?api/, '')
    .replace(/^\/+/, '');

exports.handler = async (event) => {
  const lowerHeaders = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  const result = handleApi({
    method: event.httpMethod,
    path: stripPrefix(event.path || ''),
    headers: lowerHeaders,
    body: event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body || '',
    query: event.queryStringParameters || {},
  });

  return {
    statusCode: result.status,
    headers: { ...result.headers, 'cache-control': 'no-store' },
    body: result.body,
  };
};
