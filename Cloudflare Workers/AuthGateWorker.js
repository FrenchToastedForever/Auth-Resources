// =============================================================
// AUTH WORKER SCRIPT
// =============================================================
const TARGET_HOST = 'auth.[your main domain]';
const ROOT_TARGET = '[your main domain]';
const ROOT_WORKER = '[cloudflare worker user].workers.dev';
// =============================================================

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const workerHost = url.hostname; // auth.[cloudflare worker user].workers.dev

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
    if (url.pathname.startsWith('/api/')) {
      return response;
    }

    const responseHeaders = new Headers(response.headers);

    // rewrite Set-Cookie domain if present
    if (response.headers.getSetCookie) {
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) {
        responseHeaders.delete('set-cookie');
        for (const cookie of cookies) {
          responseHeaders.append('set-cookie', cookie.replaceAll(ROOT_TARGET, ROOT_WORKER));
        }
      }
    } else if (responseHeaders.has('set-cookie')) {
      const cookie = responseHeaders.get('set-cookie');
      responseHeaders.set('set-cookie', cookie.replaceAll(ROOT_TARGET, ROOT_WORKER));
    }

    // rewrite redirect Location headers
    let location = responseHeaders.get('Location');
    if (location) {
      location = location.replaceAll(ROOT_TARGET, ROOT_WORKER);
      responseHeaders.set('Location', location);
    }

    // rewrite HTML content
    const contentType = responseHeaders.get('content-type') || '';
    if (contentType.includes('text/html')) {
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
