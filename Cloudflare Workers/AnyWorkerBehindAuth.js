const TARGET_HOST = '[service].[domain]';
const ROOT_TARGET = '[domain]';
const ROOT_WORKER = '[cloudflare worker user].workers.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const workerHost = url.hostname;

    url.hostname = TARGET_HOST;

    const newHeaders = new Headers(request.headers);
    newHeaders.set('Host', TARGET_HOST);
    newHeaders.set('X-Forwarded-Host', workerHost);
    newHeaders.set('X-Worker-Proxy', 'true');
    newHeaders.set('X-Forwarded-Proto', 'https');

    const requestInit = {
      method: request.method,
      headers: newHeaders,
      redirect: 'manual'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      requestInit.body = request.body;
    }

    const newRequest = new Request(url.toString(), requestInit);
    const response = await fetch(newRequest);

    const responseHeaders = new Headers(response.headers);

    let location = responseHeaders.get('Location');
    if (location) {
      location = location.replaceAll(ROOT_TARGET, ROOT_WORKER);
      responseHeaders.set('Location', location);
    }

    const contentType = responseHeaders.get('content-type') || '';
    if (contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript')) {
      let bodyText = await response.text();
      bodyText = bodyText.replaceAll(ROOT_TARGET, ROOT_WORKER);
      responseHeaders.delete('content-length');

      return new Response(bodyText, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  }
};
