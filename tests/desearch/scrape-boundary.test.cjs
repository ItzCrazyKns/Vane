// Actual adapter -> search -> quality action -> scraper -> pinned HTTP transport.
// Only API, DNS, HTTP, config and LLM I/O are synthetic; no socket is opened.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('/tmp/vane-desearch-tools/node_modules/esbuild');
const { EventEmitter } = require('node:events');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const outfile = path.join(root, '.desearch-boundary-test.cjs');
  const state = {
    addresses: [],
    requests: [],
    dnsCalls: 0,
    status: 200,
    location: '',
    dnsError: false,
  };
  global.__desearchBoundaryFixture = state;
  await esbuild.build({
    stdin: {
      contents: `export {executeSearch} from './src/lib/agents/search/researcher/actions/search/baseSearch'; export {default as Scraper} from './src/lib/scraper';`,
      resolveDir: root,
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    outfile,
    plugins: [
      {
        name: 'synthetic-io',
        setup(build) {
          build.onResolve({ filter: /^\.\/config\/serverRegistry$/ }, () => ({
            path: 'config',
            namespace: 'fixture',
          }));
          build.onResolve({ filter: /^\.\/searxng$/ }, () => ({
            path: 'searxng',
            namespace: 'fixture',
          }));
          build.onResolve(
            { filter: /^node:(dns\/promises|http|https)$/ },
            (args) => ({ path: args.path, namespace: 'fixture' }),
          );
          build.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents:
              args.path === 'config'
                ? `export const getSearchBackend=()=>global.__desearchBoundaryFixture.backend || 'desearch';`
                : args.path === 'searxng'
                  ? `export const searchSearxng=async()=>({results:[{title:'Default fixture',url:'http://default.fixture/',content:'Default'}],suggestions:[]});`
                  : args.path === 'node:dns/promises'
                    ? `export const lookup=async(host,opts)=>{const s=global.__desearchBoundaryFixture;s.dnsCalls++;if(s.dnsError)throw new Error('sensitive DNS details');if(s.dnsCalls>1)return [{address:'127.0.0.1',family:4}];return s.addresses;};`
                    : `import {EventEmitter} from 'node:events'; export const request=(url,options,respond)=>{const s=global.__desearchBoundaryFixture;const req=new EventEmitter();req.destroy=(err)=>req.emit('error',err);req.end=()=>{s.requests.push({url:String(url),options}); if(options.lookup){options.lookup(url.hostname,{},(err,ip,family)=>{if(err)throw err;s.pinned=ip;s.family=family;});options.lookup(url.hostname,{},(err,ip)=>{if(err||ip!==s.pinned)throw new Error('pin changed');});}const res=new EventEmitter();res.statusCode=s.status;res.headers={'content-type':'text/html',location:s.location};res.resume=()=>{};respond(res);queueMicrotask(()=>{res.emit('data',Buffer.from('<html><title>Public control</title><body><article><p>Harmless static public fixture content for extraction.</p><img src="http://127.0.0.1/x"><script>fetch("http://169.254.169.254/")</script></article></body></html>'));res.emit('end');});};return req;};`,
          }));
        },
      },
    ],
  });
  const originalFetch = global.fetch,
    originalKey = process.env.DESEARCH_API_KEY;
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    const { executeSearch, Scraper } = require(outfile);
    let browserCalls = 0;
    Scraper.browser = {
      newContext: async () => {
        browserCalls++;
        return {
          addInitScript: async () => {},
          newPage: async () => ({
            goto: async () => {},
            waitForLoadState: async () => {},
            waitForTimeout: async () => {},
            content: async () =>
              '<html><title>Default</title><body><article>Default</article></body></html>',
            title: async () => 'Default',
          }),
          close: async () => {},
        };
      },
    };
    process.env.DESEARCH_API_KEY = 'synthetic-test-only';
    let apiCalls = 0;
    async function run(
      link,
      addresses = [{ address: '93.184.216.34', family: 4 }],
      status = 200,
      location = '',
      dnsError = false,
    ) {
      Object.assign(state, {
        addresses,
        requests: [],
        dnsCalls: 0,
        status,
        location,
        dnsError,
        pinned: undefined,
        backend: 'desearch',
      });
      global.fetch = async (url) => {
        assert.equal(new URL(url).origin, 'https://api.desearch.ai');
        apiCalls++;
        return new Response(
          JSON.stringify({
            data: [{ title: 'Fixture', link, snippet: 'Snippet' }],
          }),
        );
      };
      let llmCalls = 0;
      return executeSearch({
        queries: ['fixture'],
        mode: 'quality',
        researchBlock: { id: 'test', data: { subSteps: [] } },
        session: { updateBlock() {} },
        llm: {
          generateObject: async () =>
            ++llmCalls === 1
              ? { picked_indices: [0] }
              : { extracted_facts: 'Harmless public fixture' },
        },
        embedding: {},
      });
    }
    const unsafe = [
      'http://127.0.0.1/',
      'http://127.1/',
      'http://2130706433/',
      'http://0x7f000001/',
      'http://0177.0.0.1/',
      'http://169.254.169.254/',
      'http://10.1.2.3/',
      'http://172.16.0.1/',
      'http://192.168.1.1/',
      'http://100.64.0.1/',
      'http://0.0.0.0/',
      'http://224.0.0.1/',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[fc00::1]/',
      'http://[fe80::1]/',
      'http://[2002:7f00:1::]/',
      'http://[2001:db8::1]/',
      'http://localhost/',
      'http://api.localhost/',
      'http://host.internal/',
      'http://host.local/',
      'http://singlelabel/',
    ];
    for (const url of unsafe) {
      assert.deepEqual(await run(url), []);
      assert.equal(state.requests.length, 0, url);
    }
    await assert.rejects(
      run('https://user:synthetic-password@public.example/'),
      { message: 'Invalid Desearch response' },
    );
    assert.equal(state.requests.length, 0);
    for (const addresses of [
      [{ address: '127.0.0.1', family: 4 }],
      [{ address: '10.0.0.2', family: 4 }],
      [{ address: '169.254.0.1', family: 4 }],
      [{ address: '::1', family: 6 }],
      [{ address: '::ffff:192.168.0.1', family: 6 }],
      [],
      [
        { address: '93.184.216.34', family: 4 },
        { address: 'fd00::1', family: 6 },
      ],
    ]) {
      assert.deepEqual(await run('https://internal.service/', addresses), []);
      assert.equal(state.requests.length, 0);
    }
    assert.deepEqual(
      await run('https://public.example/', undefined, 200, '', true),
      [],
    );
    for (const [status, target] of [
      [301, 'http://127.0.0.1/'],
      [302, 'http://169.254.169.254/'],
      [307, 'https://public.example/again'],
    ]) {
      assert.deepEqual(
        await run('https://public.example/', undefined, status, target),
        [],
      );
      assert.equal(state.requests.length, 1);
      assert.equal(state.dnsCalls, 1);
    }
    for (const [url, address, family] of [
      ['https://public.example/', '93.184.216.34', 4],
      ['http://93.184.216.34/', '93.184.216.34', 4],
      ['https://[2606:4700:4700::1111]/', '2606:4700:4700::1111', 6],
    ]) {
      assert.equal((await run(url, [{ address, family }])).length, 1);
      assert.equal(state.requests.length, 1);
      assert.equal(state.requests[0].options.agent, false);
      assert.deepEqual(state.requests[0].options.headers, {
        Accept: 'text/html',
        'Accept-Encoding': 'identity',
      });
      if (new URL(url).hostname === 'public.example') {
        assert.equal(state.dnsCalls, 1);
        assert.equal(state.pinned, address);
      }
    }
    assert.equal(
      browserCalls,
      0,
      'Desearch HTML cannot execute scripts or load browser resources',
    );
    state.requests = [];
    await assert.rejects(Scraper.scrape('http://127.0.0.1/'), {
      message: 'Public page could not be retrieved',
    });
    assert.equal(state.requests.length, 0);
    assert.equal(
      browserCalls,
      0,
      'LLM round-trip cannot drop the selected-backend boundary',
    );
    state.backend = 'searxng';
    let calls = 0;
    const fallback = await executeSearch({
      queries: ['fixture'],
      mode: 'quality',
      researchBlock: { id: 'test', data: { subSteps: [] } },
      session: { updateBlock() {} },
      llm: {
        generateObject: async () =>
          ++calls === 1
            ? { picked_indices: [0] }
            : { extracted_facts: 'Default' },
      },
      embedding: {},
    });
    assert.equal(fallback.length, 1);
    assert.equal(browserCalls, 1);
    clearTimeout(Scraper.idleTimeout);
    assert.ok(!JSON.stringify(logs).includes('sensitive'));
    assert.ok(!JSON.stringify(logs).includes('synthetic-password'));
    console.log = originalLog;
    console.log(
      JSON.stringify({
        actualModules: [
          'desearch',
          'searchBackend',
          'search',
          'executeSearch',
          'Scraper',
          'publicHtml',
        ],
        unsafeLiteralCases: unsafe.length,
        credentialRejected: true,
        privateAndMixedDNSRejected: true,
        redirectCases: 3,
        publicControls: 3,
        pinnedLookupReused: true,
        defaultBrowserPreserved: true,
        realNetworkRequests: 0,
        apiFixtureCalls: apiCalls,
      }),
    );
  } finally {
    global.fetch = originalFetch;
    console.log = originalLog;
    if (originalKey === undefined) delete process.env.DESEARCH_API_KEY;
    else process.env.DESEARCH_API_KEY = originalKey;
    delete global.__desearchBoundaryFixture;
    fs.rmSync(outfile, { force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
