addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/** Copies a typed array's values from the module's memory. */
function getUint8Array(ptr, buffer) {
  return new Uint8Array(getTypedArrayView(ptr, buffer));
}

const SIZE_OFFSET = -4;
const ARRAYBUFFERVIEW_DATASTART_OFFSET = 4;

/** Gets a live view on a typed array's values in the module's memory. */
function getTypedArrayView(ptr, buffer) {
  const alignLog2 = 0;
  const U32 = new Uint32Array(buffer);
  const bufPtr = U32[ptr + ARRAYBUFFERVIEW_DATASTART_OFFSET >>> 2];
  return new Uint8Array(buffer, bufPtr, U32[bufPtr + SIZE_OFFSET >>> 2] >>> alignLog2);
}

function getInstance() {
  const imports = {
    env: {
      abort(_msg, _file, line, column) {
        console.error("abort called at index.ts:" + line + ":" + column);
      }
    }
  };

  return new WebAssembly.Instance(embed, imports).exports;
}

async function handleRequest(request) {
  const instance = getInstance();

  if (!instance) {
    return new Response(null, { status: 503 });
  }

  if (request.url.endsWith("kv/kitten.jpeg")) {
    const fileFromKV = await __STATIC_CONTENT.get("kitten.jpeg", "arrayBuffer");
    if (fileFromKV === null) {
      return new Response("kitten.jpeg did not exist in the KV store", { status: 404 });
    }
    return new Response(fileFromKV, { headers: { 'content-type': 'image/jpg', 'cache-control': 'public, max-age=86400', 'x-from-kv': 'true' } });
  }

  if (request.url.endsWith("kitten.jpeg")) {
    const embeddedBytes = getUint8Array(instance.kitten, instance.memory.buffer);
    return new Response(embeddedBytes, { headers: { 'content-type': 'image/jpg', 'cache-control': 'public, max-age=86400' } });
  }

  if (request.url.endsWith("zip.zip")) {
    const embeddedBytes = getUint8Array(instance.zip, instance.memory.buffer);
    return new Response(embeddedBytes, { headers: { 'content-type': 'application/zip', 'cache-control': 'public, max-age=86400', 'content-disposition': 'attachment; filename="zip.zip"' } });
  }

  if (new URL(request.url).pathname.endsWith("/")) {
    const getStartedPage = `<html><head><title>Worker File Serving Test</title><style>html { font-family: sans-serif; } a, a:visited { color: black; font-weight: bold; }</style></head><body><p>These two files are served from within a WebAssembly instance:</p><ul><li><a href="/kitten.jpeg">kitten.jpeg</a> - ${instance.getKittenSize()} bytes</li><li><a href="/zip.zip">zip.zip</a> - ${instance.getZipSize()} bytes</li></ul><p>Image below from <strong>WebAssembly Instance</strong>:</p><img style="width: 200px; height: 139px;" alt="" src="/kitten.jpeg" /><p>Image below from <strong>KV Store</strong>:</p><img style="width: 200px; height: 139px;" alt="" src="/kv/kitten.jpeg" /></body></html>`;
    return new Response(getStartedPage, {
      headers: { 'content-type': 'text/html' },
    });
  }

  return new Response(null, { status: 404 });
}
