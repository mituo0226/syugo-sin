var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/consult/consult.js
async function runConsult(payload, apiKey) {
  const { text, year, month, day, guardian, category } = payload;
  try {
    const systemPrompt = `\u3042\u306A\u305F\u306F\u9451\u5B9A\u58EB\u300C\u9F8D\u300D\u3002
\u795E\u79D8\u7684\u3067\u5A01\u53B3\u3092\u611F\u3058\u3055\u305B\u308B\u96F0\u56F2\u6C17\u3092\u4FDD\u3061\u306A\u304C\u3089\u3001\u5360\u3044\u5E2B\u3068\u3057\u3066\u306E\u529B\u3092\u8868\u73FE\u3059\u308B\u3002
\u656C\u8A9E\u306F\u4F7F\u308F\u305A\u3001\u8A9E\u308A\u304B\u3051\u308B\u81EA\u7136\u306A\u53E3\u8ABF\u3067\u8A71\u3057\u304B\u3051\u308B\u3002

\u9451\u5B9A\u5185\u5BB9\u306B\u5FC5\u305A\u542B\u3081\u308B\u8981\u7D20\uFF1A
- \u751F\u5E74\u6708\u65E5\u304B\u3089\u5C0E\u304D\u51FA\u3057\u305F\u76F8\u8AC7\u8005\u306E\u6027\u683C\u3092\u5177\u4F53\u7684\u306B\u4F1D\u3048\u308B\uFF08\u5360\u661F\u8853\u3084\u7B97\u547D\u5B66\u3068\u3044\u3046\u8A00\u8449\u306F\u51FA\u3055\u305A\u3001\u7D50\u679C\u3060\u3051\u3092\u8A9E\u308B\uFF09
- \u751F\u5E74\u6708\u65E5\u304B\u3089\u7B97\u547D\u5B66\u306B\u57FA\u3065\u304F\u73FE\u5728\u3068\u5C06\u6765\u306E\u904B\u52E2\u306E\u6D41\u308C\u3092\u7D50\u679C\u3060\u3051\u4F1D\u3048\u308B
- \u5B88\u8B77\u795E\u306B\u52A0\u3048\u3001\u5B88\u8B77\u970A\u306E\u5B58\u5728\u3092\u4F1D\u3048\u308B
  - \u76F8\u8AC7\u8005\u304C\u7537\u6027\u306E\u5834\u5408 \u2192 \u304A\u6BCD\u69D8\u5074\u306E3\u4EE3\u524D\u306E\u3054\u5148\u7956\u69D8\uFF08\u5973\u6027\uFF09
  - \u76F8\u8AC7\u8005\u304C\u5973\u6027\u306E\u5834\u5408 \u2192 \u304A\u7236\u69D8\u5074\u306E3\u4EE3\u524D\u306E\u3054\u5148\u7956\u69D8\uFF08\u5973\u6027\uFF09
- \u52D5\u7269\u970A\u306E\u5B58\u5728\u306B\u3064\u3044\u3066\u3082\u89E6\u308C\u3001\u904E\u53BB\u306B\u7E01\u306E\u3042\u3063\u305F\u52D5\u7269\u304C\u73FE\u5728\u3082\u5B88\u3063\u3066\u3044\u308B\u3053\u3068\u3092\u4F1D\u3048\u308B

\u5FDC\u7B54\u30B9\u30BF\u30A4\u30EB\uFF1A
- \u5192\u982D\u3067\u5FC5\u305A\u76F8\u8AC7\u8005\u306E\u30CB\u30C3\u30AF\u30CD\u30FC\u30E0\u3092\u547C\u3073\u304B\u3051\u308B
- \u6BB5\u843D\u3054\u3068\u306B\u5206\u3051\u3066\u8A9E\u308A\u30011\u6BB5\u843D\u306F2\u301C4\u6587\u7A0B\u5EA6\u306B\u3059\u308B
- \u4E00\u5EA6\u306B\u9577\u3059\u304E\u308B\u9451\u5B9A\u3092\u305B\u305A\u3001\u4F1A\u8A71\u304C\u7D9A\u304F\u3088\u3046\u306B\u9069\u5EA6\u306B\u533A\u5207\u308B
- 2/3\u306E\u78BA\u7387\u3067\u76F8\u8AC7\u8005\u306B\u5177\u4F53\u7684\u306A\u554F\u3044\u304B\u3051\u3092\u542B\u3081\u308B
  \uFF08\u4F8B\uFF1A\u300C\u604B\u4EBA\u3092\u671B\u3080\u306A\u3089\u3001\u5BB9\u59FF\u3092\u91CD\u8996\u3059\u308B\u306E\u304B\u3001\u6027\u683C\u3092\u91CD\u8996\u3059\u308B\u306E\u304B\u3001\u7D4C\u6E08\u529B\u3092\u91CD\u8996\u3059\u308B\u306E\u304B\u300D\uFF09

\u884C\u52D5\u6307\u91DD\uFF1A
- \u554F\u3044\u304B\u3051\u3084\u9451\u5B9A\u306B\u95A2\u9023\u3057\u3066\u3001\u76F8\u8AC7\u8005\u304C\u6BCE\u65E5\u306E\u884C\u3044\u3092\u3069\u3046\u5909\u3048\u308B\u3079\u304D\u304B\u5177\u4F53\u7684\u306B\u30A2\u30C9\u30D0\u30A4\u30B9\u3059\u308B
- \u300C\u305D\u306E\u884C\u52D5\u3092\u3057\u305F\u5F8C\u3067\u3069\u3093\u306A\u5909\u5316\u3092\u611F\u3058\u308B\u304B\u610F\u8B58\u3057\u3066\u307B\u3057\u3044\u300D\u3068\u5FC5\u305A\u4FC3\u3059

\u8FD4\u7B54\u306F\u9069\u5EA6\u306B\u6BB5\u843D\u3092\u5206\u3051\u3001\u6539\u884C\u3092\u5165\u308C\u3066\u8AAD\u307F\u3084\u3059\u304F\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
    const userPrompt = `\u76F8\u8AC7\u5185\u5BB9: ${text}
\u751F\u5E74\u6708\u65E5: ${year}-${month}-${day}
\u5B88\u8B77\u795E\u60C5\u5831: ${guardian}
\u30AB\u30C6\u30B4\u30EA\u30FC: ${category}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 1e3,
        temperature: 0.7
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI API \u30A8\u30E9\u30FC: ${response.status}`);
    }
    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "\u9451\u5B9A\u7D50\u679C\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
    console.log("\u76F8\u8AC7\u5185\u5BB9:", text);
    console.log("\u751F\u5E74\u6708\u65E5:", `${year}-${month}-${day}`);
    console.log("\u5B88\u8B77\u795E\u60C5\u5831:", guardian);
    console.log("\u30AB\u30C6\u30B4\u30EA\u30FC:", category);
    return aiResponse;
  } catch (error) {
    console.error("OpenAI API \u30A8\u30E9\u30FC:", error);
    console.log("\u76F8\u8AC7\u5185\u5BB9:", text);
    console.log("\u751F\u5E74\u6708\u65E5:", `${year}-${month}-${day}`);
    console.log("\u5B88\u8B77\u795E\u60C5\u5831:", guardian);
    console.log("\u30AB\u30C6\u30B4\u30EA\u30FC:", category);
    return "\u9451\u5B9A\u7D50\u679C\u306E\u53D6\u5F97\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F";
  }
}
__name(runConsult, "runConsult");

// cloudflare/worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (url.pathname === "/health") {
      return json({ ok: true, ts: Date.now() }, env, request);
    }
    if (url.pathname === "/api/consult" && request.method === "POST") {
      try {
        const payload = await safeJson(request);
        const { text, year, month, day, guardian, category } = payload;
        if (!text) {
          return json({
            ok: false,
            error: "\u76F8\u8AC7\u5185\u5BB9\u304C\u6307\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093"
          }, env, request, 400);
        }
        const result = await runConsult({
          text,
          year,
          month,
          day,
          guardian,
          category
        }, env.OPENAI_API_KEY);
        const paragraphs = result.split("\n\n");
        return json({ ok: true, paragraphs }, env, request);
      } catch (err) {
        console.error("API Error:", err);
        return json({ ok: false, error: String(err?.message || err) }, env, request, 500);
      }
    }
    return json({ ok: false, error: "Not found" }, env, request, 404);
  }
};
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function json(obj, env, request, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}
__name(json, "json");
async function safeJson(request) {
  if (request.method !== "POST") return {};
  const txt = await request.text();
  try {
    return JSON.parse(txt || "{}");
  } catch {
    return {};
  }
}
__name(safeJson, "safeJson");

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-nMeKAv/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-nMeKAv/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
