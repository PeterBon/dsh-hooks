import { ReactNode } from "react";
//#region ../../node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.2/node_modules/@deepseek-ai/cosmokit/lib/types/types.d.ts
declare function isArrayBufferLike(value: any): value is ArrayBufferLike;
declare function isArrayBufferSource(value: any): value is Binary.Source;
/** Binary source detection and base64/hex conversion helpers. */
declare namespace Binary {
  type Source<T extends ArrayBufferLike = ArrayBufferLike> = T | ArrayBufferView<T>;
  const is: typeof isArrayBufferLike;
  const isSource: typeof isArrayBufferSource;
  function fromSource<T extends ArrayBufferLike>(source: Source<T>): T;
  function toBase64(source: Source): string;
  function fromBase64(source: string): ArrayBuffer | Uint8Array<ArrayBuffer>;
  function toHex(source: Source): string;
  function fromHex(source: string): ArrayBuffer;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.2/node_modules/@deepseek-ai/cosmokit/lib/types/misc.d.ts
/** String/symbol keyed dictionary type. */
type Dict<T = any, K extends string | symbol = string> = { [key in K]: T; };
/** Wrap a value in `Promise`, preserving the resolved type of existing promises. */
type Promisify<T> = Promise<T extends Promise<infer S> ? S : T>;
/** Accept a value or promise unless the value type is already promise-like. */
type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>;
//#endregion
//#region ../../node_modules/.pnpm/@standard-schema+spec@1.1.0/node_modules/@standard-schema/spec/dist/index.d.ts
/** The Standard Typed interface. This is a base type extended by other specs. */
interface StandardTypedV1<Input = unknown, Output = Input> {
  /** The Standard properties. */
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}
declare namespace StandardTypedV1 {
  /** The Standard Typed properties interface. */
  interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }
  /** The Standard Typed types interface. */
  interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }
  /** Infers the input type of a Standard Typed. */
  type InferInput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  /** Infers the output type of a Standard Typed. */
  type InferOutput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}
/** The Standard Schema interface. */
interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    /** Validates unknown input values. */
    readonly validate: (value: unknown, options?: StandardSchemaV1.Options | undefined) => Result<Output> | Promise<Result<Output>>;
  }
  /** The result interface of the validate function. */
  type Result<Output> = SuccessResult<Output> | FailureResult;
  /** The result interface if validation succeeds. */
  interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** A falsy value for `issues` indicates success. */
    readonly issues?: undefined;
  }
  interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  /** The result interface if validation fails. */
  interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }
  /** The issue interface of the failure output. */
  interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  /** The path segment interface of the issue. */
  interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }
  /** The Standard types interface. */
  interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output> {}
  /** Infers the input type of a Standard. */
  type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  /** Infers the output type of a Standard. */
  type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/utils.d.ts
/** Ordered collection of disposable values with O(1) deletion by value. */
declare class DisposableList<T extends WeakKey> {
  private sn;
  private map;
  private weak;
  get length(): number;
  push(value: T): () => boolean;
  delete(value: T): boolean;
  clear(): T[];
  [Symbol.iterator](): MapIterator<T>;
}
/** Shared symbols used to avoid public property-name collisions. */
declare const symbols: {
  shadow: symbol;
  receiver: symbol;
  original: symbol;
  metadata: symbol;
  initHooks: symbol;
  checkProto: symbol;
  effect: typeof Context.effect;
  filter: typeof Context.filter;
  isolate: typeof Context.isolate;
  intercept: typeof Context.intercept;
  init: typeof Service.init;
  check: typeof Service.check;
  config: typeof Service.config;
  invoke: typeof Service.invoke;
  extend: typeof Service.extend;
  tracker: typeof Service.tracker;
  resolveConfig: typeof Service.resolveConfig;
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/registry.d.ts
/**
 * Service dependency declaration accepted by plugins and the `@Inject`
 * decorator.
 *
 * Array form requests services without intercept config. Object form maps each
 * service name to optional intercept config for the plugin context.
 */
type Inject<M = Dict> = (keyof M)[] | { [K in keyof M]?: M[K]; };
/** Context keys that correspond to services with typed intercept config. */
type InjectKey = keyof { [K in keyof Context & string as Context[K] extends {
  [symbols.config]: any;
} ? K : never]: any; };
/**
 * Decorator for declaring service dependencies on classes or class methods.
 *
 * On classes it contributes to the plugin's static `inject` map. On methods it
 * delays the method call until the declared services are available.
 */
/**
 * @param name — the required service name.
 * @param config — optional intercept config applied for that service.
 * @returns the class or method decorator.
 */
declare function Inject<K extends InjectKey>(name: K, config?: Context[K] extends {
  [symbols.config]: infer T;
} ? T : never): (value: any, decorator: ClassDecoratorContext<any> | ClassMethodDecoratorContext<any>) => void;
/** Utilities for normalizing plugin dependency declarations. */
declare namespace Inject {
  /**
   * Convert array/object/class-inherited inject metadata into a plain map.
   *
   * @param inject — the declaration to normalize; `null`/`undefined` add nothing.
   * @param result — the map to fill (service name → intercept config or `null`).
   * @returns `result`.
   */
  function resolve(inject: Inject | null | undefined, result?: Dict): Dict;
}
/** Supported plugin entrypoint shapes. */
type Plugin<T = any> = Plugin.Function<T> | Plugin.Constructor<T> | Plugin.Object<T>;
/** Types associated with plugin entrypoints and runtime records. */
declare namespace Plugin {
  /** Shared metadata understood by the plugin registry and related tooling. */
  interface Base<T = any> {
    /** Display name used for fiber diagnostics and logger names. */
    name?: string;
    /** Standard-schema validator applied to config before the plugin starts. */
    Config?: StandardSchemaV1<any, T>;
    /** Services the plugin requires; it only loads while all are available. */
    inject?: Inject;
    /** Service name(s) the plugin provides (read by `Service` and by loaders). */
    provide?: string | string[];
    /** Service names whose intercept config the plugin declares it consumes. */
    intercept?: Dict<boolean>;
  }
  interface Transform<S, T> {
    /** Marks the transform object as a schema/config transform. */
    schema?: true;
    /** Convert user-facing config to runtime config. */
    Config: (config: S) => T;
  }
  /** Function plugin called with `(ctx, config)`. */
  interface Function<T = any> extends Base<T> {
    (ctx: Context, config: T): any;
  }
  /** Class plugin constructed with `(ctx, config)`. */
  interface Constructor<T = any> extends Base<T> {
    new (ctx: Context, config: T): any;
  }
  /** Object plugin with an `apply(ctx, config)` method. */
  interface Object<T = any> extends Base<T> {
    apply(ctx: Context, config: T): any;
  }
  /** Mutable registry record shared by all fibers of one plugin callback. */
  interface Runtime {
    /** Display name copied from the first registered plugin shape. */
    name?: string;
    /** Every live fiber of this plugin (one per `ctx.plugin()` call). */
    fibers: DisposableList<Fiber>;
    /** The executable entrypoint all fibers share (registry identity key). */
    callback: globalThis.Function;
    /** Standard-schema validator applied to each fiber's config. */
    Config?: StandardSchemaV1;
  }
}
type Spread<T> = undefined extends T ? [config?: T] : [config: T];
type GetPluginParameters<P> = P extends ((ctx: Context, ...args: infer R) => any) ? R : P extends (new (ctx: Context, ...args: infer R) => any) ? R : P extends {
  apply(ctx: Context, ...args: infer R): any;
} ? R : never;
type GetPluginConfig<P> = P extends Plugin.Transform<infer S, any> ? S : GetPluginParameters<P>[0];
declare module './context.ts' {
  interface Context {
    /**
     * Run a callback once the requested services are available.
     *
     * Shorthand for `ctx.plugin({ inject, apply: callback })`: the callback
     * is unloaded and re-run whenever a required service changes.
     *
     * @param deps — required services, as an array or a name → config map.
     * @param callback — plugin body called with `(ctx, config)`.
     * @returns the fiber; awaiting it settles once loading finished.
     */
    inject(deps: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;
    /**
     * Load a plugin in the current context.
     *
     * @param plugin — a function, class, or `{ apply }` object plugin.
     * @param args — the plugin config, validated against its `Config` schema.
     * @returns the fiber; awaiting it settles once loading finished
     * (rejecting on config or startup errors).
     */
    plugin<P extends Plugin>(plugin: P, ...args: Spread<GetPluginConfig<P>>): Fiber & PromiseLike<Fiber>;
  }
}
/**
 * Plugin registry installed as `ctx.registry` and mixed into every context.
 *
 * It normalizes plugin shapes, tracks plugin runtimes, starts fibers, and
 * exposes map-like inspection over active plugin callbacks.
 */
declare class RegistryService {
  ctx: Context;
  private _counter;
  private _internal;
  constructor(ctx: Context);
  /** Allocate the next fiber uid (increments on every read). */
  get counter(): number;
  /** Number of registered plugin runtimes. */
  get size(): number;
  /**
   * Resolve a supported plugin shape to its executable callback.
   *
   * @param plugin — a function, class, or `{ apply }` object plugin.
   * @returns the callback identifying the plugin, or `undefined` if invalid.
   */
  resolve(plugin: Plugin): Function | undefined;
  /**
   * Look up the runtime record for a plugin.
   *
   * @param plugin — any supported plugin shape.
   * @returns the runtime, or `undefined` when the plugin is not registered.
   */
  get(plugin: Plugin): Plugin.Runtime | undefined;
  /**
   * Check whether a plugin has a registered runtime.
   *
   * @param plugin — any supported plugin shape.
   * @returns `true` when at least one fiber of the plugin exists.
   */
  has(plugin: Plugin): boolean;
  /**
   * Dispose every running fiber for a plugin and remove its runtime record.
   *
   * @param plugin — any supported plugin shape.
   * @returns the removed runtime, or `undefined` when none was registered.
   */
  delete(plugin: Plugin): Plugin.Runtime | undefined;
  /** Iterate the registered plugin callbacks. */
  keys(): MapIterator<Function>;
  /** Iterate the registered plugin runtimes. */
  values(): MapIterator<Plugin.Runtime>;
  /** Iterate `[callback, runtime]` pairs. */
  entries(): MapIterator<[Function, Plugin.Runtime]>;
  /**
   * Visit every registered runtime.
   *
   * @param callback — receives each runtime and its identifying callback.
   */
  forEach(callback: (value: Plugin.Runtime, key: Function) => void): void;
  /**
   * Start a callback once the requested dependencies are available.
   *
   * @param inject — required services, as an array or a name → config map.
   * @param callback — plugin body called with `(ctx, config)`.
   * @returns the fiber; awaiting it settles once loading finished.
   */
  inject(inject: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;
  /**
   * Start a plugin in the current context and return its fiber.
   *
   * Creates (or reuses) the plugin's runtime record, then starts a new fiber
   * under the current context. Throws if `plugin` is not a supported shape or
   * if the current fiber is already disposed.
   *
   * @param plugin — a function, class, or `{ apply }` object plugin.
   * @param config — the plugin config, validated against its `Config` schema.
   * @param getOuterStack — captures the caller stack for effect diagnostics.
   * @returns the fiber; awaiting it settles once loading finished.
   */
  plugin(plugin: Plugin, config?: any, getOuterStack?: () => string[]): Fiber & PromiseLike<Fiber>;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/reflect.d.ts
declare module './context.ts' {
  interface Context {
    /**
     * Read a service from the store without the inject requirement.
     *
     * @param name — the service name.
     * @param strict — when `true` (default), only return implementations
     * whose providing fiber is currently active.
     * @returns the service value, or `undefined` when not (yet) provided.
     */
    get<K extends string & keyof this>(name: K, strict?: boolean): undefined | this[K];
    /** Same as above for service names outside the typed `Context` surface. */
    get(name: string, strict?: boolean): any;
    /**
     * Overwrite a provided service's value.
     *
     * Only the fiber that provided the service may set it; setting an
     * unprovided name throws.
     *
     * @param name — the service name.
     * @param value — the new service value.
     */
    set<K extends string & keyof this>(name: K, value: undefined | this[K]): void;
    /** Same as above for service names outside the typed `Context` surface. */
    set(name: string, value: any): void;
    /**
     * Register a service implementation owned by the current fiber.
     *
     * The service becomes visible to dependents in the same isolation scope
     * once the fiber is active; it is unregistered (waking dependents) when
     * the returned disposer runs or the fiber unloads. Throws if the name is
     * already provided in this scope or declared as an accessor.
     *
     * @param name — the service name.
     * @param value — the service value.
     * @returns a disposer that unregisters the service.
     */
    provide<K extends string & keyof this>(name: K, value: undefined | this[K]): () => void;
    /** Same as above for service names outside the typed `Context` surface. */
    provide(name: string, value?: any): () => void;
    /**
     * Define a computed context property backed by get/set hooks.
     *
     * The accessor is removed when the current fiber unloads. Throws if the
     * name is already declared.
     *
     * @param name — the context property name.
     * @param options — the `get` hook and optional `set` hook.
     */
    accessor(name: string, options: Omit<Property.Accessor, 'type'>): void;
    /**
     * Expose selected members of a service directly on `ctx`.
     *
     * Each mixed-in key becomes an accessor that forwards to the service
     * (binding methods to it), so e.g. `ctx.on` forwards to `ctx.events.on`.
     * Mixins are removed when the current fiber unloads.
     *
     * @param name — the context property holding the source service.
     * @param mixins — keys to forward, or a source-key → ctx-key map.
     */
    mixin<K extends string & keyof this>(name: K, mixins: (keyof this & keyof this[K])[] | Dict<string>): void;
    /** Same as above with a source object instead of a context property name. */
    mixin<T extends {}>(source: T, mixins: (keyof this & keyof T)[] | Dict<string>): void;
  }
}
/** Context property definition known by the reflection service. */
type Property = Property.Service | Property.Accessor;
/** Property definition variants understood by `ReflectService`. */
declare namespace Property {
  /** Service property backed by a provided implementation. */
  interface Service {
    /** Discriminator. */
    type: 'service';
  }
  /** Computed context property backed by custom get/set hooks. */
  interface Accessor {
    /** Discriminator. */
    type: 'accessor';
    /** Compute the property value; `error` carries the caller stack for diagnostics. */
    get: (this: Context, receiver: any, error: Error) => any;
    /** Optional setter; return `false` to reject the write. */
    set?: (this: Context, value: any, receiver: any, error: Error) => boolean;
  }
}
/** Concrete service implementation record stored in the root reflect service. */
interface Impl {
  /** The service name. */
  name: string;
  /** The fiber that provided the service (owns its lifetime). */
  fiber: Fiber;
  /** The current service value. */
  value?: any;
  /** Optional availability predicate consulted before dependents may load. */
  check?: () => boolean;
}
/**
 * Reflection and service-resolution layer installed as `ctx.reflect`.
 *
 * This service powers the context proxy, service registration, accessors, and
 * the mixins that expose core service methods directly on `ctx`.
 */
declare class ReflectService {
  ctx: Context;
  /** Proxy traps implementing service resolution for every context object. */
  static handler: ProxyHandler<Context>;
  /** Service implementations, keyed by isolation label. */
  store: Dict<Impl, symbol>;
  /** Declared context properties (services and accessors), by name. */
  props: Dict<Property>;
  constructor(ctx: Context);
  /**
   * Read a service from the store without the inject requirement.
   *
   * @param name — the service name.
   * @param strict — when `true`, only return implementations whose providing
   * fiber is currently active.
   * @returns the service value, or `undefined` when not (yet) provided.
   */
  get(name: string, strict?: boolean): any;
  _getImpl(name: string, strict?: boolean): Impl | undefined;
  /**
   * Overwrite a provided service's value.
   *
   * @param name — the service name.
   * @param value — the new service value.
   * @param error — carrier for the caller stack in diagnostics.
   * @returns `true` on success.
   * @throws when `name` was never provided, or was provided by another fiber.
   */
  set(name: string, value: any, error?: Error): boolean;
  /**
   * Register a service implementation owned by the current fiber.
   *
   * See the `ctx.provide()` overload above for the full contract.
   *
   * @param name — the service name.
   * @param value — the service value.
   * @param check — optional availability predicate for dependents.
   * @returns a disposer that unregisters the service.
   */
  provide(name: string, value?: any, check?: () => boolean): Disposable<Promise<void>>;
  /**
   * Re-evaluate every fiber that requires one of the given services.
   *
   * @param names — the service names that changed.
   * @param filter — restricts notification to matching isolation scopes.
   * @returns the fibers whose dependency state was refreshed.
   */
  notify(names: string[], filter?: (ctx: Context, name: string) => boolean): Fiber[];
  /**
   * Define a computed context property backed by get/set hooks.
   *
   * @param name — the context property name.
   * @param options — the `get` hook and optional `set` hook.
   * @returns a disposer that removes the accessor.
   */
  accessor(name: string, options: Omit<Property.Accessor, 'type'>): Disposable<Promise<void>>;
  /**
   * Expose selected members of a service directly on `ctx`.
   *
   * See the `ctx.mixin()` overload above for the full contract.
   *
   * @param source — a context property name or a source object.
   * @param mixins — keys to forward, or a source-key → ctx-key map.
   * @returns a disposer that removes all created accessors.
   */
  mixin(source: any, mixins: string[] | Dict<string>): Disposable<Promise<void>>;
  /**
   * Attach this context's tracing wrapper to a value.
   *
   * @param value — the value to wrap.
   * @returns the traceable wrapper (or the value itself when not applicable).
   */
  trace<T>(value: T): T;
  /**
   * Wrap a callback so calls trace `this` and arguments to this context.
   *
   * @param callback — the function to wrap.
   * @returns a proxy delegating to `callback` with traced values.
   */
  bind<T extends Function>(callback: T): T;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/fiber.d.ts
declare module './context.ts' {
  interface Context extends Pick<Fiber, 'effect'> {
    /** The fiber (plugin runtime instance) that owns this context. */
    fiber: Fiber;
  }
}
interface AsyncDisposable<T extends Awaitable<void> = Awaitable<void>> extends PromiseLike<() => T> {
  (): T;
}
/**
 * Function returned by an effect to release resources during disposal.
 *
 * Disposers run in reverse registration order when the owning fiber unloads;
 * they may be async, in which case unloading awaits them.
 */
type Disposable<T = any> = () => T;
/**
 * Effect body result accepted by `ctx.effect()` and plugin startup.
 *
 * Either a single disposer, a promise of one, or a (possibly async) iterable
 * yielding several — generator effects register each yielded disposer as it
 * is produced.
 */
type Effect<T = any> = SyncEffect<T> | AsyncEffect<T>;
type SyncEffect<T = any> = Disposable<T> | Iterable<Disposable<T>, void, void>;
type AsyncEffect<T = any> = Promise<Disposable<T>> | AsyncIterable<Disposable<T>, void, void>;
/** Tree node used to expose nested effect labels for diagnostics. */
interface EffectMeta {
  /** Human-readable effect label, e.g. `ctx.on("event")` or `ctx.provide("name")`. */
  label: string;
  /** Metadata of nested effects registered while this effect ran. */
  children: EffectMeta[];
}
/**
 * Lifecycle state for one plugin fiber.
 *
 * `PENDING` — waiting for required services; `LOADING` — the plugin callback
 * is running; `ACTIVE` — loaded and providing; `FAILED` — the callback or its
 * config threw; `UNLOADING` — disposers are running; `DISPOSED` — the fiber
 * was removed and cannot restart.
 */
declare const enum FiberState {
  PENDING = 0,
  LOADING = 1,
  ACTIVE = 2,
  FAILED = 3,
  DISPOSED = 4,
  UNLOADING = 5
}
/**
 * Runtime instance of one plugin application.
 *
 * A fiber tracks dependency state, validated config, lifecycle effects, and
 * cleanup for the plugin context returned by `ctx.plugin()`.
 */
declare class Fiber {
  parent: Context;
  inject: Dict<any>;
  runtime: Plugin.Runtime | null;
  /** Unique id within the registry; 0 for the root fiber, `null` once disposed. */
  uid: number | null;
  /** The context this fiber's plugin runs in (extends the parent context). */
  readonly ctx: Context;
  /** The validated plugin config (updated by `update()`). */
  config: any;
  /** The raw plugin config, re-resolved before each activation. */
  _config: any;
  /** Current lifecycle state; transitions emit `internal/status`. */
  state: FiberState;
  /** Dispose this fiber: unload the plugin, then settle once cleanup finished. */
  readonly dispose: () => Promise<void>;
  /** Snapshot of required service implementations while loaded; `undefined` otherwise. */
  store: Dict<Impl> | undefined;
  /** The in-flight load/unload transition, if one is currently running. */
  inertia: Promise<void> | undefined;
  readonly _hooks: Dict<DisposableList<Function>>;
  readonly _disposables: DisposableList<Disposable<any>>;
  protected context: Context;
  private _error;
  private _runner;
  private _store;
  /**
   * Create a fiber. Plugin authors normally obtain fibers from `ctx.plugin()`
   * rather than constructing them directly.
   *
   * @param parent — the context the plugin was loaded from.
   * @param config — raw config, validated against the runtime's schema.
   * @param inject — resolved dependency map (service name → intercept config).
   * @param runtime — the shared plugin runtime, or `null` for the root fiber.
   * @param getOuterStack — captures the caller stack for effect diagnostics.
   */
  constructor(parent: Context, config: any, inject: Dict<any>, runtime: Plugin.Runtime | null, getOuterStack: () => string[]);
  /** The plugin's display name, inherited from the nearest named ancestor, else `'root'`. */
  get name(): string;
  /**
   * Throw if the fiber has already been disposed.
   *
   * @returns nothing when the fiber is still active.
   * @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
   */
  assertActive(): void;
  private _execute;
  /**
   * Register a cleanup-aware effect on this fiber.
   *
   * `execute` runs immediately; the disposers it produces are collected and
   * run (in reverse order) either when the returned disposer is called or
   * when the fiber unloads, whichever comes first. Calling the disposer twice
   * is a no-op. Throws `CordisError('INACTIVE_EFFECT')` if the fiber is
   * already disposed, and `TypeError` if `execute` returns an invalid shape.
   *
   * @param execute — the effect body; see {@link Effect} for accepted shapes.
   * @param label — effect label shown in `getEffects()` diagnostics.
   * @returns a disposer that tears the effect down and settles once done.
   */
  effect(execute: () => SyncEffect, label?: string): Disposable<Promise<void>>;
  /** Same as above for async effects; the disposer is also awaitable. */
  effect(execute: () => Effect, label?: string): AsyncDisposable<Promise<void>>;
  /**
   * Return metadata for currently registered effects.
   *
   * @returns one {@link EffectMeta} tree per labeled live effect.
   */
  getEffects(): EffectMeta[];
  private _getState;
  private _updateState;
  _checkImpl(name: string): boolean | undefined;
  _refresh(): void;
  private _setEpoch;
  private _resolveConfig;
  private _reload;
  private _unload;
  /**
   * Wait for current lifecycle work and rethrow startup errors.
   *
   * @returns this fiber, once it has settled into a stable state.
   * @throws the config-validation or plugin-startup error, if any.
   */
  await(): Promise<this>;
  /**
   * Dispose and immediately reload this plugin with its current config.
   *
   * @returns a promise resolving once the reload settled.
   * @throws {CordisError} `INACTIVE_EFFECT` when the fiber is already disposed.
   */
  restart(): Promise<void>;
  /**
   * Validate and apply new config, then restart the plugin.
   *
   * Runs the `internal/update` waterfall first, so update hooks (and HMR)
   * can veto or replace the restart.
   *
   * @param config — the new raw config; validated before anything restarts.
   * @param noSave — hint for persistence hooks not to write the change back.
   * @returns the update waterfall result; the default restart returns a promise.
   * @throws when validation, an update listener, or the restarted plugin fails.
   */
  update(config: any, noSave?: boolean): void | Promise<void>;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/events.d.ts
/** Extract the parameter tuple from a function type. */
type Parameters$1<F> = F extends ((...args: infer P) => any) ? P : never;
/** Extract the return type from a function type. */
type ReturnType$1<F> = F extends ((...args: any) => infer R) ? R : never;
/** Extract the explicit `this` type from a function type. */
type ThisType<F> = F extends ((this: infer T, ...args: any) => any) ? T : never;
/**
 * Event dispatch strategy used by the event service.
 *
 * `emit` runs synchronous listeners without awaiting them, `parallel` awaits
 * all listeners together, `serial` awaits them in order until one bails,
 * `bail` stops on the first synchronous bail value, and `waterfall` composes
 * listeners around a final `next` callback.
 */
type DispatchMode = 'emit' | 'parallel' | 'serial' | 'bail' | 'waterfall';
declare module './context.ts' {
  interface Context {
    /**
     * Dispatch an event, running all listeners concurrently.
     *
     * @param name — the event name.
     * @param args — arguments passed to every listener.
     * @returns a promise resolving once every listener has settled.
     */
    parallel<K extends keyof Events>(name: K, ...args: Parameters$1<Events[K]>): Promise<void>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    parallel<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters$1<Events[K]>): Promise<void>;
    /**
     * Dispatch an event synchronously, ignoring listener return values.
     *
     * @param name — the event name.
     * @param args — arguments passed to every listener.
     */
    emit<K extends keyof Events>(name: K, ...args: Parameters$1<Events[K]>): void;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    emit<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters$1<Events[K]>): void;
    /**
     * Dispatch an event, awaiting listeners in order until one bails.
     *
     * @param name — the event name.
     * @param args — arguments passed to each listener.
     * @returns the first bail value (non-null, non-false, non-undefined), if any.
     */
    serial<K extends keyof Events>(name: K, ...args: Parameters$1<Events[K]>): Promisify<ReturnType$1<Events[K]>>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    serial<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters$1<Events[K]>): Promisify<ReturnType$1<Events[K]>>;
    /**
     * Dispatch an event, calling listeners in order until one bails.
     *
     * @param name — the event name.
     * @param args — arguments passed to each listener.
     * @returns the first bail value (non-null, non-false, non-undefined), if any.
     */
    bail<K extends keyof Events>(name: K, ...args: Parameters$1<Events[K]>): ReturnType$1<Events[K]>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    bail<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters$1<Events[K]>): ReturnType$1<Events[K]>;
    /**
     * Dispatch an event whose last argument is a `next` continuation.
     *
     * Each listener wraps the rest of the chain: calling `next()` invokes the
     * next listener (finally the built-in behavior); not calling it vetoes.
     *
     * @param name — the event name.
     * @param args — listener arguments; the final one is the innermost `next`.
     * @returns the outermost listener's return value.
     */
    waterfall<K extends keyof Events>(name: K, ...args: Parameters$1<Events[K]>): ReturnType$1<Events[K]>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    waterfall<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters$1<Events[K]>): ReturnType$1<Events[K]>;
    /**
     * Register an event listener owned by the current fiber.
     *
     * @param name — the event name to listen for.
     * @param listener — called with the dispatch arguments.
     * @param options — listener options; a boolean is shorthand for `prepend`.
     * @returns a disposer removing the listener; `true` if it was still registered.
     */
    on<K extends keyof Events>(name: K, listener: Events[K], options?: boolean | EventOptions): () => boolean;
    /**
     * Same as `on()`, but the listener disposes itself after its first call.
     *
     * @param name — the event name to listen for.
     * @param listener — called at most once with the dispatch arguments.
     * @param options — listener options; a boolean is shorthand for `prepend`.
     * @returns a disposer removing the listener; `true` if it was still registered.
     */
    once<K extends keyof Events>(name: K, listener: Events[K], options?: boolean | EventOptions): () => boolean;
  }
}
/** Options accepted by `ctx.on()` and `ctx.once()`. */
interface EventOptions {
  /** Add the listener before existing listeners for the same event. */
  prepend?: boolean;
  /** Receive the event regardless of context filter checks. */
  global?: boolean;
}
/** Registered listener record stored by the event service. */
interface Hook extends EventOptions {
  ctx: Context;
  callback: (...args: any[]) => any;
}
/**
 * Event bus installed as `ctx.events` and mixed into every context.
 *
 * The service supports concurrent, synchronous, serial, bail, and waterfall
 * dispatch and automatically disposes listeners with their owning fiber.
 */
declare class EventsService {
  private ctx;
  _hooks: Record<keyof any, Hook[]>;
  constructor(ctx: Context);
  /**
   * Resolve listeners for one dispatch and apply context filtering.
   *
   * @param type — the dispatch mode, reported on `internal/dispatch`.
   * @param args — the raw dispatch arguments; consumed up to the event name.
   * @returns the matching listener callbacks, bound to the dispatch `this`.
   */
  dispatch(type: string, args: any[]): ((...args: any[]) => any)[];
  /**
   * Run listeners concurrently and wait for all of them.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns a promise resolving once every listener has settled.
   */
  parallel(...args: any[]): Promise<void>;
  /**
   * Run listeners synchronously without waiting for returned promises.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   */
  emit(...args: any[]): void;
  /**
   * Run listeners in order, awaiting each, until one returns a bail value.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns the first bail value (see {@link isBailed}), if any.
   */
  serial(...args: any[]): Promise<any>;
  /**
   * Run listeners synchronously until one returns a bail value.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns the first bail value (see {@link isBailed}), if any.
   */
  bail(...args: any[]): any;
  /**
   * Compose listeners around the final `next` callback.
   *
   * The last dispatch argument is treated as the innermost `next`. Listeners
   * run outermost-first; a listener that does not call `next()` vetoes the
   * rest of the chain, including the built-in behavior.
   *
   * @param args — optional `this`, the event name, listener arguments, then `next`.
   * @returns the outermost listener's return value.
   */
  waterfall(...args: any[]): any;
  /**
   * Store a listener record as an effect on the current fiber.
   *
   * @param label — effect label shown in fiber diagnostics.
   * @param hooks — the listener list for one event.
   * @param callback — the listener to store.
   * @param options — placement and filtering options.
   * @returns a disposer that unregisters the listener.
   */
  register(label: string, hooks: Hook[], callback: any, options: EventOptions): () => void;
  /**
   * Remove a stored listener record.
   *
   * @param hooks — the listener list for one event.
   * @param callback — the listener to remove.
   * @returns `true` if the listener was found and removed.
   */
  unregister(hooks: Hook[], callback: any): true | undefined;
  /**
   * Register an event listener owned by the current fiber.
   *
   * The listener is removed automatically when the fiber unloads. Throws
   * `CordisError('INACTIVE_EFFECT')` if the fiber is already disposed.
   *
   * @param name — the event name to listen for.
   * @param listener — called with the dispatch arguments.
   * @param options — listener options; a boolean is shorthand for `prepend`.
   * @returns a disposer removing the listener; `true` if it was still registered.
   */
  on(name: string | symbol, listener: (...args: any) => any, options?: boolean | EventOptions): any;
  /**
   * Register an event listener that disposes itself after the first call.
   *
   * @param name — the event name to listen for.
   * @param listener — called at most once with the dispatch arguments.
   * @param options — listener options; a boolean is shorthand for `prepend`.
   * @returns a disposer removing the listener; `true` if it was still registered.
   */
  once(name: string, listener: (...args: any) => any, options?: boolean | EventOptions): any;
}
/**
 * Built-in framework events used by core services and extension points.
 *
 * Plugin and status events track fiber lifecycle, service events observe
 * dependency registration, update/get/set/listener events allow core services
 * to intercept runtime operations, and `internal/dispatch` exposes event-bus
 * diagnostics before public events are delivered.
 */
interface Events {
  /** A plugin fiber was created or its uid was cleared on disposal. */
  'internal/plugin'(fiber: Fiber): void;
  /** A fiber changed lifecycle state; receives the fiber and its previous state. */
  'internal/status'(fiber: Fiber, oldValue: FiberState): void;
  /**
   * Resolve raw plugin config after the fiber's injections become active.
   * @param config - the raw config for this activation.
   * @mode waterfall
   */
  'internal/config'(this: Fiber, config: any, next: () => any): any;
  /** Interception hook for a service binding (no core producer). */
  'internal/service'(this: Context, name: string, value: any): void;
  /** Waterfall: a fiber config update is being applied; skip `next()` to veto. */
  'internal/update'(this: Fiber, config: any, noSave: boolean, next: () => void | Promise<void>): void | Promise<void>;
  /** Waterfall: a service is being read through the context proxy. */
  'internal/get'(ctx: Context, name: string, error: Error, next: () => any): any;
  /** Waterfall: a service is being written through the context proxy. */
  'internal/set'(ctx: Context, name: string, value: any, error: Error, next: () => boolean): boolean;
  /** Bail: a listener is being registered; a non-null result replaces registration. */
  'internal/listener'(this: Context, name: string, listener: any, prepend: boolean): void;
  /** An event is being dispatched to listeners (fired for non-internal events only). */
  'internal/dispatch'(mode: DispatchMode, name: string, args: any[], thisArg: any): void;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/logger.d.ts
declare module './context.ts' {
  interface Intercept {
    logger: LoggerService.Intercept;
  }
}
/** Logger method name and severity category. */
type LoggerType = 'error' | 'info' | 'warn' | 'debug';
/** Callable shape for one logger severity method. */
type LoggerMethod = (format: any, ...param: any[]) => void;
/** Formatter used to resolve a printf-style placeholder. */
type Formatter = (value: any, exporter: Exporter, message: Message$1) => any;
/** Structured log record delivered to exporters. */
interface Message$1 {
  sn: number;
  ts: number;
  name: string;
  type: LoggerType;
  level: number;
  args: any[];
  fiber?: WeakRef<Fiber>;
}
/** Sink that receives structured log messages. */
interface Exporter {
  colors?: number | false;
  maxLength?: number;
  levels?: Record<string, number>;
  formatters?: Record<string, Formatter>;
  export(message: Message$1): void;
}
/** Options used when creating a named logger facade. */
interface LoggerOptions {
  /** The logger name shown with each message. */
  name: string;
  /** Message fields merged into every record from this logger. */
  meta?: Partial<Message$1>;
  /** Default maximum level exported when an exporter has no own threshold. */
  level?: number;
}
/** Logger facade identity, inherited message metadata, and optional minimum level. */
interface Logger extends LoggerOptions {}
/** Logger facade severity methods. */
interface Logger extends Record<LoggerType, LoggerMethod> {}
/** Logger facade for one named subsystem. */
declare class Logger {
  private service;
  static color(exporter: Exporter, code: number, value: any, decoration?: string): string;
  static code(name: string, level?: false | number): number;
  static format(exporter: Exporter, message: Message$1): string;
  constructor(options: LoggerOptions, service: LoggerService);
  private _method;
}
/** Logger service configuration merged from context intercepts. */
declare namespace LoggerService {
  interface Intercept {
    name?: string;
    level?: number;
  }
}
/** Callable `ctx.logger` service shape. */
interface LoggerService extends Record<LoggerType, LoggerMethod> {
  (name?: string): Logger;
}
/**
 * Built-in logging service.
 *
 * Call `ctx.logger()` to create a named logger, or call `ctx.logger.info()`
 * directly to log with the current fiber-derived name.
 */
declare class LoggerService {
  bufferSize: number;
  buffer: Message$1[];
  ctx: Context;
  _snMessage: number;
  _snExporter: number;
  exporters: Map<number, Exporter>;
  constructor(ctx: Context);
  /**
   * Register an exporter and dispose it with the current fiber.
   *
   * @param exporter — the sink that receives structured log messages.
   * @returns a disposer that removes the exporter.
   */
  exporter(exporter: Exporter): Disposable<Promise<void>>;
  private _resolveConfig;
  [symbols.invoke](name?: string): Logger;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/context.d.ts
/**
 * Public shape of a Cordis context.
 *
 * The concrete `Context` class is proxied at runtime, so this interface is
 * augmented by core services and plugins to describe the properties that may
 * be read from `ctx`.
 */
interface Context {
  /** Isolation map: service name → scope label. Lookups for a name resolve within its label. */
  [symbols.isolate]: Dict<symbol>;
  /** Intercept map: service name → config merged into that service's per-plugin config. */
  [symbols.intercept]: Dict;
  /** The root context of the application (every child context shares it). @experimental */
  root: this;
  /** Base URL used to resolve relative plugin/module specifiers, if the runtime sets one. */
  baseUrl?: string;
  /** The event bus. Its methods are also mixed onto `ctx` (`ctx.on`, `ctx.emit`, ...). */
  events: EventsService;
  /** The logging service. Call `ctx.logger(name)` for a named logger. */
  logger: LoggerService;
  /** The reflection layer backing the context proxy (`ctx.get`, `ctx.provide`, ...). */
  reflect: ReflectService;
  /** The plugin registry. Its methods are mixed onto `ctx` (`ctx.plugin`, `ctx.inject`). */
  registry: RegistryService;
}
/**
 * Root and child dependency containers for Cordis plugins.
 *
 * A context is a proxy: normal property reads go through the service resolver,
 * while `extend()`, `isolate()`, and `intercept()` create scoped child
 * contexts without mutating their parent.
 */
declare class Context {
  /** Symbol key under which a disposer exposes its {@link EffectMeta} diagnostics tree. */
  static readonly effect: unique symbol;
  /** Symbol key for a context's listener filter, consulted on every event dispatch. */
  static readonly filter: unique symbol;
  /** Symbol key of the isolation map (see the `Context[symbols.isolate]` property). */
  static readonly isolate: unique symbol;
  /** Symbol key of the intercept map (see the `Context[symbols.intercept]` property). */
  static readonly intercept: unique symbol;
  /**
   * Returns true for Cordis context proxies and context prototypes.
   *
   * Works across realms and across multiple copies of cordis, because the
   * brand is keyed by a global symbol rather than by `instanceof`.
   *
   * @param value — the value to test.
   * @returns `true` if `value` is a Cordis context, narrowing its type.
   */
  static is(value: any): value is Context;
  /** Create the root context and install the built-in services. */
  constructor();
  /**
   * Create a child context with extra metadata on top of the current scope.
   *
   * The child prototypally inherits every property of this context; own
   * properties of `meta` shadow the inherited ones. The parent is not mutated.
   *
   * @param meta — own properties (including symbol keys) to define on the child.
   * @returns a child context inheriting from this one.
   */
  extend(meta?: {}): this;
  /**
   * Create a child context with an independent service scope for `name`.
   *
   * Below the returned context, reads and writes of the service `name`
   * resolve against the new label instead of the parent's, so a different
   * implementation can be provided without affecting the parent scope.
   * Passing the same `label` to two `isolate()` calls joins their scopes.
   *
   * @param name — the service name to isolate.
   * @param label — scope label to join; defaults to a fresh unique symbol.
   * @returns a child context whose `name` service resolves in the new scope.
   */
  isolate(name: string, label?: symbol): this;
  /**
   * Add service-specific intercept config for plugins started below this
   * context.
   *
   * Plugins loaded under the returned context see `config` merged into the
   * service's resolved config (ancestor entries first; see
   * `Service[symbols.resolveConfig]`). The parent context is not affected.
   *
   * @param name — the service name whose config to intercept.
   * @param config — the intercept config to merge for that service.
   * @returns a child context carrying the additional intercept entry.
   */
  intercept<K extends InjectKey>(name: K, config: Context[K] extends {
    [symbols.config]: infer T;
  } ? T : never): this;
  intercept(name: string, config: any): this;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+cordis@4.0.1_@_d53e407b0055a51d18c4da8d739fec0e/node_modules/@deepseek-ai/cordis/lib/types/service.d.ts
/**
 * Base class for services that expose a named API on `ctx`.
 *
 * Subclasses call `super(ctx, name)` from their constructor. The service is
 * registered immediately and is automatically removed with the owning fiber.
 */
declare abstract class Service<out T = never> {
  protected ctx: Context;
  /** Symbol key of an instance method run after construction (class plugins). */
  static readonly init: unique symbol;
  /** Symbol key of the availability predicate passed to `ctx.provide()`. */
  static readonly check: unique symbol;
  /** Symbol key of the phantom intercept-config type parameter. */
  static readonly config: unique symbol;
  /** Symbol key of the call body making a service callable (e.g. `ctx.logger()`). */
  static readonly invoke: unique symbol;
  /** Symbol key of the helper deriving an extended service instance. */
  static readonly extend: unique symbol;
  /** Symbol key of the tracker metadata used for context tracing. */
  static readonly tracker: unique symbol;
  /** Symbol key of the intercept-config resolution helper below. */
  static readonly resolveConfig: unique symbol;
  [symbols.config]: T;
  /** The service name this instance is registered under. */
  name: string;
  /**
   * Register this instance as `name` in the current context.
   *
   * Calls `ctx.reflect.provide(name, this, this[Service.check])`, so the
   * service is unregistered automatically when the owning fiber unloads.
   * Services with a `[Service.invoke]` body return a callable instance.
   *
   * @param ctx — the context to register in (stored as `this.ctx`).
   * @param name — the service name; defaults to the static `provide` field.
   */
  constructor(ctx: Context, name: string);
  protected [symbols.filter](ctx: Context): boolean;
  protected [symbols.extend](props?: any): any;
  /**
   * Merge intercept config from ancestors with optional base and head values.
   *
   * Entries added closer to the root apply first; `base` is prepended and
   * `head` appended. Uses `Config.merge` when the service declares one,
   * otherwise a shallow `Object.assign`.
   *
   * @param base — lowest-precedence config merged before all intercepts.
   * @param head — highest-precedence config merged after all intercepts.
   * @returns the merged config.
   */
  [symbols.resolveConfig](base?: T, head?: T): T;
  static [Symbol.hasInstance](instance: any): boolean;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-typert-pro_ee0216bcd98c4ea06ecb5223639c3e04/node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/types.d.ts
declare const LOOKUP_HOST: unique symbol;
declare const LOOKUP_WIRE: unique symbol;
declare const CONTEXT_WIRE: unique symbol;
/** Type-level association between a Host object and its wire identity. */
interface TypertLookup<Host, Wire> {
  readonly [LOOKUP_HOST]: Host;
  readonly [LOOKUP_WIRE]: Wire;
}
/** Extract the Host object associated with one lookup declaration. */
type TypertLookupHost<Lookup> = Lookup extends TypertLookup<infer Host, infer _Wire> ? Host : never;
/** Extract the wire identity associated with one lookup declaration. */
type TypertLookupWire<Lookup> = Lookup extends TypertLookup<infer _Host, infer Wire> ? Wire : never;
/** Type-level association between a scoped Context kind and its wire identity. */
interface TypertContext<Wire> {
  readonly [CONTEXT_WIRE]: Wire;
}
/** Extract the wire identity associated with one scoped Context declaration. */
type TypertContextWire<ContextType> = ContextType extends TypertContext<infer Wire> ? Wire : never;
/** Merge-extensible Host object lookup declarations. */
interface TypertLookupMap {}
/** Merge-extensible scoped Context declarations. */
interface TypertContextMap {}
/**
 * One Remote call's failure as the carrier reported it. `code` stays open here:
 * the closed RPC code union belongs to the carrier package, which already
 * depends on this one, so naming it would invert that edge.
 */
interface RemoteFailure {
  readonly code: string;
  readonly message: string;
  readonly details: object;
}
/**
 * What every generated Remote method resolves to. The Remote face itself folds
 * carrier failures into the error branch, so no consumer wraps a call to
 * recover one; only assembly faults (arity, an unmounted method, a missing
 * Context binder) still reject.
 * @template T - the Host method's business result.
 */
type RemoteResult<T> = {
  readonly ok: true;
  readonly value: T;
} | {
  readonly ok: false;
  readonly error: RemoteFailure;
};
/** Merge-extensible scoped Remote method signatures generated for consumers. */
interface TypertRemoteScopeMap {}
/** Merge-extensible forwarding selection declared once by the Host assembly. */
interface TypertRemoteEventSelection {}
/** Legal `$on` keys: selected events that exist in the current compilation face. */
type TypertRemoteEvent = Extract<keyof Events, keyof TypertRemoteEventSelection>;
/**
 * Resolve one scoped Remote namespace across every generated Context kind.
 * The calling Cordis Context supplies the concrete identity at runtime.
 * @template Namespace - wire namespace between the Context prefix and method.
 */
type TypertRemoteScopeNamespace<Namespace extends string, ContextKey extends string = string> = { [Endpoint in keyof TypertRemoteScopeMap as Endpoint extends `${ContextKey}:${Namespace}/${infer Method}` ? Method : never]: TypertRemoteScopeMap[Endpoint]; };
type TypertRemoteScopeNamespaceKey<ContextKey extends string, Endpoint = keyof TypertRemoteScopeMap> = Endpoint extends `${ContextKey}:${infer Namespace}/${string}` ? Namespace : never;
/** Generated scoped Remote namespaces available to one Context kind. */
type TypertRemoteScopeApi<ContextKey extends string> = { [Namespace in TypertRemoteScopeNamespaceKey<ContextKey>]: TypertRemoteScopeNamespace<Namespace, ContextKey>; };
/** Merge-extensible direct namespace surface generated for Client Remote services. */
interface TypertRemoteNamespaceMap {}
/** Awaitable disposer returned by Cordis-owned Typert registrations. */
type TypertDisposer = () => Promise<void>;
type StringKeyOf<Value> = Extract<keyof Value, string>;
/** Minimal runtime-schema capability carried by strict generated codecs. */
interface TypertSchema<Output = unknown> {
  /**
   * Parse and validate one boundary value.
   * @param value - untrusted boundary value.
   * @returns the validated value.
   */
  parse(value: unknown): Output;
}
/** Codec attached to one invocation parameter or result. */
type TypertCodec = {
  readonly mode: 'strict';
  readonly typeSymbol: string;
  readonly schema: TypertSchema;
} | {
  readonly mode: 'src-json';
};
/** One ordered business parameter in a Remote invocation. */
interface InvocationParameterDescriptor {
  /** Source-level parameter name. */
  readonly name: string;
  /** Required key in the wire `args` object. */
  readonly wire: string;
  /** Whether the value is JSON or requires a registered Host lookup. */
  readonly source: 'json' | 'lookup';
  /** Lookup key when `source` is `lookup`. */
  readonly lookup?: string;
  /** Boundary codec for the wire representation. */
  readonly codec: TypertCodec;
  /** Missing wire fields decode to `undefined` only for an explicitly declared `T | undefined`. */
  readonly acceptsUndefined?: true;
}
/** Source position retained for diagnostics from generated definitions. */
interface InvocationSourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}
/** Carrier-independent description of one exported method invocation. */
interface InvocationDescriptor {
  /** Globally stable generated identity. */
  readonly id: string;
  /** Cordis service key owning the method. */
  readonly service: string;
  /** Wire namespace, defaulting to the service key. */
  readonly namespace: string;
  /** Public instance method name. */
  readonly method: string;
  /** Service member invoked when the exported method name is an alias. */
  readonly implementation?: string;
  /** Receiver selection mode. */
  readonly invocation: {
    readonly kind: 'direct';
  } | {
    readonly kind: 'context';
    readonly context: string;
    readonly wire: string;
    readonly codec: TypertCodec;
  };
  /** Optional consuming-Context projection for one direct lookup parameter. */
  readonly scope?: {
    /** Context kind whose Client binder supplies the identity. */
    readonly context: string;
    /** Lookup parameter wire field replaced by the Context identity. */
    readonly wire: string;
  };
  /** Ordered business parameters. */
  readonly parameters: readonly InvocationParameterDescriptor[];
  /** Transport cancellation injected after business parameters instead of entering wire args. */
  readonly cancellation?: {
    /** Reserved final Host method parameter. */
    readonly parameter: 'signal';
  };
  /** Codec for the resolved method result. */
  readonly result: TypertCodec;
  /** Source declaration used only for diagnostics. */
  readonly sourceLocation?: InvocationSourceLocation;
}
/** Generated Host contract selected explicitly by a Client assembly. */
interface TypertRemoteContribution {
  /** npm package that owns the Remote methods. */
  readonly package: string;
  /** Consumer-side invocation descriptors generated from that package. */
  readonly descriptors: readonly InvocationDescriptor[];
}
/** Client Remote capability implemented by the Gateway and consumed by Remote assemblies. */
interface TypertClientRemote extends TypertRemoteNamespaceMap {
  /**
   * Mount one generated Host-for-Client contribution in the caller's fiber.
   * @param contribution - explicitly selected Remote package artifact.
   * @returns disposer after namespace services and concrete methods are ready.
   */
  $mount(contribution: TypertRemoteContribution): Promise<TypertDisposer>;
  /**
   * Subscribe to one forwarded Host event; delivery is one-way, in registration
   * order, and isolates a throwing listener from the rest.
   * @template Event - forwarded event name selected by the Host assembly.
   * @param event - forwarded Host event name, unchanged on the wire.
   * @param listener - receives the Host's argument list as declared by Cordis `Events`.
   * @returns disposer owned by the calling fiber.
   */
  $on<Event extends TypertRemoteEvent>(event: Event, listener: Events[Event]): () => void;
  /**
   * Hand one decoded forwarded frame to the subscription table. The carrier
   * owning the Host frame sink calls this; a consumer subscribes with
   * {@link TypertClientRemote.$on} and never calls it.
   *
   * `event` is a plain string because this is the wire boundary: the name is
   * whatever the Host assembly's allowlist selected, and one nobody subscribed
   * to is dropped silently.
   * @param event - forwarded Host event name, exactly as the Host emitted it.
   * @param args - the Host argument list, already JSON-decoded.
   */
  $dispatch(event: string, args: readonly unknown[]): void;
}
/**
 * Resolve one validated wire identity, synchronously or asynchronously.
 * @param id - validated wire identity.
 * @returns the Host object, or `undefined` when unavailable.
 */
type TypertLookupResolver<Host = unknown, Wire = unknown> = (id: Wire) => Host | undefined | Promise<Host | undefined>;
/** Runtime provider for one declared Host object lookup. */
interface TypertLookupProvider<Host = unknown, Wire = unknown> {
  /** Source parameter name recognized by the SRC weak parser. */
  readonly parameter: string;
  /** Wire field replacing the Host object parameter. */
  readonly wire: string;
  /** Canonical Host type symbol used by strict generation. */
  readonly hostTypeSymbol: string;
  /** Canonical wire type symbol used by strict generation. */
  readonly wireTypeSymbol: string;
  /**
   * Resolve a wire identity through the provider's default policy.
   * @param id - validated wire identity.
   * @returns the object, `undefined` when unavailable, or either asynchronously.
   */
  resolve(id: Wire): Host | undefined | Promise<Host | undefined>;
}
/** Stable wire declaration retained after a lookup provider unloads. */
interface TypertLookupDefinition {
  /** Merge-declared lookup key. */
  readonly key: string;
  /** Source parameter name recognized by the SRC weak parser. */
  readonly parameter: string;
  /** Wire field replacing the Host object parameter. */
  readonly wire: string;
  /** Canonical Host type symbol used by strict generation. */
  readonly hostTypeSymbol: string;
  /** Canonical wire type symbol used by strict generation. */
  readonly wireTypeSymbol: string;
}
/** Host resolver for one scoped Remote kind. */
interface TypertHostContextProvider<Wire = unknown> {
  /** Wire field carrying the Context identity. */
  readonly wire: string;
  /** Canonical wire type symbol used by strict generation. */
  readonly wireTypeSymbol: string;
  /**
   * Resolve a wire identity to its live scoped Context.
   * @param id - validated wire identity.
   * @returns the scoped Context, or `undefined` when unavailable.
   */
  resolve(id: Wire): Context | undefined | Promise<Context | undefined>;
}
/** Composition-owned resolver replacing one Host Context provider's default lookup policy. */
type TypertHostContextResolver<Wire = unknown> = (id: Wire) => Context | undefined | Promise<Context | undefined>;
/** Client resolver for the identity carried by the calling scoped Context. */
interface TypertClientContextBinder<Wire = unknown> {
  /**
   * Read the Remote identity represented by a calling Context.
   * @param ctx - Context rebound by the Cordis service tracker.
   * @returns the wire identity, or `undefined` when the Context has the wrong scope.
   */
  identity(ctx: Context): Wire | undefined;
}
/** Notification emitted after a Typert runtime registry changes. */
interface TypertRegistryChange {
  readonly kind: 'local' | 'remote' | 'lookup' | 'host-context' | 'client-context';
  readonly key: string;
}
/** Listener for one Typert runtime registry. */
type TypertRegistryListener = (change: TypertRegistryChange) => void;
/** Current-environment invocation definitions. */
interface TypertLocalRegistry {
  /**
   * Look up one invocation by `<namespace>/<method>`.
   * @param endpoint - canonical endpoint.
   * @returns the live descriptor, or `undefined` when absent.
   */
  get(endpoint: string): InvocationDescriptor | undefined;
  /**
   * Report whether a strict definition has existed during this Typert Service lifetime.
   * @param endpoint - canonical endpoint.
   * @returns `true` after the endpoint has been registered at least once, even if withdrawn.
   */
  hasSeen(endpoint: string): boolean;
  /** @returns a registration-order snapshot of local descriptors. */
  list(): readonly InvocationDescriptor[];
  /**
   * Observe later local-definition changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Consumer-selected Remote contribution registry. */
interface TypertRemoteRegistry {
  /**
   * Register one generated contribution for the calling Cordis fiber.
   * @param contribution - generated Remote descriptors.
   * @returns disposer withdrawing the exact contribution.
   */
  register(contribution: TypertRemoteContribution): TypertDisposer;
  /**
   * Look up one Remote descriptor by endpoint.
   * @param endpoint - canonical endpoint.
   * @returns the descriptor, or `undefined` when unmounted.
   */
  get(endpoint: string): InvocationDescriptor | undefined;
  /** @returns a registration-order snapshot of Remote descriptors. */
  list(): readonly InvocationDescriptor[];
  /**
   * Observe later Remote contribution changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Runtime registry for Host object lookup providers. */
interface TypertLookupRegistry {
  /**
   * Register one provider under its merge-declared key.
   * @param key - lookup key.
   * @param provider - owning package's live resolver.
   * @returns disposer withdrawing the exact provider.
   */
  register<K extends StringKeyOf<TypertLookupMap>>(key: K, provider: TypertLookupProvider<TypertLookupHost<TypertLookupMap[K]>, TypertLookupWire<TypertLookupMap[K]>>): TypertDisposer;
  /**
   * Replace one provider's default resolution policy while this contribution is active.
   * Configuration may precede provider registration; without a live provider, `get()` remains unavailable.
   * @param key - lookup key whose wire declaration remains provider-owned.
   * @param resolver - composition-owned resolver used by every lookup of this key.
   * @returns disposer restoring the provider's default resolver.
   */
  configure<K extends StringKeyOf<TypertLookupMap>>(key: K, resolver: TypertLookupResolver<TypertLookupHost<TypertLookupMap[K]>, TypertLookupWire<TypertLookupMap[K]>>): TypertDisposer;
  /**
   * Look up one provider by runtime key.
   * @param key - descriptor lookup key.
   * @returns the live provider, or `undefined` when absent.
   */
  get(key: string): TypertLookupProvider | undefined;
  /** @returns lookup declarations observed during this Typert Service lifetime. */
  definitions(): readonly TypertLookupDefinition[];
  /** @returns a snapshot of registered provider keys. */
  keys(): readonly string[];
  /**
   * Observe later lookup changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Runtime registry for Host Context resolvers and Client Context binders. */
interface TypertContextRegistry {
  /**
   * Register a Host Context resolver.
   * @param key - merge-declared Context key.
   * @param provider - owning package's Host resolver.
   * @returns disposer withdrawing the exact provider.
   */
  registerHost<K extends StringKeyOf<TypertContextMap>>(key: K, provider: TypertHostContextProvider<TypertContextWire<TypertContextMap[K]>>): TypertDisposer;
  /**
   * Override one Host Context key's identity policy for the calling fiber.
   * Configuration may precede provider registration and restores the provider's default resolver on disposal.
   * @param key - merge-declared Context key.
   * @param resolver - composition-owned resolver used by every Host Context lookup of this key.
   * @returns disposer restoring the provider's default resolver.
   */
  configureHost<K extends StringKeyOf<TypertContextMap>>(key: K, resolver: TypertHostContextResolver<TypertContextWire<TypertContextMap[K]>>): TypertDisposer;
  /**
   * Register a Client Context identity binder.
   * @param key - merge-declared Context key.
   * @param binder - Client scope identity resolver.
   * @returns disposer withdrawing the exact binder.
   */
  registerClient<K extends StringKeyOf<TypertContextMap>>(key: K, binder: TypertClientContextBinder<TypertContextWire<TypertContextMap[K]>>): TypertDisposer;
  /**
   * Look up a Host Context resolver.
   * @param key - descriptor Context key.
   * @returns the provider, or `undefined` when absent.
   */
  getHost(key: string): TypertHostContextProvider | undefined;
  /**
   * Look up a Client Context binder.
   * @param key - descriptor Context key.
   * @returns the binder, or `undefined` when absent.
   */
  getClient(key: string): TypertClientContextBinder | undefined;
  /**
   * Observe later Context provider changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Minimal Typert runtime consumed through dependency inversion. */
interface TypertRegistryContract {
  readonly local: TypertLocalRegistry;
  readonly remotes: TypertRemoteRegistry;
  readonly lookups: TypertLookupRegistry;
  readonly contexts: TypertContextRegistry;
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    typert: TypertRegistryContract;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-brand@0.1._757bf6a984ac37281430ad822ab10469/node_modules/@deepseek-ai/dsh-brand/lib/types/index.d.ts
/**
 * The `Branded<B>` nominal-typing primitive — a type-only utility (no runtime
 * code, no harness-package dependency) shared by every package that owns a
 * cross-boundary id.
 *
 * A brand makes structurally-identical strings non-interchangeable at the type
 * level: a `SessionId` cannot be passed where a `CallId` is expected, even
 * though both are plain strings at runtime. Construction goes through a per-id
 * factory in the OWNING package (a plain cast inside — zero runtime cost);
 * comparison, logging, and serialization all behave as ordinary strings.
 *
 * Policy: a package brands the ids it owns — `CallId` in dsh-llm (tool-call
 * correlation), the shared agent/session `SessionId` in dsh-session, and
 * `JobId` in dsh-jobs. Branding is for ids that cross package boundaries and
 * could plausibly be confused; not every string needs a brand.
 * This package owns ONLY the primitive — no concrete id, no runtime code beyond
 * the (erased) type — so the brand vocabulary stays dependency-free and a
 * package can brand its ids without depending on an unrelated capability
 * package.
 *
 * @module @deepseek-ai/dsh-brand
 */
declare const BRAND: unique symbol;
/** A string carrying a compile-time-only brand `B`. */
type Branded<B extends string> = string & {
  readonly [BRAND]: B;
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-plugi_a33844441aba7e573dfa46a8ea41019c/node_modules/@deepseek-ai/dsh-host-plugin-inventory/lib/types/types.d.ts
/** Stable Loader-tree identity of one configured plugin entry. */
type PluginEntryId = Branded<'PluginEntryId'>;
/** Lifecycle state of an entry's root Fiber, or null when it has no live root Fiber. */
type PluginFiberPhase = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null;
/** One non-group Loader entry exposed to trusted clients. */
interface PluginInventoryEntry {
  readonly entryId: PluginEntryId;
  /** Exact module specifier imported by the Loader entry. */
  readonly moduleName: string;
  /** Effective Loader enablement, including disabled ancestor groups. */
  readonly enabled: boolean;
  readonly fiberPhase: PluginFiberPhase;
}
/** Point-in-time inventory returned by the plugin inventory Remote. */
interface PluginInventorySnapshot {
  readonly entries: readonly PluginInventoryEntry[];
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-commands@0_f18bd7aa4aa916b517165061977dda49/node_modules/@deepseek-ai/dsh-commands/lib/types/brand.d.ts
/**
 * Pairs one command execution's `command/run`/`command/done` lifecycle
 * records with each other and with the `command.execute` admission response.
 * Minted by the executor, monotonic per service instance.
 */
type CommandId = Branded<'CommandId'>;
/**
 * Brand a string as a {@link CommandId}.
 * @param id - the executor-minted pairing id.
 * @returns the same string, branded; no validation is performed.
 */
declare function CommandId(id: string): CommandId;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-commands@0_f18bd7aa4aa916b517165061977dda49/node_modules/@deepseek-ai/dsh-commands/lib/types/types.d.ts
/** Immutable metadata for a command's optional unstructured input. */
interface CommandInputDescriptor {
  /** Placeholder shown before the user supplies free-form input. */
  readonly hint: string;
}
/** Expected command outcome rendered directly by the dispatching UI. */
type CommandResult = {
  readonly kind: 'success';
  readonly text?: string;
  /** Earlier authoritative domain event that owns a richer presentation. */
  readonly sourceEventSeq?: number;
} | {
  readonly kind: 'error';
  readonly text: string;
};
/**
 * One settled command execution: the handler's normalized result plus the
 * lifecycle pairing id minted for its `command/run`/`command/done` records,
 * so a dispatching surface can correlate the Remote acknowledgment with the
 * flow node those events produce.
 */
interface CommandExecution {
  /** Pairing id carried by this execution's lifecycle events. */
  readonly commandId: CommandId;
  /** The handler's normalized outcome. */
  readonly result: CommandResult;
}
/** Handler-free immutable command view returned to UI adapters. */
interface CommandDescriptor {
  /** Lowercase command name without the leading slash. */
  readonly name: string;
  /** Human-readable summary used in discovery UI. */
  readonly description: string;
  /** Optional free-form input hint advertised to capable clients. */
  readonly input?: CommandInputDescriptor;
}
/**
 * Producer record for one command invocation (the `command/run` event's
 * source slot). Merge-extensible sum type mirroring `MessageSourceMap`'s
 * shape; minimal today because every executor caller is a human-facing UI
 * surface dispatching a human-typed line, so the sole variant is `user`.
 */
interface CommandSourceMap {
  user: {
    kind: 'user';
  };
}
/** The union over {@link CommandSourceMap} — who issued a command line. */
type CommandSource = CommandSourceMap[keyof CommandSourceMap];
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * A command was registered or unregistered. This is an unfiltered registry
     * notification because a global or scoped change may affect any UI view.
     * Observer failures are contained and cannot veto the registry mutation.
     * @mode emit
     */
    'commands/change'(): void;
  }
}
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * A resolved slash command entered its handler. Log-only (never model
     * surface); paired with `command/done` by `commandId`, mirroring the
     * `tool/call`↔`tool/result` pairing. The payload is structured — `name`
     * and `args` are `parseCommand`'s own split (name and verbatim rawInput,
     * separator whitespace included), so a consumer (a projection unit
     * folding its own command records, a rich command card) never re-parses
     * a line. `args` is absent when the definition sets `recordInput: false`
     * because an authoritative domain event owns the input payload.
     */
    'command/run': {
      commandId: CommandId;
      name: string;
      args?: string;
      source: CommandSource;
    };
    /**
     * The paired command settled. `kind`/`text` carry the handler's verbatim
     * outcome (a thrown/aborted handler settles as `kind: 'error'` with the
     * rendered failure). A successful command may identify the earlier
     * authoritative domain event for a richer client-computed presentation.
     */
    'command/done': {
      commandId: CommandId;
      kind: 'success' | 'error';
      text?: string;
      sourceEventSeq?: number;
    };
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-attachment_5463d1d16dfeb8cbf43fe361fb2eba74/node_modules/@deepseek-ai/dsh-attachment/lib/types/brand.d.ts
/** Opaque content-addressed identifier for one immutable attachment object. */
type AttachmentId = Branded<'AttachmentId'>;
/**
 * Brand a validated storage identifier.
 * @param value - backend-produced opaque identifier.
 * @returns the branded identifier.
 */
declare function AttachmentId(value: string): AttachmentId;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-attachment_5463d1d16dfeb8cbf43fe361fb2eba74/node_modules/@deepseek-ai/dsh-attachment/lib/types/types.d.ts
/** Raster image formats accepted by the version-one attachment path. */
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
/** Durable, serializable metadata for one immutable image object. */
interface ImageAttachmentRef {
  /** Opaque storage identifier; never a filesystem path or bearer URL. */
  attachmentId: AttachmentId;
  /** Media type verified from the stored bytes. */
  mediaType: ImageMediaType;
  /** Exact encoded byte length. */
  bytes: number;
  /** Intrinsic encoded width in pixels. */
  width: number;
  /** Intrinsic encoded height in pixels. */
  height: number;
  /** Optional display name stripped of local path information. */
  name?: string;
}
/** Deployment-resolved limits used by upload admission and request buffering. */
interface ImageAttachmentLimits {
  maxImageBytes: number;
  maxImagesPerMessage: number;
  maxMessageImageBytes: number;
  maxImagePixels: number;
  mediaTypes: readonly ImageMediaType[];
}
/** Request to validate and durably commit one image. */
interface SaveImageAttachment {
  data: Uint8Array;
  /** Caller-declared media type, checked against fully decoded bytes. */
  mediaType: ImageMediaType;
  /** Optional browser/provider display name; it is never interpreted as a path. */
  name?: string;
}
/** Stored image bytes returned after reference and digest verification. */
interface StoredImageAttachment {
  ref: ImageAttachmentRef;
  data: Uint8Array;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-attachment_5463d1d16dfeb8cbf43fe361fb2eba74/node_modules/@deepseek-ai/dsh-attachment/lib/types/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    attachments: AttachmentStore;
  }
}
/** Immutable binary attachment service. Implementations validate bytes before publishing a reference. */
declare abstract class AttachmentStore extends Service {
  constructor(ctx: Context);
  /** Deployment-resolved image policy used by authoritative and fast-path validation. */
  abstract readonly imageLimits: ImageAttachmentLimits;
  /**
   * Validate one image without persisting it.
   * Batch callers validate every member before saving any member.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns completion after the encoded raster has been fully decoded.
   */
  abstract validateImage(input: SaveImageAttachment): Promise<void>;
  /**
   * Validate and durably commit one image before its owning session event is appended.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns a durable content-addressed reference.
   */
  abstract saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef>;
  /**
   * Read one image and verify that bytes still match the recorded reference.
   * @param ref - durable reference from the session log.
   * @param signal - optional cancellation for backend read and verification work.
   * @returns the verified bytes and canonical reference.
   * @throws the signal reason when aborted, or a storage error when verification fails.
   */
  abstract readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm@0.1.0-_4ed4e5c71eb965b0bd6912871e829940/node_modules/@deepseek-ai/dsh-llm/lib/types/brand.d.ts
/** Stable identity carried by one message across inbox, log, and model-request boundaries. */
type MessageId = Branded<'MessageId'>;
/**
 * Brand a message identifier.
 * @param id - the opaque message identifier.
 * @returns the same string, branded; no validation is performed.
 */
declare function MessageId(id: string): MessageId;
/**
 * Correlates a model-issued tool call with its result. Provider-issued for
 * real adapters; synthesized by mocks/assembler fallbacks.
 */
type CallId = Branded<'CallId'>;
/**
 * Brand a string as a {@link CallId}.
 * @param id - the provider-issued (or synthesized) call id.
 * @returns the same string, branded; no validation is performed.
 */
declare function CallId(id: string): CallId;
/** Provider-issued request identifier retained for diagnostics across package boundaries. */
type ProviderRequestId = Branded<'ProviderRequestId'>;
/**
 * Brand a provider-issued request identifier.
 * @param id - the opaque provider-issued string.
 * @returns the same string, branded; no validation is performed.
 */
declare function ProviderRequestId(id: string): ProviderRequestId;
/** Adapter-owned identifier for one model's selectable reasoning effort. */
type ReasoningEffortId = Branded<'ReasoningEffortId'>;
/**
 * Brand an adapter-owned reasoning-effort identifier.
 * @param id - the opaque identifier exposed by one model capability.
 * @returns the same string, branded; no validation is performed.
 */
declare function ReasoningEffortId(id: string): ReasoningEffortId;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm@0.1.0-_4ed4e5c71eb965b0bd6912871e829940/node_modules/@deepseek-ai/dsh-llm/lib/types/message.d.ts
/** Provider/model identity and adapter-private replay data for an assistant message. */
interface AssistantProvenance {
  /** Provider route that produced the message. */
  provider: string;
  /** Provider model id that produced the message. */
  model: string;
  /**
   * Lossless-JSON adapter state needed to replay the provider response.
   * `LlmRuntime` exposes it to a target adapter only when that adapter instance
   * currently owns both this historical provider and the target provider.
   */
  replayState?: unknown;
}
/** Required source of an assistant message produced by a routed model. */
interface ModelMessageSource extends AssistantProvenance {
  kind: 'model';
}
/** Required source of a user-role message carrying one tool result. */
interface ToolMessageSource {
  kind: 'tool';
  callId: CallId;
}
/** One named contribution to a `snapshot`-form context, in assembly order. */
interface ContextSnapshotSection {
  /** The contributing subsystem's name. */
  readonly name: string;
  /** That contribution's model-facing text, exactly as assembled. */
  readonly text: string;
}
/**
 * Producer-declared {@link ContextForm} and the fields that form requires,
 * mixed into the source types that carry one.
 *
 * Discriminated by `form` so a producer cannot select a form without the
 * fields needed to present it: a `notice` must record its one-line
 * account, a `snapshot` its sections. Omitting `form` stays valid — an
 * undeclared context is the documented default.
 */
type ContextFormed = {
  readonly form?: never;
} | {
  readonly form: 'instructions';
} | {
  readonly form: 'catalog';
} | {
  readonly form: 'snapshot';
  /** The named contributions this snapshot assembled, in order. */
  readonly sections: readonly ContextSnapshotSection[];
} | {
  readonly form: 'notice';
  /** One-line account of what happened, shown without expanding the row. */
  readonly summary: string;
} | {
  readonly form: 'relay';
} | {
  readonly form: 'recall';
};
/**
 * Where a message (or injected content) came from.
 * Merge-extensible sum type — plugins add their own `kind`s.
 */
interface MessageSourceMap {
  user: {
    kind: 'user';
  };
  plugin: {
    kind: 'plugin';
    plugin: string;
  } & ContextFormed;
  model: ModelMessageSource;
  tool: ToolMessageSource;
}
/** Any known message source, derived from {@link MessageSourceMap}; switch on `kind` and fall through unknowns (merge-extensible). */
type MessageSource = MessageSourceMap[keyof MessageSourceMap];
/** One immutable message representation shared by delivery, durable history, and model requests. */
interface Message {
  /** Stable identity preserved across every representation boundary. */
  readonly id: MessageId;
  /** Provider-neutral conversation role. */
  readonly role: 'system' | 'user' | 'assistant';
  /** Exact model-facing blocks. */
  readonly content: ContentBlock[];
  /** Required source fields supplied by the producer. */
  readonly source: MessageSource;
}
/** A user-role specialization of the one shared message representation. */
interface UserMessage extends Message {
  readonly role: 'user';
}
/** A model-produced assistant specialization of the shared message representation. */
interface AssistantMessage extends Message {
  readonly role: 'assistant';
  readonly source: ModelMessageSource;
}
/** A tool-result specialization whose model-facing block retains call correlation. */
interface ToolResultMessage extends Message {
  readonly role: 'user';
  readonly content: [ToolResultBlock];
  readonly source: ToolMessageSource;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm@0.1.0-_4ed4e5c71eb965b0bd6912871e829940/node_modules/@deepseek-ai/dsh-llm/lib/types/types.d.ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * The provider topology changed: an adapter registered or unregistered
     * routes, or the configurable-provider directory gained or lost entries.
     * This payload-free registry notification fires at each commit point
     * (including registration disposal); consumers re-read `listProviders()`,
     * `listModels()`, or `listConfigurableProviders()` for the new state.
     * Observer failures are contained and cannot veto the registry mutation.
     * @mode emit
     */
    'llm/adapters-updated'(): void;
  }
}
/** Serializable provider or transport failure facts; policy decides whether they are retryable. */
interface LlmFailure {
  /** Human-readable provider or transport failure. */
  readonly message: string;
  /** Stable provider-neutral machine-routing code. */
  readonly code: string;
  /** HTTP status returned by the provider, when available. */
  readonly status?: number;
  /** Provider-requested delay in milliseconds, when valid and available. */
  readonly providerRetryAfterMs?: number;
  /** Opaque provider-issued request identifier for diagnostics. */
  readonly requestId?: ProviderRequestId;
}
/** Plain text visible to the end user. */
interface TextBlock {
  type: 'text';
  text: string;
}
/** Reasoning / thinking content, distinct from visible text. */
interface ReasoningBlock {
  type: 'reasoning';
  text: string;
}
/**
 * A durable raster image reference, valid in user or assistant content. The
 * block is deliberately role-neutral; assistant-side rendering is forward
 * compatibility — the current production adapters declare text-only output,
 * so only user content carries images today.
 */
interface ImageBlock {
  type: 'image';
  /** Immutable bytes and intrinsic display metadata owned by the attachment service. */
  attachment: ImageAttachmentRef;
}
/** A tool invocation requested by the model. */
interface ToolCallBlock$1 {
  type: 'tool-call';
  /** Provider-issued call id; correlates with the matching tool result. */
  id: CallId;
  name: string;
  /** Raw JSON string as produced by the model. */
  arguments: string;
}
/** The result of a tool invocation, sent back to the model. */
interface ToolResultBlock {
  type: 'tool-result';
  toolCallId: CallId;
  content: ContentBlock[];
  isError?: boolean;
}
/**
 * Merge-extensible content blocks keyed by `type`. New core blocks must land
 * with adapter, UI, and compaction support.
 */
interface ContentBlockMap {
  'text': TextBlock;
  'reasoning': ReasoningBlock;
  'image': ImageBlock;
  'tool-call': ToolCallBlock$1;
  'tool-result': ToolResultBlock;
}
/** The block `type` tag vocabulary; widens as plugins add entries to {@link ContentBlockMap}. */
type ContentBlockType = keyof ContentBlockMap;
/** Any known content block, derived from {@link ContentBlockMap}; switch on `type` and fall through unknowns (merge-extensible). */
type ContentBlock = ContentBlockMap[ContentBlockType];
/**
 * Why a model response stopped.
 * Merge-extensible so adapters can surface provider-specific reasons.
 */
interface FinishReasonMap {
  'stop': {
    kind: 'stop';
  };
  'tool-calls': {
    kind: 'tool-calls';
  };
  'max-tokens': {
    kind: 'max-tokens';
  };
  'aborted': {
    kind: 'aborted';
    failure: LlmFailure;
  };
  'error': {
    kind: 'error';
    failure: LlmFailure;
  };
}
/** Any known finish reason, derived from {@link FinishReasonMap}; switch on `kind` and fall through unknowns (merge-extensible). */
type FinishReason = FinishReasonMap[keyof FinishReasonMap];
/**
 * Token accounting for one model call (cache fields are optional).
 *
 * Counts are DISJOINT: `inputTokens` is uncached input only; cached input is
 * reported separately as `cacheReadTokens`/`cacheWriteTokens` (billed input =
 * sum of the three). Adapters whose providers fold cache hits into a total
 * prompt count (DeepSeek's `prompt_tokens`) subtract them out.
 */
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}
/** Display metadata for one registered provider route. */
interface LlmProviderInfo {
  /** Provider route key used by {@link GenerateOptions.provider}. */
  id: string;
  /** Human-readable provider name for selectors and diagnostics. */
  name: string;
}
/** Merge-extensible provider model modality vocabulary. */
interface ModelModalityMap {
  text: 'text';
  image: 'image';
}
/** Any declared provider model modality. */
type ModelModality = ModelModalityMap[keyof ModelModalityMap];
/**
 * One provider route an adapter plugin can activate through configuration,
 * whether or not the route is currently registered. Configuration surfaces
 * merge this directory with `listProviders()` to offer every configurable
 * provider alongside its live/dormant state.
 */
interface LlmConfigurableProvider {
  /** Provider route key this entry activates when configured. */
  provider: string;
  /** Human-readable provider name for configuration surfaces. */
  displayName: string;
  /** User-settings namespace whose section configures this provider. */
  settingsNs: string;
  /**
   * Path from that namespace's section root to this provider's profile
   * object; empty when the whole section is the profile.
   */
  settingsPath: readonly string[];
  /**
   * Whether the owning adapter knows this route only because configuration
   * declared it — a gateway or self-hosted server it ships nothing about.
   * Absent means the adapter draws no such distinction; false means it does
   * and this route is one of its own. Only the adapter can answer: a stored
   * profile is how a user-added route AND a corrected shipped one both look
   * from outside.
   */
  declared?: boolean;
}
/**
 * One interrogation of a provider endpoint that configuration has not stored
 * yet. Configuration surfaces send the draft a user is still editing, so the
 * request carries the endpoint and credential directly instead of naming a
 * route: a provider being added has no route to name.
 */
interface LlmModelDiscoveryRequest {
  /**
   * Route the draft is editing, when it edits an existing one. A route whose
   * adapter already knows its models answers from that knowledge instead of
   * asking the endpoint — the adapter's own registry is the better answer, and
   * it costs no network call.
   */
  provider?: string;
  /**
   * Endpoint to interrogate. Optional because a route the adapter already
   * describes needs none; a route it does not must supply one.
   */
  baseURL?: string;
  /** Wire protocol the endpoint speaks, when the draft names one. */
  api?: string;
  /** Credential for this interrogation alone; the harness never stores it. */
  apiKey?: string;
  /** Caller cancellation; implementations must settle promptly after it aborts. */
  signal?: AbortSignal;
}
/**
 * One model an endpoint reports about itself. Every field but the id is
 * optional because most provider listings disclose an id and nothing else;
 * a surface adopting one of these still owes the capacities its adapter needs.
 */
interface LlmDiscoveredModel {
  /** Model id the endpoint accepts. */
  id: string;
  /** Human-readable name when the endpoint supplies one. */
  name?: string;
  /** Maximum combined request and response context, when disclosed. */
  contextWindow?: number;
  /** Maximum output tokens, when disclosed. */
  maxTokens?: number;
}
/** One adapter-discovered model; catalog membership is advisory, not request validation. */
interface LlmModelInfo {
  /** Provider route that owns this model entry. */
  provider: string;
  /** Model id passed to {@link GenerateOptions.model}. */
  id: string;
  /** Human-readable model name for selectors. */
  name: string;
  /** Optional user-facing distinction from otherwise similar models. */
  description?: string;
  /** Accepted request modalities; absent means unknown, while an explicit omission is negative capability. */
  inputModalities?: readonly ModelModality[];
}
/** Provider-owned context capacity for one exact provider/model route. */
interface LlmModelContext {
  /** Maximum combined request and response context in tokens. */
  contextWindow: number;
}
/** Display metadata for one adapter-owned reasoning effort. */
interface LlmReasoningEffortInfo {
  /** Opaque stable value accepted by {@link GenerateOptions.reasoningEffort}. */
  id: ReasoningEffortId;
  /** Human-readable effort name for selectors and diagnostics. */
  name: string;
  /** Optional user-facing distinction from otherwise similar efforts. */
  description?: string;
}
/** Selectable reasoning efforts for one exact provider/model route. */
interface LlmModelReasoningInfo {
  /** Supported efforts in adapter-preferred display order. */
  efforts: readonly LlmReasoningEffortInfo[];
  /**
   * Adapter-configured default materialized into requests when callers omit
   * an effort. Absence preserves the provider's own default.
   */
  defaultEffort?: ReasoningEffortId;
}
/** Exact-route model metadata resolved by its owning adapter. */
interface LlmResolvedModelInfo extends LlmModelInfo {
  /** Provider-owned context capacity when known. */
  context?: LlmModelContext;
  /** Adapter-configured per-request output cap materialized when callers omit one. */
  defaultMaxTokens?: number;
  /** Adapter-owned selectable reasoning levels when exposed. */
  reasoning?: LlmModelReasoningInfo;
}
/**
 * Raw streaming protocol emitted by adapters.
 * Block indexes correlate interleaved deltas, and `block-end` carries the
 * assembled block. Adapters emit usage before the terminal finish and nothing
 * afterward; tool arguments remain raw JSON strings. An adapter implementation
 * may throw, but `LlmRuntime.stream()` normalizes that failure to a terminal
 * `error` or `aborted` finish before exposing it to consumers.
 */
type StreamChunk = {
  type: 'block-start';
  index: number;
  blockType: ContentBlockType;
} | {
  type: 'text-delta';
  index: number;
  text: string;
} | {
  type: 'reasoning-delta';
  index: number;
  text: string;
} | {
  type: 'tool-call-delta';
  index: number;
  id: CallId;
  name?: string;
  argumentsDelta: string;
} | {
  type: 'block-end';
  index: number;
  block: ContentBlock;
} | {
  type: 'usage';
  usage: TokenUsage;
} | {
  type: 'finish';
  reason: FinishReason;
  /** Adapter-private lossless-JSON state for replaying a successful response. */
  replayState?: unknown;
};
/**
 * JSON-schema description of a tool, as sent to the model.
 *
 * Declared here (not in dsh-tools) because it is part of {@link GenerateOptions};
 * dsh-tools' ToolDefinition and dsh-system-prompt's PromptAssembly both import
 * it from this package.
 */
interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema object for the arguments. */
  parameters: Record<string, unknown>;
}
/** A single model request, fully assembled. */
interface GenerateOptions {
  /** Registered provider route selecting the adapter instance. */
  provider: string;
  model: string;
  /** Adapter-owned reasoning effort selected for this exact model. */
  reasoningEffort?: ReasoningEffortId;
  /**
   * Ordered conversation messages, exactly as the provider sees them (after
   * the `system` slot). A loop-built request assembles them as
   * the derived history (dsh-agent-loop); a hand-built one-shot passes any list.
   */
  messages: Message[];
  /** System prompt text (adapters map to the provider's system slot). */
  system?: string;
  /** Tool schemas (adapters map to the provider's `tools` field). */
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Stop sequences: generation halts as soon as the model produces any one of
   * these strings (adapters map to the provider's stop field, e.g. OpenAI
   * `stop`). The stop string itself is not included in the output.
   */
  stop?: string[];
  signal?: AbortSignal;
  /**
   * Session identity stamped by the loop for request routing. Replay uses it
   * to separate cursors; adapters may map it to model-hidden transport metadata.
   */
  sessionId?: Branded<'SessionId'>;
  /**
   * Provider-neutral classification for an auxiliary model call. Adapters may
   * map the purpose to model-hidden transport metadata or purpose-specific
   * generation policy. Ordinary conversation requests leave it unset.
   */
  purpose?: 'compaction' | 'session-title';
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+schemastery@3.18.1/node_modules/@deepseek-ai/schemastery/lib/types/index.d.ts
declare const kSchema: unique symbol;
declare global {
  namespace Schemastery {
    /** Convert primitive constructors, constants, and existing schemas into a schema type. */
    type From<X> = X extends string | number | boolean ? Schema<X> : X extends Schema ? X : X extends typeof String ? Schema<string> : X extends typeof Number ? Schema<number> : X extends typeof Boolean ? Schema<boolean> : X extends typeof Function ? Schema<Function, (...args: any[]) => any> : X extends Constructor<infer S> ? Schema<S> : never;
    type TypeS1<X> = X extends Schema<infer S, unknown> ? S : never;
    type Inverse<X> = X extends Schema<any, infer Y> ? (arg: Y) => void : never;
    /** Input type accepted by a schema-like value. */
    type TypeS<X> = TypeS1<From<X>>;
    /** Output type returned by a schema-like value after validation. */
    type TypeT<X> = ReturnType<From<X>>;
    /** Resolver callback used by custom schema types registered with `Schema.extend()`. */
    type Resolve = (data: any, schema: Schema, options: Options, strict?: boolean) => [any, any?];
    /** Input type accepted by one schema in an intersection. */
    type IntersectS<X> = From<X> extends Schema<infer S, unknown> ? S : never;
    /** Output type returned by one schema in an intersection. */
    type IntersectT<X> = Inverse<From<X>> extends ((arg: infer T) => void) ? T : never;
    type TupleS<X extends readonly any[]> = X extends readonly [infer L, ...infer R] ? [TypeS<L>?, ...TupleS<R>] : any[];
    type TupleT<X extends readonly any[]> = X extends readonly [infer L, ...infer R] ? [TypeT<L>?, ...TupleT<R>] : any[];
    type ObjectS<X extends Dict> = { [K in keyof X]?: TypeS<X[K]> | null; } & Dict;
    type ObjectT<X extends Dict> = { [K in keyof X]: TypeT<X[K]>; } & Dict;
    type Constructor<T = any> = new (...args: any[]) => T;
    /** Static constructor and factory methods exposed by the default `Schema` export. */
    interface Static {
      <T = any>(options: Partial<Schema<T>>): Schema<T>;
      new <T = any>(options: Partial<Schema<T>>): Schema<T>;
      prototype: Schema;
      /** Validate a value against a schema node and return `[output, adaptedInput?]`. */
      resolve: Resolve;
      /** Infer a schema from a primitive value, constructor, or existing schema. */
      from<X = any>(source?: X): From<X>;
      /** Register a resolver for a custom schema `type`. */
      extend(type: string, resolve: Resolve): void;
      /** Accept any value without validation. */
      any<T = any>(): Schema<T>;
      /** Accept only nullable input. */
      never(): Schema<never>;
      /** Accept exactly one constant value. */
      const<const T>(value: T): Schema<T>;
      /** Accept strings, with optional metadata constraints added by instance methods. */
      string(): Schema<string>;
      /** Accept numbers, with optional range and step constraints. */
      number(): Schema<number>;
      /** Accept non-negative integer numbers. */
      natural(): Schema<number>;
      /** Accept a number between 0 and 1 and mark it as a slider. */
      percent(): Schema<number>;
      /** Accept booleans. */
      boolean(): Schema<boolean>;
      /** Accept `Date` instances or parse datetime strings into `Date` objects. */
      date(): Schema<string | Date, Date>;
      /** Accept `RegExp` instances or parse strings into regular expressions. */
      regExp(flag?: string): Schema<string | RegExp, RegExp>;
      /** Accept binary sources and normalize them to `ArrayBufferLike`. */
      arrayBuffer(): Schema<Binary.Source, ArrayBufferLike>;
      arrayBuffer(encoding: 'hex' | 'base64'): Schema<Binary.Source | string, ArrayBufferLike>;
      /** Accept a numeric bitset or string keys and normalize to a number. */
      bitset<K extends string>(bits: Partial<Record<K, number>>): Schema<number | readonly K[], number>;
      /** Accept functions. */
      function(): Schema<Function, (...args: any[]) => any>;
      /** Accept instances of a constructor or objects whose constructor name matches. */
      is(constructor: string): Schema;
      is<T>(constructor: Constructor<T>): Schema<T>;
      /** Accept arrays whose elements match `inner`. */
      array<X>(inner: X): Schema<TypeS<X>[], TypeT<X>[]>;
      /** Accept plain objects with values matching `inner` and optional key schema. */
      dict<X, Y extends Schema<any, string> = Schema<string>>(inner: X, sKey?: Y): Schema<Dict<TypeS<X>, TypeS<Y>>, Dict<TypeT<X>, TypeT<Y>>>;
      /** Accept tuple arrays where each index matches the corresponding schema. */
      tuple<const X extends readonly any[]>(list: X): Schema<TupleS<X>, TupleT<X>>;
      /** Accept plain objects whose declared properties match the schema dictionary. */
      object<X extends Dict>(dict: X): Schema<ObjectS<X>, ObjectT<X>>;
      /** Accept values matching at least one schema in `list`. */
      union<const X>(list: readonly X[]): Schema<TypeS<X>, TypeT<X>>;
      /** Accept values matching every schema in `list`, merging object outputs. */
      intersect<const X>(list: readonly X[]): Schema<IntersectS<X>, IntersectT<X>>;
      /** Validate with `inner`, then convert the result with `callback`. */
      transform<X, T>(inner: X, callback: (value: TypeS<X>, options: Schemastery.Options) => T, preserve?: boolean): Schema<TypeS<X>, T>;
      /** Defer construction of a recursive schema until validation or serialization. */
      lazy<X extends Schema>(callback: () => X): X;
      ValidationError: typeof ValidationError;
    }
    /** Runtime validation options shared by all schema calls. */
    interface Options {
      /** Remove invalid object properties instead of throwing when possible. */
      autofix?: boolean;
      /** Skip validation for selected values and schema nodes. */
      ignore?(data: any, schema: Schema): boolean;
      /** Path used to format nested validation errors. */
      path?: (keyof any)[];
    }
    /** UI and validation metadata attached by schema builder methods. */
    interface Meta<T = any> {
      default?: T extends {} ? Partial<T> : T;
      required?: boolean;
      disabled?: boolean;
      collapse?: boolean;
      badges?: {
        text: string;
        type: string;
      }[];
      hidden?: boolean;
      loose?: boolean;
      role?: string;
      extra?: any;
      link?: string;
      description?: string | Dict<string>;
      comment?: string;
      pattern?: {
        source: string;
        flags?: string;
      };
      max?: number;
      min?: number;
      step?: number;
    }
  }
  /** Callable schema instance that validates input and returns normalized output. */
  interface Schemastery<S = any, T = S> {
    (data?: S | null, options?: Schemastery.Options): T;
    new (data?: S | null, options?: Schemastery.Options): T;
    [kSchema]: true;
    uid: number;
    meta: Schemastery.Meta<T>;
    type: string;
    sKey?: Schema;
    inner?: Schema;
    list?: Schema[];
    dict?: Dict<Schema>;
    bits?: Dict<number>;
    callback?: Function;
    constructor?: string | Function;
    builder?: Function;
    value?: T;
    refs?: Dict<Schema>;
    preserve?: boolean;
    '~standard': StandardSchemaV1.Props;
    /** Format this schema as a compact TypeScript-like type string. */
    toString(inline?: boolean): string;
    /** Serialize this schema, preserving shared and recursive references. */
    toJSON(): Schema<S, T>;
    /** Mark nullable input as invalid unless a default supplies a fallback. */
    required(value?: boolean): Schema<S, T>;
    /** Hide this schema node from UI renderers. */
    hidden(value?: boolean): Schema<S, T>;
    /** Return the default value instead of throwing when validation fails. */
    loose(value?: boolean): Schema<S, T>;
    /** Attach a renderer role and optional role-specific metadata. */
    role(text: string, extra?: any): Schema<S, T>;
    /** Attach an external documentation link. */
    link(link: string): Schema<S, T>;
    /** Set the fallback value used for nullable input. */
    default(value: T): Schema<S, T>;
    /** Attach an auxiliary comment for documentation or form UIs. */
    comment(text: string): Schema<S, T>;
    /** Attach a localized or plain description for documentation or form UIs. */
    description(text: string): Schema<S, T>;
    /** Mark this schema node as disabled for form UIs. */
    disabled(value?: boolean): Schema<S, T>;
    /** Request collapsed rendering for nested form UIs. */
    collapse(value?: boolean): Schema<S, T>;
    /** Add a deprecated badge to this schema node. */
    deprecated(): Schema<S, T>;
    /** Add an experimental badge to this schema node. */
    experimental(): Schema<S, T>;
    /** Require strings to match a regular expression. */
    pattern(regexp: RegExp): Schema<S, T>;
    /** Set an inclusive maximum for numbers or collection lengths. */
    max(value: number): Schema<S, T>;
    /** Set an inclusive minimum for numbers or collection lengths. */
    min(value: number): Schema<S, T>;
    /** Set the numeric increment constraint. */
    step(value: number): Schema<S, T>;
    /** Add or replace an object property schema. */
    set(key: string, value: Schema): Schema<S, T>;
    /** Append a tuple, union, or intersection member schema. */
    push(value: Schema): Schema<S, T>;
    /** Remove values equal to schema defaults from normalized output. */
    simplify(value?: any): any;
    /** Return a schema clone with descriptions merged from locale messages. */
    i18n(messages: Dict): Schema<S, T>;
    /** Attach arbitrary metadata consumed by form renderers and downstream tools. */
    extra<K extends keyof Schemastery.Meta>(key: K, value: Schemastery.Meta[K]): Schema<S, T>;
  }
}
declare class ValidationError extends TypeError {
  options: Schemastery.Options;
  name: string;
  constructor(message: string, options: Schemastery.Options);
  static is(error: any): error is ValidationError;
}
type Schema<S = any, T = S> = Schemastery<S, T>;
declare const Schema: Schemastery.Static;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm@0.1.0-_4ed4e5c71eb965b0bd6912871e829940/node_modules/@deepseek-ai/dsh-llm/lib/types/retry-policy.d.ts
/** Fully resolved backoff shared by both retry modes. */
interface ResolvedRetryBackoff {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}
/** Fully resolved bounded transient retry policy. */
interface ResolvedNormalRetryPolicy extends ResolvedRetryBackoff {
  readonly mode: 'normal';
  readonly maxRetries: number;
  readonly retryableCodes: readonly string[];
}
/** Fully resolved unbounded retry policy. */
interface ResolvedAlwaysRetryPolicy extends ResolvedRetryBackoff {
  readonly mode: 'always';
}
/** Immutable provider policy captured when its adapter route is registered. */
type ResolvedRetryPolicy = ResolvedNormalRetryPolicy | ResolvedAlwaysRetryPolicy;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm@0.1.0-_4ed4e5c71eb965b0bd6912871e829940/node_modules/@deepseek-ai/dsh-llm/lib/types/call-config.d.ts
/**
 * Provider, model, reasoning effort, and sampling scalars of one conversation's
 * requests. Every field maps 1:1 onto the same-named `GenerateOptions` field;
 * the loop builds requests from the logged header rather than accepting these
 * per call.
 */
interface LlmCallConfig {
  provider: string;
  model: string;
  reasoningEffort?: ReasoningEffortId;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}
/**
 * Effective config fields supplied by exact-model adapter resolution rather
 * than by the caller's request proposal.
 */
interface LlmCallConfigAdapterDefaults {
  reasoningEffort?: true;
  maxTokens?: true;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm@0.1.0-_4ed4e5c71eb965b0bd6912871e829940/node_modules/@deepseek-ai/dsh-llm/lib/types/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    llm: LlmRuntime;
  }
  interface Events {
    /**
     * Waterfall around every streaming model call (retry, replay, routing).
     * Bound to the {@link LlmRuntime}; call `next()` to reach the resolved
     * adapter's stream, or yield your own chunks to short-circuit.
     * @param options - the full request. A LOOP-built request carries the
     *   process-local {@link markAgentLoopRequest} identity and arrives deep-frozen
     *   (mutation throws): its content is a pure function of the session log (the
     *   reconstructability Agent Note), so listeners read it, never rewrite it.
     *   Hand-built calls do not carry that marker; their messages already obey
     *   the immutable creation contract.
     * @mode waterfall
     */
    'llm/stream'(this: LlmRuntime, options: GenerateOptions, next: () => AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk>;
  }
}
/** One model call whose config and adapter registration were resolved together. */
interface PreparedLlmCall {
  /** Detached, deep-frozen config with any adapter-owned default materialized. */
  readonly config: LlmCallConfig;
  /** Immutable retry policy captured with the adapter registration. */
  readonly retryPolicy: ResolvedRetryPolicy;
  /** Detached context metadata resolved with the registration-bound call. */
  readonly context?: LlmModelContext;
  /** Config fields materialized by the captured adapter rather than proposed by the caller. */
  readonly adapterDefaults: LlmCallConfigAdapterDefaults;
  /**
   * Dispatch this call once through the registration captured during
   * preparation. The request's call-config fields must match {@link config};
   * reuse or mismatch fails with `INVALID_PREPARED_CALL`.
   * @param options - fully assembled request carrying the prepared config.
   * @returns the chunk stream, including the `llm/stream` waterfall.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
/**
 * Provider-wire adapter for the harness message and stream vocabulary. Register implementations
 * with `ctx.llm.registerAdapter(providers, adapter)`. Every provider HTTP request must include
 * `attributionHeaders()`; prove the headers are added in the wire request or library header hook. The direct-fetch
 * DeepSeek and library-backed pi-ai adapters meet this contract through different internals.
 */
declare abstract class LlmAdapter {
  /**
   * Describe one provider route owned by this adapter.
   * @param provider - a route passed to `registerAdapter()` for this instance.
   * @returns detached display metadata whose id must equal `provider`.
   */
  providerInfo(provider: string): LlmProviderInfo;
  /**
   * Return the provider-owned retry policy captured with this route.
   * @param _provider - a route passed to `registerAdapter()` for this instance.
   * @returns a resolved policy, or `undefined` to use the normal defaults.
   */
  providerRetryPolicy(_provider: string): ResolvedRetryPolicy | undefined;
  /**
   * List models this adapter can currently advertise for one owned provider.
   * The result is advisory: an adapter may accept unlisted model ids, and
   * consumers must not turn absence into request rejection.
   * @param _provider - one provider route owned by this adapter.
   * @returns discoverable models in adapter-preferred order.
   */
  listModels(_provider: string): Promise<readonly LlmModelInfo[]>;
  /**
   * Resolve all metadata available for one exact model. This query is
   * independent of the advisory catalog and does not validate request routing.
   * @param provider - one provider route owned by this adapter.
   * @param model - exact model id passed to {@link GenerateOptions.model}.
   * @param _signal - cancellation for this exact-model lookup; asynchronous
   *   implementations must settle promptly after it aborts.
   * @returns provider/model identity plus any context, call-default, and reasoning metadata.
   */
  resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
  /**
   * Stream one model call as raw chunks. The only required method.
   * @param options - the fully-assembled request; implementations must honor `options.signal`.
   * @returns the chunk stream, obeying the adapter contract documented on `StreamChunk`.
   */
  abstract stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
/**
 * What {@link LlmRuntime.registerAdapter} returns: the disposer, plus an
 * atomic route replacement for the same adapter instance.
 */
interface AdapterRegistrationHandle {
  /** Release every route this registration currently holds. */
  (): void;
  /**
   * Replace this registration's routes with `providers`, keeping the same
   * adapter instance. The candidate set is validated in full first — a
   * conflict with another adapter, an invalid name, or bad provider metadata
   * throws and leaves the current routes untouched — and the swap itself is
   * one synchronous section, so no request can observe a gap. An empty array
   * is legal here (a settings section that emptied holds zero routes while
   * staying registered), unlike an empty initial registration.
   *
   * Throws `LlmError` with code `REGISTRATION_DISPOSED` once the registration
   * has been released: its routes are gone and its disposer has already run,
   * so anything registered afterwards would have no owner left to release it.
   * @param providers - the complete next route set for this registration.
   */
  replace(providers: string[]): void;
}
/**
 * A live configurable-provider registration, disposable and atomically
 * replaceable — the directory counterpart of {@link AdapterRegistrationHandle}.
 */
interface DirectoryRegistrationHandle {
  /** Withdraw every entry this registration currently holds. */
  (): void;
  /**
   * Replace this registration's entries with `entries`. The candidate set is
   * validated in full first — an entry another registration already declares,
   * a duplicate within the set, or invalid metadata throws and leaves the
   * current entries untouched — and the swap is one synchronous section, so no
   * reader observes a gap. An empty array is legal here, unlike an empty
   * initial registration.
   *
   * Throws `LlmError` with code `REGISTRATION_DISPOSED` once the registration
   * has been disposed.
   */
  replace(entries: readonly LlmConfigurableProvider[]): void;
}
/**
 * The abstract `llm` service: an adapter registry plus a streaming model-call
 * API, interceptable via the `llm/stream` waterfall.
 */
declare class LlmRuntime extends Service {
  private adapters;
  private directory;
  private discoveries;
  constructor(ctx: Context);
  /** Notify topology observers without letting one broken listener veto the commit. */
  private emitAdaptersUpdated;
  /** Contained-listener diagnostic shared by the sync and async failure paths. */
  private warnAdaptersListenerFailure;
  /**
   * Register an adapter for the given provider routes. Throws `LlmError` with code
   * `DUPLICATE_ADAPTER` if any provider already has an adapter (all-or-nothing).
   * Disposed with the fiber.
   * @param providers - every provider route this adapter should serve.
   * @param adapter - the adapter that streams calls for those providers.
   * @returns the disposer, carrying {@link AdapterRegistrationHandle.replace}.
   */
  registerAdapter(providers: string[], adapter: LlmAdapter): AdapterRegistrationHandle;
  /**
   * Validate one candidate route set for `adapter`, treating routes this
   * registration already holds as available. Nothing is mutated: a rejected
   * candidate leaves the registry exactly as it was.
   */
  private prepareRoutes;
  /**
   * Swap this registration's routes for the prepared ones in one synchronous
   * section, so no observer can see the registry between the release and the
   * re-registration. The route set's one mutation point is also where
   * `llm/adapters-updated` is published, so a `replace` announces itself
   * exactly like a first registration.
   */
  private commitRoutes;
  /**
   * Describe provider routes with a registered adapter.
   * @returns detached provider metadata in registration order.
   */
  listProviders(): LlmProviderInfo[];
  /**
   * Declare provider routes an adapter plugin can activate through
   * configuration. Registration is all-or-nothing: an empty list, invalid
   * entry, or a provider already declared by any registration throws
   * `LlmError` without registering the rest. Disposed with the fiber.
   * @param entries - every configurable provider this plugin owns.
   * @returns a handle that withdraws all of them, and can atomically replace them.
   */
  registerConfigurableProviders(entries: readonly LlmConfigurableProvider[]): DirectoryRegistrationHandle;
  /**
   * List every declared configurable provider, registered or dormant.
   * @returns detached directory entries in declaration order.
   */
  listConfigurableProviders(): LlmConfigurableProvider[];
  /**
   * Offer to interrogate provider endpoints on behalf of the settings
   * namespace this plugin owns. The namespace is the key because that is what
   * a configuration surface already holds from the configurable-provider
   * directory, and because a provider being *added* has no route to name yet.
   * Disposed with the fiber.
   * @param settingsNs - the namespace whose profiles this discovery serves.
   * @param discover - interrogates one endpoint; must honor `request.signal`.
   * @returns the disposer that withdraws the offer.
   */
  registerModelDiscovery(settingsNs: string, discover: (request: LlmModelDiscoveryRequest) => Promise<readonly LlmDiscoveredModel[]>): () => void;
  /**
   * Interrogate one provider endpoint for the models it advertises. The
   * request describes a draft, not a stored route, so nothing here reads or
   * writes settings or credentials — the caller owns both, and the reply is
   * candidate metadata a surface may offer for adoption.
   * @param settingsNs - namespace whose registered discovery serves this draft.
   * @param request - the endpoint, protocol, and one-shot credential to use.
   * @returns the advertised models, deduplicated in endpoint order.
   */
  discoverModels(settingsNs: string, request: LlmModelDiscoveryRequest): Promise<LlmDiscoveredModel[]>;
  /**
   * Resolve the retry policy captured when one provider route was registered.
   * @param provider - registered provider route to inspect.
   * @returns the provider-owned policy, with normal defaults already resolved.
   */
  providerRetryPolicy(provider: string): ResolvedRetryPolicy;
  /** Detach typed adapter-owned modality metadata. */
  private detachedModalities;
  /**
   * Discover models advertised by one registered provider. Catalog membership
   * is advisory and never changes routing or request validation.
   * @param provider - registered provider route to inspect.
   * @returns detached model metadata in adapter-preferred order.
   */
  listModels(provider: string): Promise<LlmModelInfo[]>;
  /**
   * Resolve and validate all metadata from the adapter that owns one exact
   * route. The result is detached from adapter-owned objects; catalog
   * membership remains advisory and does not control request routing.
   * @param provider - registered provider route to inspect.
   * @param model - exact model id passed to the adapter.
   * @param signal - optional cancellation for adapter-owned asynchronous lookup.
   * @returns exact model identity plus available context and reasoning metadata.
   */
  resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
  private resolveModelInfoFor;
  /**
   * Validate a conversation call config against its exact model capability and
   * materialize adapter-configured defaults. Unsupported explicit efforts
   * reject before provider I/O; no clamping or aliasing is performed. This
   * standalone query does not bind a later dispatch; use {@link prepareCall}
   * when logging and streaming must share one adapter registration.
   * @param config - provider/model route and optional request controls.
   * @param signal - optional cancellation for adapter-owned capability lookup.
   * @returns a detached config only when a default must be materialized.
   */
  resolveCallConfig(config: LlmCallConfig, signal?: AbortSignal): Promise<LlmCallConfig>;
  private resolveCallFor;
  /**
   * Resolve one call under its current adapter registration. The returned
   * one-shot handle keeps that registration across header logging and dispatch,
   * so HMR cannot combine one adapter's capability result with another adapter.
   * @param config - provider/model route and optional request controls.
   * @param signal - optional cancellation for adapter-owned capability lookup.
   * @returns a prepared config and its registration-bound stream entry point.
   */
  prepareCall(config: LlmCallConfig, signal?: AbortSignal): Promise<PreparedLlmCall>;
  private registration;
  /** Remove replay state whose historical route is owned by another adapter. */
  private forAdapter;
  /**
   * Final adapter boundary. Adapter selection, dispatch, iterator construction,
   * and iteration failures become one terminal failure chunk. Middleware and
   * downstream consumer failures remain thrown plugin or consumer errors.
   */
  private adapterStream;
  /**
   * Stream one model call as raw chunks (token-level deltas). Replay state is
   * retained only when the same adapter instance owns its historical provider
   * and the target provider. Final adapter selection remains fixed through
   * asynchronous exact-model resolution and dispatch. Adapter selection,
   * dispatch, and iteration failures become terminal `error` or `aborted`
   * finish chunks; middleware, nested-call, cleanup, and consumer failures
   * remain thrown.
   * @param options - the full request; `options.provider` selects the adapter.
   * @returns the chunk stream, possibly wrapped by `llm/stream` listeners.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
  private streamWithRegistration;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-session@0._959f4648d9537c86268b5de534a89875/node_modules/@deepseek-ai/dsh-session/lib/types/json.d.ts
/** Lossless-JSON validation and detached snapshots for durable session data. @module @deepseek-ai/dsh-session/json */
/**
 * A value that round-trips losslessly through JSON: `null`, a boolean, a finite
 * number other than negative zero, a string, an array of such values, or a
 * plain object whose values are such values. Arrays may carry only their dense
 * indexed elements; extra own properties would be discarded by JSON. TypeScript
 * cannot distinguish `-0` from `number`, so {@link isJsonValue} and
 * {@link snapshotJsonValue} enforce these details at runtime. Use this type for
 * a payload that must survive session-log persistence and replay byte-identically
 * — e.g. a tool's private presentation `meta`.
 */
type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-session@0._959f4648d9537c86268b5de534a89875/node_modules/@deepseek-ai/dsh-session/lib/types/types.d.ts
/** Identifies one session in the store (and its persistence artifacts). */
type SessionId = Branded<'SessionId'>;
/**
 * Brand a string as a {@link SessionId}.
 * @param id - the raw session id string.
 * @returns the same string, branded (a compile-time cast — no runtime cost).
 */
declare function SessionId(id: string): SessionId;
/** Why an active agent driver was cancelled. */
type AgentCancelCause = {
  readonly kind: 'user';
} | {
  readonly kind: 'parent';
} | {
  readonly kind: 'hook';
  readonly reason: string;
} | {
  readonly kind: 'disposed';
};
/** Durable cancellation cause, including imports whose original coarse record carried no cause. */
type TurnEndCancelCause = AgentCancelCause | {
  readonly kind: 'legacy';
};
/**
 * Why a turn ended. Merge-extensible sum type.
 */
interface TurnEndReasonMap {
  completed: {
    kind: 'completed';
  };
  /** A cancellation request interrupted the live turn. */
  aborted: {
    kind: 'aborted';
    reason: TurnEndCancelCause;
  };
  blocked: {
    kind: 'blocked';
  };
  /**
   * The turn failed. `error` is always a structured failure: the `LlmError`
   * facts verbatim, or `{ message: errorChain(error), code: 'UNKNOWN' }`
   * flattened from any other error.
   */
  error: {
    kind: 'error';
    error: LlmFailure;
  };
  /** At least one step reached its output-token ceiling, even if a plugin continued the turn. */
  'max-tokens': {
    kind: 'max-tokens';
  };
  /**
   * A persistence backend closed a crash-orphaned turn on reload. The loop never
   * emits this marker, and the events recorded before the crash remain intact.
   */
  interrupted: {
    kind: 'interrupted';
  };
}
/** The union over {@link TurnEndReasonMap} — why a turn ended; plugins extend it by merging variants into the map. */
type TurnEndReason = TurnEndReasonMap[keyof TurnEndReasonMap];
/**
 * One entry in an agent's todo list — the unit of the `todo/write`
 * {@link SessionEventMap} event's whole-list snapshot.
 *
 * Deliberately minimal: a human-readable `content` line and a three-state
 * `status`. No id, priority, or `activeForm` — the list is replaced wholesale
 * on every write (last-write-wins), so entries need no stable identity. The
 * three statuses describe the complete portable lifecycle needed by model and
 * UI consumers.
 */
interface TodoItem {
  /** What this task is — a short imperative line shown in the UI. */
  content: string;
  /** Lifecycle state. `in_progress` marks a task being worked now; parallel work may mark several. */
  status: 'pending' | 'in_progress' | 'completed';
}
/**
 * Logged request state outside derived history: call config, system prompt, and
 * tools. The latest full `request/header` snapshot reconstructs it; canonical
 * empty optional fields are absent.
 */
interface EpochHeader {
  /** The conversation's call configuration (provider, model, reasoning effort, and sampling scalars). */
  config: LlmCallConfig;
  /** Effective config fields materialized from the exact adapter rather than proposed by a caller. */
  adapterDefaults?: LlmCallConfigAdapterDefaults;
  /** Rendered system prompt text; absent for a system-less request. */
  system?: string;
  /** Assembled tool schemas; absent for a tool-less request. */
  tools?: ToolSchema[];
}
/** Registration-bound metadata for one resolved model route. */
interface RequestContext {
  /** Registered provider route the metadata belongs to. */
  provider: string;
  /** Provider-owned model id the metadata belongs to. */
  model: string;
  /** Maximum combined request and response context in tokens, when advertised. */
  contextWindow?: number;
}
/**
 * Why a `request/header` snapshot was appended: `'initial'` — the log's first
 * header (a new conversation); `'resume'` — a loop instance's first request
 * over a log that already has header events (process restart, fork seed);
 * `'change'` — a later request used a different header.
 */
type RequestHeaderReason = 'initial' | 'resume' | 'change';
/**
 * The merge-extensible, append-only source of truth for an agent interaction.
 * Message history is derived from this log. Every event is lossless JSON and
 * sequence numbers stay contiguous, including raw chunks, so persistence can
 * store the canonical log verbatim.
 */
interface SessionEventMap {
  /**
   * Opens turn `turn` before the loop claims queued input or runs pre-step.
   * Rejection, empty input, cancellation, or failure may close it with no
   * step; otherwise the following identified `user/message` event or batch
   * records the messages entering the step.
   */
  'turn/start': {
    turn: number;
  };
  /**
   * Closes turn `turn` with the {@link TurnEndReason} that ended it. A turn
   * with no entered step has no `step/start` or `step/end`. The loop does not await a
   * flush at turn boundaries: `dsh-session-checkpoint-policy` owns the
   * per-request durability checkpoint, and consumers that read storage after
   * `whenIdle()` flush themselves. Success commits the turn; rejection is
   * reported live and does not prevent later work.
   */
  'turn/end': {
    turn: number;
    reason: TurnEndReason;
  };
  /** Opens step `step` of turn `turn` — one model call plus the tool executions it requested. */
  'step/start': {
    turn: number;
    step: number;
  };
  /** Closes step `step` of turn `turn`. */
  'step/end': {
    turn: number;
    step: number;
  };
  /**
   * A user-role message on the model-visible surface: a direct human prompt
   * (the queued message claimed for this turn), a synthetic `agent.inject()`
   * context (file-change notices, subdir AGENTS.md, skill content, cron
   * notifications, …), or an entered goal continuation round. All three
   * project their `content` verbatim; `source` tells them apart.
   */
  'user/message': UserMessage;
  /** Raw stream chunk — token-level replay fidelity. */
  'assistant/chunk': {
    turn: number;
    step: number;
    chunk: StreamChunk;
  };
  /**
   * Assembled assistant message for one step (derived history uses this).
   * Carries the step's `usage` when the adapter reported token accounting, so
   * the model output and its accounting travel together (there is no separate
   * usage record). `usage` is absent when the adapter reported none.
   */
  'assistant/message': {
    turn: number;
    step: number;
    message: AssistantMessage;
    usage?: TokenUsage;
  };
  /**
   * The model requested one tool invocation: `name` with the raw `arguments`
   * JSON string exactly as the model produced it (unparsed). `callId` pairs the
   * call with its `tool/result`.
   */
  'tool/call': {
    turn: number;
    step: number;
    callId: CallId;
    name: string;
    arguments: string;
  };
  /**
   * A completed tool call's model-facing result, optional internal failure
   * identity, and optional tool-private `meta` presentation payload. `meta` is
   * opaque to the core (the producing tool owns its shape and reads it back in
   * `presentResult`) but MUST be JSON-serializable: `Session.append`
   * runtime-validates all event data with `isJsonValue`, so a non-serializable
   * `meta` is rejected at the source, and the durable log reproduces the
   * identical card on replay. Absent
   * unless the tool attaches one (e.g. `dsh-tool-fs` carries its result-time
   * contextual diff here).
   */
  'tool/result': {
    turn: number;
    step: number;
    message: ToolResultMessage;
    error?: {
      name: string;
      code: string;
    };
    meta?: JsonValue;
  };
  /** Whole-list snapshot; latest write wins on replay. Log-only UI state; never derived history. */
  'todo/write': {
    todos: TodoItem[];
  };
  /**
   * Full header for the next request, appended inside its step before dispatch.
   * It is log-only; the latest snapshot reconstructs the request header.
   */
  'request/header': {
    header: EpochHeader;
    reason: RequestHeaderReason;
  };
  /**
   * Route metadata for the next request, logged only when the route or capacity
   * changes. It does not participate in request reconstruction or header equality.
   */
  'request/context': RequestContext;
  /**
   * Marks the end of a constructor seed. Events before it have smaller seq
   * values and came from the seed (resume, fork, or replay); this lifecycle
   * produced none of them. This log-only event is the durable projection of
   * {@link Session.firstLiveSeq}. Its payload is empty — position and `time`
   * carry the meaning.
   *
   * Locate the LAST one in stored history. A seed already ending in one is not
   * re-marked, so reopening an untouched session does not grow its log per
   * pickup and the event need not be at the current `firstLiveSeq`.
   *
   * `Session`'s constructor is the only legitimate writer. The invariant
   * companion deliberately constrains nothing here, so a plugin appending one
   * would silently classify every live bracket before it as seed history.
   *
   * An owner of a standalone open/close bracket (`compaction/start` …
   * `compaction/end`) reads it because seed history and live work are otherwise
   * byte-identical: an unmatched opening marker before this event belongs to
   * an ended lifecycle, whatever ended it. NOT a liveness signal about other
   * writers — a concurrently live session holds its own boundary elsewhere,
   * so tolerating concurrent writers needs a signal beyond the log.
   */
  'session/end-seed': Record<string, never>;
}
/** The appendable event-type keys of {@link SessionEventMap}, plugin-merged extensions included. */
type SessionEventType = keyof SessionEventMap;
/**
 * The subset of {@link SessionEventType} values whose events produce LLM
 * messages and are eligible to appear on the ordered surface. Only these
 * event types may carry {@link SurfaceOp} and {@link SessionEvent.sourceEventSeqs}.
 */
type SurfaceEventType = 'user/message' | 'assistant/message' | 'tool/result';
/**
 * How a session event entered the ordered surface. Only valid on
 * {@link SurfaceEventType} events.
 *
 * - `'append'`: added to the tail — normal path for user/assistant/tool
 *   messages.
 * - `{ op: 'replace', start, end }`: replaces surface nodes from `start`
 *   (inclusive) through `end` (inclusive) with this node. Both must exist as
 *   surface nodes in the current surface. `start === end` replaces a single
 *   node. The node's {@link SessionEvent.sourceEventSeqs} must include every
 *   shadowed surface node. Used by compaction; any surface-replacing producer
 *   may use it.
 */
type SurfaceOp = 'append' | {
  op: 'replace';
  start: number;
  end: number;
};
/**
 * One immutable entry in the session log.
 *
 * A proper discriminated union over `type` (not independent `type`/`data`
 * unions), so `switch (event.type)` narrows `event.data` without casts.
 *
 * The {@link sourceEventSeqs} and {@link surfaceOp} fields are conditional:
 * they only exist on {@link SurfaceEventType} variants (`user/message`,
 * `assistant/message`, `tool/result`).
 * Non-surface events (boundary markers, chunks, usage, errors) never carry
 * surface metadata — the compiler enforces this at `Session.append()`
 * call sites.
 */
type SessionEvent<T extends SessionEventType = SessionEventType> = { [K in SessionEventType]: {
  type: K;
  /** Monotonic sequence number within the session. */
  seq: number;
  /** Unix epoch milliseconds. */
  time: number;
  data: SessionEventMap[K];
  /**
   * Marks an event a reader may safely skip when it does not recognize
   * `type`. Absent means required: a reader meeting an unrecognized type
   * without this marker MUST refuse to reconstruct the session instead of
   * silently dropping the event, because an unrecognized required event may
   * change how the rest of the log is interpreted. A writer sets `true` only
   * on purely informational records whose loss cannot affect reconstruction;
   * defaulting to required means a forgotten marker over-refuses (an
   * inconvenience) rather than silently resuming a gutted session.
   */
  ignorable?: true;
} & (K extends SurfaceEventType ? {
  /**
   * Seq numbers of earlier events that this event cites as sources
   * (e.g. the `assistant/chunk` seqs that built an `assistant/message`,
   * or the surface nodes shadowed by a compaction replace node). An
   * `assistant/message` may carry a present empty array for a known empty
   * provider stream; when the field is absent, the event does not record which
   * earlier events produced the message.
   */
  sourceEventSeqs?: number[];
  /** How this event entered the surface; absent for non-surface events. */
  surfaceOp?: SurfaceOp;
} : object); }[T];
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-commands@0_f18bd7aa4aa916b517165061977dda49/node_modules/@deepseek-ai/dsh-commands/lib/typert.remote-client.d.ts
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$636f6d6d616e6473 {
    execute: (agentId: SessionId, line: string, signal?: AbortSignal) => Promise<RemoteResult<CommandExecution | undefined>>;
    list: (agentId: SessionId) => Promise<RemoteResult<readonly CommandDescriptor[]>>;
  }
  interface TypertRemoteMap {
    'commands/execute': (agentId: SessionId, line: string, signal?: AbortSignal) => Promise<RemoteResult<CommandExecution | undefined>>;
    'commands/list': (agentId: SessionId) => Promise<RemoteResult<readonly CommandDescriptor[]>>;
  }
  interface TypertRemoteNamespaceMap {
    'commands': TypertRemoteNamespace$636f6d6d616e6473;
  }
  interface TypertRemoteScopeMap {
    'agent:commands/execute': (line: string, signal?: AbortSignal) => Promise<RemoteResult<CommandExecution | undefined>>;
    'agent:commands/list': () => Promise<RemoteResult<readonly CommandDescriptor[]>>;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-goal@0.1.0_6fbe292c0215d8322c4f499aa705fbab/node_modules/@deepseek-ai/dsh-goal/lib/types/types.d.ts
/** Identifies one goal across its durable revisions. */
type GoalId = Branded<'GoalId'>;
/** Compare-and-set identity for one exact goal revision. */
interface GoalRef {
  /** Stable goal identity. */
  readonly id: GoalId;
  /** Positive revision; every durable mutation increments it. */
  readonly revision: number;
}
/** Input whose omitted round cap is resolved by the service configuration. */
interface CreateGoalRequest {
  readonly objective: string;
  readonly maxGoalRounds?: number;
}
/** Wire-safe acknowledgement of one created goal. */
interface CreateGoalResult {
  readonly ref: GoalRef;
}
/** Fields changed by an edit; at least one must be present. */
interface EditGoalRequest {
  readonly objective?: string;
  readonly maxGoalRounds?: number;
}
/** Durable continuation phase. Activation is process-local and separate. */
type GoalPhase = 'active' | 'paused' | 'blocked' | 'complete';
/** Machine-routable and human-readable explanation for a blocked goal. */
interface GoalBlockReason {
  /** Stable lower-kebab-case classification chosen by the blocking policy. */
  readonly code: string;
  /** Non-empty explanation shown to humans and models. */
  readonly message: string;
}
/** Full durable state written by every non-clear goal mutation. */
interface GoalSnapshot extends GoalRef {
  /** Human-requested completion objective. */
  readonly objective: string;
  /** Durable lifecycle phase. */
  readonly phase: GoalPhase;
  /** Present exactly while `phase` is `blocked`. */
  readonly blockedReason?: GoalBlockReason;
  /** Total admitted goal-round cap. */
  readonly maxGoalRounds: number;
}
/** Whether this live process may automatically continue an active goal. */
type GoalActivation = 'armed' | 'disarmed';
/** Current goal projection, including values derived from the session log. */
interface GoalView extends GoalSnapshot {
  /** Highest admitted round number for this goal. */
  readonly roundsStarted: number;
  /** Epoch milliseconds of the create mutation. */
  readonly createdAt: number;
  /** Epoch milliseconds of the latest mutation. */
  readonly updatedAt: number;
  /** Process-local continuation eligibility; never persisted. */
  readonly activation: GoalActivation;
}
/**
 * The `goal` projection value: the current durable goal with its replay
 * counters, exactly as the latest `goal/change` event carried them.
 * Activation is process-local (never persisted) and deliberately absent —
 * the projection reflects durable phase only.
 */
interface GoalProjection {
  /** Current durable goal snapshot (the CAS ref for mutations rides on it). */
  readonly goal: GoalSnapshot;
  /** Highest admitted round number for this goal. */
  readonly roundsStarted: number;
  /** Epoch milliseconds of the create mutation. */
  readonly createdAt: number;
  /** Epoch milliseconds of the latest mutation. */
  readonly updatedAt: number;
}
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * The session's current goal (the latest `goal/change` whole value), or
     * `null` before the first create and after a clear tombstone.
     * Whole-value rule: every goal change carries the complete post-change
     * state, so the fold is last-wins.
     */
    goal: GoalProjection | null;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-goal@0.1.0_6fbe292c0215d8322c4f499aa705fbab/node_modules/@deepseek-ai/dsh-goal/lib/typert.remote-client.d.ts
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$676f616c73 {
    clear: (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalRef>>;
    complete: (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalView>>;
    create: (agentId: SessionId, request: CreateGoalRequest) => Promise<RemoteResult<CreateGoalResult>>;
    edit: (agentId: SessionId, ref: GoalRef, request: EditGoalRequest) => Promise<RemoteResult<GoalView>>;
    pause: (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalView>>;
    resume: (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalView>>;
  }
  interface TypertRemoteMap {
    'goals/clear': (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalRef>>;
    'goals/complete': (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalView>>;
    'goals/create': (agentId: SessionId, request: CreateGoalRequest) => Promise<RemoteResult<CreateGoalResult>>;
    'goals/edit': (agentId: SessionId, ref: GoalRef, request: EditGoalRequest) => Promise<RemoteResult<GoalView>>;
    'goals/pause': (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalView>>;
    'goals/resume': (agentId: SessionId, ref: GoalRef) => Promise<RemoteResult<GoalView>>;
  }
  interface TypertRemoteNamespaceMap {
    'goals': TypertRemoteNamespace$676f616c73;
  }
  interface TypertRemoteScopeMap {
    'agent:goals/clear': (ref: GoalRef) => Promise<RemoteResult<GoalRef>>;
    'agent:goals/complete': (ref: GoalRef) => Promise<RemoteResult<GoalView>>;
    'agent:goals/create': (request: CreateGoalRequest) => Promise<RemoteResult<CreateGoalResult>>;
    'agent:goals/edit': (ref: GoalRef, request: EditGoalRequest) => Promise<RemoteResult<GoalView>>;
    'agent:goals/pause': (ref: GoalRef) => Promise<RemoteResult<GoalView>>;
    'agent:goals/resume': (ref: GoalRef) => Promise<RemoteResult<GoalView>>;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-plugi_a33844441aba7e573dfa46a8ea41019c/node_modules/@deepseek-ai/dsh-host-plugin-inventory/lib/typert.remote-client.d.ts
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$706c7567696e496e76656e746f7279 {
    list: () => Promise<RemoteResult<PluginInventorySnapshot>>;
  }
  interface TypertRemoteMap {
    'pluginInventory/list': () => Promise<RemoteResult<PluginInventorySnapshot>>;
  }
  interface TypertRemoteNamespaceMap {
    'pluginInventory': TypertRemoteNamespace$706c7567696e496e76656e746f7279;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-message-fe_f53d87b850e3a3120b947da1cac28640/node_modules/@deepseek-ai/dsh-message-feedback/lib/types/types.d.ts
/** Opaque compare-and-set token for one exact feedback item revision. */
type MessageFeedbackVersion = Branded<'MessageFeedbackVersion'>;
/** The human's overall judgment of one assistant message. */
type MessageFeedbackRating = 'positive' | 'negative';
/** One current feedback value and its opaque mutation token. */
interface MessageFeedbackItem {
  /** Stable identity of the assistant message inside the owning Session. */
  readonly messageId: MessageId;
  /** Overall positive or negative judgment. */
  readonly rating: MessageFeedbackRating;
  /** Optional explanation, preserved verbatim after validation. */
  readonly note?: string;
  /** Equality-only token replaced by every material create or update. */
  readonly version: MessageFeedbackVersion;
  /** Host-assigned creation time in Unix epoch milliseconds. */
  readonly createdAt: number;
  /** Host-assigned time of the most recent material update. */
  readonly updatedAt: number;
}
/** Read all message feedback belonging to one persisted Session lifecycle. */
interface MessageFeedbackListRequest {
  /** Persisted Session whose sidecar should be read. */
  readonly sessionId: SessionId;
}
/** Current feedback values for one Session, in first-creation order. */
interface MessageFeedbackListValue {
  /** Fresh immutable item snapshots. */
  readonly items: readonly MessageFeedbackItem[];
}
/** Create or replace feedback for one assistant message. */
interface MessageFeedbackPutRequest {
  /** Persisted Session that owns the target message. */
  readonly sessionId: SessionId;
  /** Target assistant-message identity. */
  readonly messageId: MessageId;
  /** Desired overall judgment. */
  readonly rating: MessageFeedbackRating;
  /** Optional non-blank explanation. */
  readonly note?: string;
  /** Observed item version, or `null` to require that no item exists. */
  readonly ifVersion: MessageFeedbackVersion | null;
}
/** Delete feedback for one message after observing its current version. */
interface MessageFeedbackDeleteRequest {
  /** Persisted Session that owns the sidecar. */
  readonly sessionId: SessionId;
  /** Message whose feedback should be absent after this operation. */
  readonly messageId: MessageId;
  /** Observed item version; ignored when the item is already absent. */
  readonly ifVersion: MessageFeedbackVersion;
}
/** Idempotent deletion acknowledgement. */
interface MessageFeedbackDeleteValue {
  /** Stable postcondition shared by the first deletion and every retry. */
  readonly absent: true;
}
/** No persisted Session header exists for the requested id. */
interface MessageFeedbackSessionNotFound {
  readonly code: 'session-not-found';
  readonly sessionId: SessionId;
}
/** The id does not name a derived, append-origin assistant message. */
interface MessageFeedbackTargetNotFound {
  readonly code: 'target-not-found';
  readonly sessionId: SessionId;
  readonly messageId: MessageId;
}
/** A material mutation did not match the addressed item's current version. */
interface MessageFeedbackVersionConflict {
  readonly code: 'version-conflict';
  /** Authoritative current item, or `null` when it does not exist. */
  readonly current: MessageFeedbackItem | null;
}
/** A supplied note contains no non-whitespace character. */
interface MessageFeedbackNoteBlank {
  readonly code: 'note-blank';
}
/** A supplied note exceeds the configured UTF-8 byte limit. */
interface MessageFeedbackNoteTooLarge {
  readonly code: 'note-too-large';
  readonly maxBytes: number;
  readonly actualBytes: number;
}
/** Failures shared by the public message-feedback operations. */
type MessageFeedbackFailure = MessageFeedbackSessionNotFound | MessageFeedbackTargetNotFound | MessageFeedbackVersionConflict | MessageFeedbackNoteBlank | MessageFeedbackNoteTooLarge;
/** Successful public operation result. */
interface MessageFeedbackSuccess<T> {
  readonly ok: true;
  readonly value: T;
}
/** Rejected public operation result with a stable business failure. */
interface MessageFeedbackRejected<E extends MessageFeedbackFailure> {
  readonly ok: false;
  readonly error: E;
}
/** Result returned by the message-feedback `list` operation. */
type MessageFeedbackListResult = MessageFeedbackSuccess<MessageFeedbackListValue> | MessageFeedbackRejected<MessageFeedbackSessionNotFound>;
/** Result returned by the message-feedback `put` operation. */
type MessageFeedbackPutResult = MessageFeedbackSuccess<MessageFeedbackItem> | MessageFeedbackRejected<MessageFeedbackSessionNotFound | MessageFeedbackTargetNotFound | MessageFeedbackVersionConflict | MessageFeedbackNoteBlank | MessageFeedbackNoteTooLarge>;
/** Result returned by the message-feedback `delete` operation. */
type MessageFeedbackDeleteResult = MessageFeedbackSuccess<MessageFeedbackDeleteValue> | MessageFeedbackRejected<MessageFeedbackSessionNotFound | MessageFeedbackVersionConflict>;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-message-fe_f53d87b850e3a3120b947da1cac28640/node_modules/@deepseek-ai/dsh-message-feedback/lib/typert.remote-client.d.ts
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$6d657373616765466565646261636b {
    delete: (request: MessageFeedbackDeleteRequest) => Promise<RemoteResult<MessageFeedbackDeleteResult>>;
    list: (request: MessageFeedbackListRequest) => Promise<RemoteResult<MessageFeedbackListResult>>;
    put: (request: MessageFeedbackPutRequest) => Promise<RemoteResult<MessageFeedbackPutResult>>;
  }
  interface TypertRemoteMap {
    'messageFeedback/delete': (request: MessageFeedbackDeleteRequest) => Promise<RemoteResult<MessageFeedbackDeleteResult>>;
    'messageFeedback/list': (request: MessageFeedbackListRequest) => Promise<RemoteResult<MessageFeedbackListResult>>;
    'messageFeedback/put': (request: MessageFeedbackPutRequest) => Promise<RemoteResult<MessageFeedbackPutResult>>;
  }
  interface TypertRemoteNamespaceMap {
    'messageFeedback': TypertRemoteNamespace$6d657373616765466565646261636b;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-api-remote_fef884e73d55fcfa32172daa083f28db/node_modules/@deepseek-ai/dsh-api-remotes/lib/types/remote-events.d.ts
/**
 * The one home of this application's forwarded-Host-event allowlist. Both
 * compiler faces list this file, so the Host forwarding loop and the consumer
 * `ctx.remote.$on` key face read one declaration instead of two copies that
 * could drift; `./types.ts` derives the type projection from it and stays
 * type-only.
 */
/**
 * Host events this application forwards to consumers verbatim: no projection,
 * no redaction, no renaming. The wire name is the Host cordis event name and
 * the payload is its argument list, so this array is simultaneously the whole
 * control point over what a consumer can receive and the legal key set of
 * `ctx.remote.$on`. Forwarding one more event is an entry here and nothing
 * else.
 */
declare const API_REMOTE_FORWARDED_EVENTS: readonly ["agent-preset/selected", "commands/change", "credentials/updated", "cordis/request-run", "cordis/request-run-resolved", "cordis/dynamic-package", "cordis/dynamic-retract", "cordis/inspect-query", "cordis/inspect-query-resolved", "llm/adapters-updated", "settings/document-updated"];
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-api-remote_fef884e73d55fcfa32172daa083f28db/node_modules/@deepseek-ai/dsh-api-remotes/lib/types/types.d.ts
/** Type projection of the allowlist; the consumer and the Host read this one. */
type ApiRemoteForwardedEvent = typeof API_REMOTE_FORWARDED_EVENTS[number];
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteEventSelection extends Record<ApiRemoteForwardedEvent, true> {}
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-cordis-hos_7a0ffda0d46a1fe34c66cb5287df31d2/node_modules/@deepseek-ai/dsh-cordis-host-runner/lib/types/types.d.ts
/** Stable identity of one dynamic plugin instance. */
type CordisDynamicPluginId = Branded<'CordisDynamicPluginId'>;
/** Identity of one immutable package version belonging to a dynamic plugin. */
type CordisDynamicPackageId = Branded<'CordisDynamicPackageId'>;
/** Identity of one successful activation attempt. */
type CordisDynamicPluginRunId = Branded<'CordisDynamicPluginRunId'>;
/** Identity of one human approval request. */
type ApprovalRequestId$1 = Branded<'ApprovalRequestId'>;
/** Identity of one cross-page inspect query. */
type CordisInspectRequestId = Branded<'CordisInspectRequestId'>;
/** One model-callable read-only query exposed by an inspect provider. */
interface CordisInspectMethodManifest {
  /** Method name, unique within its provider. */
  name: string;
  /** What the query returns and when to use it. */
  description: string;
  /** JSON Schema accepted by the query. */
  inputSchema: JsonValue;
  /** JSON Schema produced by the query. */
  outputSchema: JsonValue;
}
/** Serializable directory entry for one inspect provider. */
interface CordisInspectProviderManifest {
  /** Provider identity, unique within one platform. */
  id: string;
  /** Capability described by this provider. */
  description: string;
  /** Explicit read-only queries. */
  methods: readonly CordisInspectMethodManifest[];
}
/** Host broadcast requesting one live Client inspect result. */
interface CordisInspectQueryRequest {
  /** Correlation identity. */
  requestId: CordisInspectRequestId;
  /** Session whose model requested the query. */
  agentId: SessionId;
  /** Provider selected from the Client manifest. */
  provider: string;
  /** Method selected from the provider manifest. */
  method: string;
  /** JSON query input, omitted when the method has no fields. */
  input?: JsonValue;
}
/** Result sent from a Client provider to the waiting Host query. */
type CordisInspectQueryResolution = {
  ok: true;
  data: JsonValue;
} | {
  ok: false;
  reason: 'provider-missing' | 'method-missing' | 'invalid-input' | 'provider-error' | 'cancelled';
  message: string;
};
/** Notification that a Client inspect request can no longer be answered. */
interface CordisInspectQueryResolved {
  /** Query that left the pending state. */
  requestId: CordisInspectRequestId;
}
/** Whether a Client answer claimed the still-pending query. */
interface CordisInspectResolveAck {
  /** False for unknown, cancelled, stale, or late answers. */
  accepted: boolean;
}
/** Whether a package starts the current version or replaces it. */
type CordisDynamicRunMode = 'run' | 'update';
/** How a model-driven Client activation request left the pending state. */
type RequestRunOutcome = 'approved' | 'completed' | 'rejected' | 'cancelled' | 'failed';
/** Error fields preserved across the Host/Client transport. */
interface CordisErrorDetails {
  /** Original error message. */
  message: string;
  /** Original stack when the thrown value supplied one. */
  stack?: string;
}
/** Persisted state of the latest activation attempt. */
type CordisRunStatus = 'awaiting-approval' | 'starting-host' | 'client-pending' | 'running' | 'waiting' | 'rejected' | 'failed' | 'cancelled' | 'stopped';
/** One platform half within an activation attempt. */
interface CordisHalfState {
  /** Lifecycle state of this half. */
  status: 'absent' | 'pending' | 'stopped' | 'running' | 'waiting' | 'failed';
  /** Services still needed by a successfully created Fiber. */
  waitingFor: readonly string[];
  /** Failure text for this half. */
  error?: string;
}
/** Structured failure associated with an exact activation attempt. */
interface CordisRunDiagnostic {
  /** Stage that failed. */
  phase: 'approval' | 'host-load' | 'host-apply' | 'client-load' | 'client-apply' | 'client-render';
  /** Original failure text. */
  message: string;
  /** Original failure stack when available. */
  stack?: string;
  /** Stable Plugin identity. */
  pluginId: CordisDynamicPluginId;
  /** Immutable Package identity. */
  packageId: CordisDynamicPackageId;
  /** Exact attempt identity. */
  pluginRunId: CordisDynamicPluginRunId;
}
/** Latest activation attempt retained independently from the physical run. */
interface DynamicCordisRunAttempt {
  /** Exact attempt identity. */
  pluginRunId: CordisDynamicPluginRunId;
  /** Target Package. */
  packageId: CordisDynamicPackageId;
  /** Explicit run/update intent. */
  mode: CordisDynamicRunMode;
  /** Current attempt state. */
  status: CordisRunStatus;
  /** Pending Client activation request; it represents approval only when `requiresApproval` is true. */
  approvalRequestId?: ApprovalRequestId$1;
  /** Whether the pending Client activation requires a user decision. */
  requiresApproval?: boolean;
  /** Host-half state. */
  host: CordisHalfState;
  /** Client-half state. */
  client: CordisHalfState;
  /** Most recent failure. */
  error?: CordisRunDiagnostic;
}
/** One running package announced to browser pages. */
interface DynamicCordisPackage {
  /** Stable plugin instance. */
  pluginId: CordisDynamicPluginId;
  /** Immutable package version currently active. */
  packageId: CordisDynamicPackageId;
  /** This activation's identity. */
  pluginRunId: CordisDynamicPluginRunId;
  /** Package label. */
  name: string;
}
/** One pending model-driven Client activation forwarded to browser pages. */
interface DynamicCordisRunRequest {
  /** Correlation identity of the activation request. */
  requestId: ApprovalRequestId$1;
  /** Session whose plugin and tool call own the request. */
  agentId: SessionId;
  /** Stable plugin instance being acted on. */
  pluginId: CordisDynamicPluginId;
  /** Package version the request will activate. */
  packageId: CordisDynamicPackageId;
  /** Explicit lifecycle intent. */
  mode: CordisDynamicRunMode;
  /** Package label. */
  name: string;
  /** User-facing reason supplied at define time. */
  purpose: string;
  /** Whether a page must wait for an explicit user decision before activation. */
  requiresApproval: boolean;
}
/** One settled model-driven Client activation request broadcast to all pages. */
interface DynamicCordisRequestResolved {
  /** Request that left the pending state. */
  requestId: ApprovalRequestId$1;
  /** How the request settled. */
  outcome: RequestRunOutcome;
}
/** One activation withdrawn from every page. */
interface DynamicCordisRetracted {
  /** Stable plugin instance. */
  pluginId: CordisDynamicPluginId;
  /** Package version that was active. */
  packageId: CordisDynamicPackageId;
  /** Exact activation being withdrawn. */
  pluginRunId: CordisDynamicPluginRunId;
}
/** Package metadata exposed by the inventory without source code. */
interface DynamicCordisInventoryPackage {
  /** Immutable package version. */
  packageId: CordisDynamicPackageId;
  /** Package label. */
  name: string;
  /** User-facing purpose. */
  purpose: string;
  /** Whether this version contains Host code. */
  hasHostHalf: boolean;
  /** Whether this version contains Client code. */
  hasClientHalf: boolean;
}
/** One stable plugin row in the frame-wide inventory. */
interface DynamicCordisInventoryRow {
  /** Stable plugin instance. */
  pluginId: CordisDynamicPluginId;
  /** Session that owns this plugin. */
  agentId: SessionId;
  /** Immutable versions in define order. */
  packages: readonly DynamicCordisInventoryPackage[];
  /** Last package that completed activation successfully. */
  currentPackageId?: CordisDynamicPackageId;
  /** Package selected for a failed or in-progress transition. */
  nextPackageId?: CordisDynamicPackageId;
  /** Current activation, absent while stopped. */
  activeRun?: {
    pluginRunId: CordisDynamicPluginRunId;
    packageId: CordisDynamicPackageId;
  };
  /** Latest activation attempt, including pending approval and diagnostics. */
  latestRun?: DynamicCordisRunAttempt;
}
/** Answer to removing a plugin and all of its package versions. */
type DynamicCordisUndefineReceipt = {
  ok: true;
  wasRunning: boolean;
} | {
  ok: false;
  reason: 'plugin-missing';
  message: string;
};
/** One render failure observed after a Client half loaded. */
interface DynamicCordisRenderFailure {
  /** Slot whose component failed. */
  slot: string;
  /** Render failure text. */
  message: string;
  /** Original render failure stack when available. */
  stack?: string;
  /** Whether the failing contribution relinquished its slot. */
  abdicated: boolean;
}
/** Result shared by model-driven and panel-driven activation. */
type DynamicCordisRunResponse = {
  ok: true;
  /** Whether activation completed synchronously, is starting in a Client, or awaits user approval. */
  status: 'awaiting-approval' | 'starting' | 'running';
  pluginId: CordisDynamicPluginId;
  packageId: CordisDynamicPackageId;
  pluginRunId: CordisDynamicPluginRunId;
  /** Missing Host services; a parked Fiber is a successful activation. */
  waitingFor: readonly string[];
  /** Missing Client services reported by the approving page. */
  clientWaitingFor?: readonly string[];
  /** Last fully successful Package. */
  currentPackageId?: CordisDynamicPackageId;
  /** Selected transition target. */
  nextPackageId?: CordisDynamicPackageId;
  /** Explicit lifecycle intent. */
  mode: CordisDynamicRunMode;
} | {
  ok: false;
  reason: 'plugin-missing' | 'package-missing' | 'invalid-mode' | 'transition-in-flight' | 'host-half-failed' | 'client-half-failed' | 'rejected' | 'cancelled' | 'not-running';
  message: string;
  /** Original failure stack when available. */
  stack?: string;
};
/** Result of stopping a Plugin without deleting its Packages. */
type DynamicCordisStopResponse = {
  ok: true;
} | {
  ok: false;
  reason: 'plugin-missing' | 'not-running';
  message: string;
};
/** Result of bringing up the Host half before loading the Client half. */
type DynamicCordisHostHalfResult = {
  ok: true;
  pluginId: CordisDynamicPluginId;
  packageId: CordisDynamicPackageId;
  pluginRunId: CordisDynamicPluginRunId;
  waitingFor: readonly string[];
  /** False when a panel merely attaches this page to an already active run. */
  startedHere: boolean;
} | ({
  ok: false;
} & CordisErrorDetails);
/** Client-half source for one exact activation. */
interface DynamicCordisClientSource {
  /** Browser JavaScript body. */
  code: string;
  /** Package label. */
  name: string;
  /** Stable plugin instance. */
  pluginId: CordisDynamicPluginId;
  /** Immutable source version. */
  packageId: CordisDynamicPackageId;
  /** Exact activation the source belongs to. */
  pluginRunId: CordisDynamicPluginRunId;
}
/** Browser verdict used for both approved tool runs and panel runs. */
type DynamicCordisRunResolution = {
  ok: true;
  pluginRunId: CordisDynamicPluginRunId;
  waitingFor?: readonly string[];
} | {
  ok: false;
  reason: 'rejected' | 'host-half-failed' | 'client-half-failed';
  /** Activation that failed; absent for a refusal before activation. */
  pluginRunId?: CordisDynamicPluginRunId;
  /** Whether this page created the failed activation instead of attaching to it. */
  startedHere?: boolean;
  message?: string;
  stack?: string;
};
/** Whether a Client activation resolution reached the still-pending request. */
interface DynamicCordisResolveAck {
  /** False for late, unknown, or stale answers. */
  accepted: boolean;
}
/** Result of routing one Client call to the active Host half. */
type DynamicCordisInvokeResult = {
  ok: true;
  value: JsonValue;
} | ({
  ok: false;
  code: 'plugin-not-running' | 'stale-run' | 'method-not-found' | 'handler-error';
} & CordisErrorDetails);
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * A Client-bearing activation needs a browser page, and may require a user decision.
     * @param request - correlation identity, owner, target version, mode, and approval requirement.
     * @mode emit
     */
    'cordis/request-run'(request: DynamicCordisRunRequest): void;
    /**
     * A pending Client activation request left the answerable state.
     * @param resolved - request identity and outcome.
     * @mode emit
     */
    'cordis/request-run-resolved'(resolved: DynamicCordisRequestResolved): void;
    /**
     * One exact Plugin/Package activation is now live in the Host.
     * @param pkg - stable plugin, immutable package, run identity, and label.
     * @mode emit
     */
    'cordis/dynamic-package'(pkg: DynamicCordisPackage): void;
    /**
     * One exact activation was withdrawn.
     * @param retracted - plugin, package, and run identity.
     * @mode emit
     */
    'cordis/dynamic-retract'(retracted: DynamicCordisRetracted): void;
    /**
     * Request a live read-only query from the Client inspect registry.
     * @param request - correlation, Session, provider, method, and JSON input.
     * @mode emit
     */
    'cordis/inspect-query'(request: CordisInspectQueryRequest): void;
    /**
     * Notify every Client that an inspect query has settled or been cancelled.
     * @param resolved - exact query identity that is no longer answerable.
     * @mode emit
     */
    'cordis/inspect-query-resolved'(resolved: CordisInspectQueryResolved): void;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-credential_cb4e897fa6df50478cd9a096f850da93/node_modules/@deepseek-ai/dsh-credentials/lib/types/types.d.ts
/** Nominal reference to one credential: a POSIX-style environment-variable name. */
type CredentialRef = Branded<'CredentialRef'>;
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Committed change to a provider-managed credential source: a `set`, an
     * `unset`, or an external edit observed in storage. Ambient
     * process-environment changes are not observable and never emit. Listener
     * failures are contained and logged — a sync throw and an async rejection
     * alike — without changing the committed operation's outcome, except
     * `INVARIANT`-coded failures, which rethrow after every listener ran;
     * that rethrow reaches the emitter only from synchronous listeners, so
     * invariant checks on this event must not be async functions.
     * @param ref - the reference whose stored value changed.
     * @mode emit
     */
    'credentials/updated'(ref: CredentialRef): void;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-agent-pres_6b14f02c7140633c56994a10e58953ed/node_modules/@deepseek-ai/dsh-agent-presets/lib/types/types.d.ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * One session committed a different agent preset to its durable log.
     * Consumers invalidate only state derived from that session's composition.
     * @mode emit
     * @param sessionId - the session whose composition changed.
     * @param agentPreset - the preset recorded by the committed selection.
     */
    'agent-preset/selected'(sessionId: SessionId, agentPreset: string): void;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-settings@0_52495af71738a1095726249ceff4fd7b/node_modules/@deepseek-ai/dsh-settings/lib/types/types.d.ts
/** Nominal id of one registered settings namespace. */
type SettingsNamespace = Branded<'SettingsNamespace'>;
/** Origin of one committed settings change. */
type SettingsUpdateSource = 'update' | 'provider';
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Committed change to one registered namespace's resolved value. Emitted
     * after the provider persisted (for `update`) or published (`provider`)
     * the change; never emitted when the resolved value is deep-equal.
     * Listener failures are contained and logged — a sync throw and an async
     * rejection alike — except `INVARIANT`-coded failures, which rethrow
     * after every listener ran; that rethrow reaches the emitter only from
     * synchronous listeners, so invariant checks on this event must not be
     * async functions.
     * @param ns - the namespace whose resolved value changed.
     * @param next - the new resolved value.
     * @param prev - the previous resolved value.
     * @param source - whether the change entered through `update()` or the provider.
     * @mode emit
     */
    'settings/updated'(ns: SettingsNamespace, next: unknown, prev: unknown, source: SettingsUpdateSource): void;
    /**
     * One registered namespace's RAW user section changed, whether or not the
     * resolved value did. `settings/updated` is the consumer-facing event and
     * stays deep-equal-gated; this one exists for configuration surfaces,
     * which must learn that a field went from inherited to overridden (same
     * resolved value, different meaning) and that their held revision is
     * stale. Listener containment matches `settings/updated`.
     * @param ns - the namespace whose stored section changed.
     * @param revision - the namespace's new revision.
     * @mode emit
     */
    'settings/document-updated'(ns: SettingsNamespace, revision: number): void;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-session-pr_64a6b0602a631355cd8e96ecf58f6c70/node_modules/@deepseek-ai/dsh-session-projection/lib/types/types.d.ts
/**
 * Pure-type outlet of the session-projection Service Definition: the one projection type
 * table, importable from client aggregates without dragging the host-side
 * cordis Context merges of the package root (dsh-agent → dsh-session). Domain
 * packages may declare-merge through either the package root or this outlet —
 * re-export preserves symbol identity, so both land on the same table.
 *
 * @module @deepseek-ai/dsh-session-projection/types
 */
/**
 * The single projection type table for the whole chain (host provider, wire
 * block, client cell, React hook). Domain packages merge their key here via
 * declaration merging; values are wire-JSON whole values. How a value is
 * rendered is the slot system's business, never this layer's.
 */
interface SessionProjectionMap {}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/util.d.cts
type Primitive = string | number | symbol | bigint | boolean | null | undefined;
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/checks.d.cts
type $ZodStringFormats = "email" | "url" | "emoji" | "uuid" | "guid" | "nanoid" | "cuid" | "cuid2" | "ulid" | "xid" | "ksuid" | "datetime" | "date" | "time" | "duration" | "ipv4" | "ipv6" | "cidrv4" | "cidrv6" | "base64" | "base64url" | "json_string" | "e164" | "lowercase" | "uppercase" | "regex" | "jwt" | "starts_with" | "ends_with" | "includes";
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/errors.d.cts
interface $ZodIssueBase {
  readonly code?: string;
  readonly input?: unknown;
  readonly path: PropertyKey[];
  readonly message: string;
}
type $ZodInvalidTypeExpected = "string" | "number" | "int" | "boolean" | "bigint" | "symbol" | "undefined" | "null" | "never" | "void" | "date" | "array" | "object" | "tuple" | "record" | "map" | "set" | "file" | "nonoptional" | "nan" | "function" | (string & {});
interface $ZodIssueInvalidType<Input = unknown> extends $ZodIssueBase {
  readonly code: "invalid_type";
  readonly expected: $ZodInvalidTypeExpected;
  readonly input?: Input;
}
interface $ZodIssueTooBig<Input = unknown> extends $ZodIssueBase {
  readonly code: "too_big";
  readonly origin: "number" | "int" | "bigint" | "date" | "string" | "array" | "set" | "file" | (string & {});
  readonly maximum: number | bigint;
  readonly inclusive?: boolean;
  readonly exact?: boolean;
  readonly input?: Input;
}
interface $ZodIssueTooSmall<Input = unknown> extends $ZodIssueBase {
  readonly code: "too_small";
  readonly origin: "number" | "int" | "bigint" | "date" | "string" | "array" | "set" | "file" | (string & {});
  readonly minimum: number | bigint;
  /** True if the allowable range includes the minimum */
  readonly inclusive?: boolean;
  /** True if the allowed value is fixed (e.g.` z.length(5)`), not a range (`z.minLength(5)`) */
  readonly exact?: boolean;
  readonly input?: Input;
}
interface $ZodIssueInvalidStringFormat extends $ZodIssueBase {
  readonly code: "invalid_format";
  readonly format: $ZodStringFormats | (string & {});
  readonly pattern?: string;
  readonly input?: string;
}
interface $ZodIssueNotMultipleOf<Input extends number | bigint = number | bigint> extends $ZodIssueBase {
  readonly code: "not_multiple_of";
  readonly divisor: number;
  readonly input?: Input;
}
interface $ZodIssueUnrecognizedKeys extends $ZodIssueBase {
  readonly code: "unrecognized_keys";
  readonly keys: string[];
  readonly input?: Record<string, unknown>;
}
interface $ZodIssueInvalidUnionNoMatch extends $ZodIssueBase {
  readonly code: "invalid_union";
  readonly errors: $ZodIssue[][];
  readonly input?: unknown;
  readonly discriminator?: string | undefined;
  readonly options?: Primitive[];
  readonly inclusive?: true;
}
interface $ZodIssueInvalidUnionMultipleMatch extends $ZodIssueBase {
  readonly code: "invalid_union";
  readonly errors: [];
  readonly input?: unknown;
  readonly discriminator?: string | undefined;
  readonly inclusive: false;
}
type $ZodIssueInvalidUnion = $ZodIssueInvalidUnionNoMatch | $ZodIssueInvalidUnionMultipleMatch;
interface $ZodIssueInvalidKey<Input = unknown> extends $ZodIssueBase {
  readonly code: "invalid_key";
  readonly origin: "map" | "record";
  readonly issues: $ZodIssue[];
  readonly input?: Input;
}
interface $ZodIssueInvalidElement<Input = unknown> extends $ZodIssueBase {
  readonly code: "invalid_element";
  readonly origin: "map" | "set";
  readonly key: unknown;
  readonly issues: $ZodIssue[];
  readonly input?: Input;
}
interface $ZodIssueInvalidValue<Input = unknown> extends $ZodIssueBase {
  readonly code: "invalid_value";
  readonly values: Primitive[];
  readonly input?: Input;
}
interface $ZodIssueCustom extends $ZodIssueBase {
  readonly code: "custom";
  readonly params?: Record<string, any> | undefined;
  readonly input?: unknown;
}
type $ZodIssue = $ZodIssueInvalidType | $ZodIssueTooBig | $ZodIssueTooSmall | $ZodIssueInvalidStringFormat | $ZodIssueNotMultipleOf | $ZodIssueUnrecognizedKeys | $ZodIssueInvalidUnion | $ZodIssueInvalidKey | $ZodIssueInvalidElement | $ZodIssueInvalidValue | $ZodIssueCustom;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-apipr_b891559dbee45460f43aaa0af9f3f980/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/rpc.d.ts
type ZodIssue = $ZodIssue;
/**
 * Message correlation id: the initiator mints it on a request; a response
 * echoes the matching request's rpcId and never mints a new one.
 */
type RpcId = Branded<'rpc-id'>;
/**
 * Brands a string as RpcId (same precedent as core `SessionId()`). Minted by the initiator:
 * client-request → client mints; server-request → host mints (answerable frames get a stable
 * logical id, pure pushes mint a fresh one each time).
 * @param id - Raw id string (implementations mint UUIDs; tests may pass fixtures).
 * @returns The same string, branded (compile-time cast, zero runtime cost).
 */
declare function RpcId(id: string): RpcId;
/** Error code → details type map (a second table isomorphic to RpcMethodMap). New code = one row here + one branch in the error schema. */
interface RpcErrorDetailsMap {
  'bad-request': {
    issues: ZodIssue[];
  };
  'cancelled': {};
  'session-not-found': {
    sessionId: SessionId;
  };
  'model-unavailable': {
    provider: string;
    model: string;
  };
  'session-conflict': {
    sessionId: SessionId;
    requestedCwd: string;
    existingCwd?: string;
  };
  'invalid-time-zone': {
    value: string;
  };
  'workspace-attach-failed': {
    sessionId: SessionId;
    workspaceId: string;
  };
  'workspace-not-found': {
    workspaceId: string;
  };
  'workspace-invalid-path': {
    path: string;
  };
  'workspace-name-conflict': {
    name: string;
  };
  'workspace-move-invalid': {
    workspaceId: string;
    sessionId: SessionId;
    beforeSessionId?: SessionId;
  };
  'directory-unreadable': {
    path: string;
  };
  'directory-exists': {
    path: string;
  };
  'directory-create-failed': {
    path: string;
  };
  'directory-picker-unavailable': {
    capability: string;
  };
  'agent-preset-read-only': {
    agentPreset: string;
    reason: string;
  };
  'agent-preset-locked': {
    sessionId: SessionId;
    agentPreset: string;
  };
  'agent-preset-conflict': {
    sessionId: SessionId;
    requestedPreset: string;
    existingPreset?: string;
  };
  'agent-preset-not-found': {
    agentPreset: string;
    available: string[];
  };
  'agent-preset-invalid': {
    agentPreset: string;
    reason: string;
  };
  'agent-busy': {
    reason: string;
  };
  'attachment-error': {
    reason: string;
  };
  'queue-item-not-found': {
    itemId: MessageId;
  };
  'steer-unavailable': {
    itemId: MessageId;
  };
  /** A known slash command reported a usage/state error; the message is the command's own text. */
  'command-error': {};
  /** A leading-/ prompt named no registered command; the message names the token. */
  'unknown-command': {};
  /**
   * A settings write was refused (schema validation, unknown namespace,
   * read-only provider, or storage failure); the message is the seam's text.
   */
  'settings-rejected': {
    ns: string;
  };
  /**
   * A settings namespace exists in the seam but is outside the configuration
   * plane's model-provider boundary, so this proxy neither reads nor writes
   * it; the message names the namespace.
   */
  'settings-not-exposed': {
    ns: string;
  };
  /**
   * A settings write carried an `expectedRevision` the namespace has already
   * moved past: another writer (tab, editor, or an external file edit) landed
   * first. The details carry both revisions so a client can re-read and retry.
   */
  'settings-conflict': {
    ns: string;
    expected: number;
    actual: number;
  };
  /** A credential write was refused (read-only shadowing layer or storage failure); the message is the seam's own text. */
  'credential-rejected': {
    ref: string;
  };
  /**
   * Interrogating a draft provider endpoint did not produce a model listing:
   * no adapter family serves the namespace, the protocol has no listing this
   * build can read, or the endpoint was unreachable, refused the credential,
   * or answered with something else. The message is the adapter's own text —
   * it is what the form shows before falling back to hand-entry — and the
   * details name the endpoint asked, never the credential offered.
   */
  'model-discovery-failed': {
    settingsNs: string;
    baseURL?: string;
  };
  'title-invalid': {
    sessionId: SessionId;
  };
  'fork-unavailable': {
    sessionId: SessionId;
  };
  'subagent-parent-unavailable': {
    parentSessionId: SessionId;
  };
  'subagent-not-found': {
    parentSessionId: SessionId;
    childSessionId: SessionId;
  };
  'subagent-catalog-diagnostic': {
    parentSessionId: SessionId;
    childSessionId: SessionId;
    reason: 'corrupt' | 'unsupported' | 'unavailable';
  };
  'subagent-not-resumable': {
    childSessionId: SessionId;
  };
  'subagent-unauthorized': {
    childSessionId: SessionId;
  };
  'subagent-delivery-unavailable': {
    childSessionId: SessionId;
  };
  'internal': {};
}
/** Closed error-code union (the keys of RpcErrorDetailsMap). */
type RpcErrorCode = keyof RpcErrorDetailsMap;
/**
 * Distributive union expanded from the map: code is the discriminant, so
 * `switch (error.code)` narrows details. details is required (internal uses an explicit {}).
 */
type RpcError = { [C in RpcErrorCode]: {
  code: C;
  message: string;
  details: RpcErrorDetailsMap[C];
}; }[RpcErrorCode];
/** Business success/failure result: the result slot of a unary response; methods never throw business errors. */
type RpcResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: RpcError;
};
/** Response to a ServerRequest (wire carrier: POST /api/respond body); rpcId echoed, never minted anew. */
interface ClientResponse {
  type: 'client-response';
  rpcId: RpcId;
  result: RpcResult<unknown>;
}
/**
 * Carrier receipt (not an RpcMessage — it belongs to the carrier layer, same
 * discipline as "HTTP status describes only the carrier"): the HTTP response
 * body of the POST carrying a client-response. Late/duplicate responses yield not-pending.
 */
type RpcReceipt = {
  accepted: true;
} | {
  accepted: false;
  reason: 'not-pending' | 'bad-response';
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-user-quest_a3039a5be3cb503b5a072f54d8d7db3e/node_modules/@deepseek-ai/dsh-user-questions/lib/types/types.d.ts
/**
 * Wire-safe question and answer types, free of cordis/service imports so browser
 * type chains (apiproxy api → client) can consume them without loading this
 * package's Context augmentation.
 * @module @deepseek-ai/dsh-user-questions/types
 */
/** One selectable answer offered to the user. */
interface AskUserQuestionOption {
  /** User-facing label. */
  label: string;
  /** Optional extra context rendered by capable UIs. */
  description?: string;
}
/**
 * A caller-declared presentation intent: the question IS this kind of
 * decision, so a UI that recognises the tag may present it as such instead of as a
 * generic option list. Tagged so further intents can be added; a UI that does
 * not know a tag renders the generic flow, and the answer encoding is identical
 * either way — an intent changes presentation only, never the protocol.
 */
type AskUserQuestionIntent = {
  /** A plan submitted for review: `detail` is the plan markdown `ask()` requires, and the decision approves or declines it. */
  kind: 'plan-review';
  /**
   * The option label that approves the plan; every other option declines it.
   * Named rather than positional so no UI infers the verdict from option order.
   * An `approve` naming no option of its own question is rejected at `ask()`.
   */
  approve: string;
};
/** One question in a user-questions request. */
interface AskUserQuestionItem {
  /** Stable caller-provided question id, echoed in the answer. */
  id: string;
  /** The question to display. */
  question: string;
  /** Optional supporting detail rendered with the question but kept out of option labels. */
  detail?: string;
  /** Optional short heading/group label. */
  header?: string;
  /** Optional choices the UI can render as a menu. */
  options?: AskUserQuestionOption[];
  /** Whether more than one option may be selected. Defaults to single-select. */
  multiSelect?: boolean;
  /** Optional presentation intent for capable UIs; absent asks for the generic option list. */
  intent?: AskUserQuestionIntent;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-user-appro_1994f8854c07790d38957480021e64d6/node_modules/@deepseek-ai/dsh-user-approval/lib/types/types.d.ts
/**
 * Pairs one `approval/asked` audit event with its `approval/decided`.
 * Service-issued (one fresh id per {@link ApprovalService.request} call).
 */
type ApprovalRequestId = Branded<'ApprovalRequestId'>;
/**
 * Brand a string as an {@link ApprovalRequestId}.
 * @param id - the raw id string to brand.
 * @returns the same string carrying the brand.
 */
declare function ApprovalRequestId(id: string): ApprovalRequestId;
/**
 * Closed approval outcomes: a one-shot grant, explicit rejection, withdrawn
 * request, or unavailable answerer. Callers fail closed on `unavailable`.
 */
type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable';
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-tools@0.1._d489cb013f2a8725198f1fce9da6f626/node_modules/@deepseek-ai/dsh-tools/lib/types/presentation.d.ts
/**
 * Category of a tool call, used by a UI to pick an icon or treatment. The
 * provider-neutral vocabulary lets tools describe themselves without depending
 * on a particular client; `other` is the default.
 */
type ToolCallKind = 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'fetch' | 'other';
/**
 * A file location a tool reads or modifies, so a capable UI can "follow along" —
 * highlight or jump to the file (and line) as the tool runs. `path` is what the
 * tool operated on (the model-facing path); `line` is an optional 1-based line
 * to focus (e.g. a read's offset).
 */
interface FileLocation {
  path: string;
  line?: number;
}
/**
 * A single-file change a tool is about to make, for a UI that renders inline
 * diffs. `oldText` is `null` for a new-file create (nothing to diff against);
 * an overwrite also uses `null`, because a call-time presenter has no access to
 * the file's prior content.
 */
interface FileDiff {
  path: string;
  /** Prior content, or `null` for a new file / an overwrite (no prior content available at call time). */
  oldText: string | null;
  /** Content after the change. */
  newText: string;
}
/**
 * Provider-neutral pending-call presentation. Tools declare one tagged intent;
 * UI bridges map it without special-casing tool names.
 */
type ToolCallView = GenericCallView | TerminalCallView | DiffCallView;
/**
 * The default card: a titled tool-call row with an optional category icon, a
 * salient raw input, extra content blocks, and follow-along file locations. Any
 * tool whose call is not a terminal or a diff uses this.
 */
interface GenericCallView {
  card: 'generic';
  /**
   * Human-readable, always-visible label describing what THIS call does. Keep it
   * short — a UI shows it as a card header / log line.
   */
  title: string;
  /** Category for icon/treatment; defaults to `other` when omitted. */
  kind?: ToolCallKind;
  /**
   * The salient input to show in a detail/expanded view (e.g. a background
   * job id). Omit to show nothing; a string renders as-is, an object as pretty
   * JSON. NOT the full raw args object unless that is genuinely what a reader wants.
   */
  rawInput?: unknown;
  /**
   * UI-facing content blocks to show on the pending call alongside the title.
   * Omit to show none. A UI maps these to its own content blocks.
   */
  content?: ContentBlock[];
  /** Files this call reads/modifies, for editor follow-along. Omit for a call that touches no file. */
  locations?: FileLocation[];
}
/**
 * A call that IS a shell command running in a working directory: a capable UI
 * renders it as a terminal card (cwd-headed, with the command as the title and
 * live/afterward output from the {@link TerminalResultView}); an incapable UI
 * falls back to a generic card whose body is the fenced command output. Set by a
 * tool whose call is a foreground command (e.g. `bash`).
 */
interface TerminalCallView {
  card: 'terminal';
  /** The command, shown as the terminal card's title / header line. */
  title: string;
  /**
   * A human-readable one-line summary of what the command does, rendered ABOVE
   * the terminal card (the card itself has no description slot). Omit for none.
   */
  description?: string;
  /**
   * Working directory the command runs in, shown as the terminal header. An
   * ABSOLUTE path is used as-is; a RELATIVE path is resolved by the UI bridge
   * against the session workspace (the pure presenter can't see the session cwd).
   * Omit entirely to let the bridge use the session workspace.
   */
  cwd?: string;
}
/**
 * A call that creates or modifies files, rendered as an inline diff card by a
 * capable UI. Set by a tool whose call writes/edits a file (e.g. `write`,
 * `edit`). The diffs are derived from the call ARGUMENTS (a create's `oldText` is
 * `null`); the tool emits a separate {@link DiffResultView} after `execute` — the
 * applied change (an edit/overwrite hunk with context, or a whole-file diff for a
 * create).
 */
interface DiffCallView {
  card: 'diff';
  /** Card header (e.g. `Write foo.txt`). */
  title: string;
  /** One entry per file the call changes. */
  diffs: FileDiff[];
  /** Files this call modifies, for editor follow-along (usually the diffs' paths). */
  locations?: FileLocation[];
}
/**
 * One numbered line of a file, the unit a {@link ReadResultView} carries so a
 * capable UI can render a syntax-highlighted, line-numbered code view. `number`
 * is the 1-based line number in the file (a window past `offset` keeps the file's
 * own numbering, not a 1-based re-count); `text` is the line without its trailing
 * newline, already truncated to the read tool's per-line cap.
 */
interface ReadFileLine {
  number: number;
  text: string;
}
/**
 * How a tool wants the COMPLETED call shown — the *result* state, after `execute`
 * returns. A `card`-tagged union mirroring {@link ToolCallView}: a UI switches on
 * `card`. Lets the tool reformat its result for a UI distinctly from the
 * model-facing text it returned from `execute`. Returned by
 * `ToolDefinition.presentResult`; omitting the method keeps the pending
 * title and renders the raw result content.
 */
type ToolResultView = GenericResultView | TerminalResultView | DiffResultView | SearchResultView | ReadResultView | WebResultView;
/**
 * The default completed card: an optional replacement title and reformatted
 * content. Omit a field to keep the pending title / render the raw result content.
 */
interface GenericResultView {
  card: 'generic';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /**
   * UI-facing result content (harness {@link ContentBlock}s), reformatted from
   * the model-facing result. Omit to let the UI render the raw result content.
   */
  content?: ContentBlock[];
}
/**
 * The completed state of a {@link TerminalCallView}: the captured output and exit
 * status. A capable UI renders `output` in the terminal card and shows an
 * exit-status pill; an incapable UI gets a fenced ```console fallback the BRIDGE
 * derives from `output` (the tool does not double-encode it).
 */
interface TerminalResultView {
  card: 'terminal';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** Captured command output (stdout+stderr as the tool chooses to combine them). */
  output?: string;
  /**
   * Process exit code, when the run ended by exiting (not a signal). Lets a
   * capable UI show an exit-status pill. Omit when killed by a signal or unknown.
   */
  exitCode?: number;
  /** Signal name that killed the process (e.g. `SIGTERM`). Mutually exclusive with `exitCode`. */
  signal?: string;
}
/**
 * A completed file mutation rendered as an inline diff card, the result-time
 * analogue of {@link DiffCallView}. Because a completed UI update replaces the
 * pending card content, mutation tools return this even when it repeats the
 * call-time diff; otherwise raw result text would replace the diff.
 */
interface DiffResultView {
  card: 'diff';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The change to show, in file order — applied contextual hunks, or a whole-file diff when there is no before-image. */
  diffs: FileDiff[];
}
/** One matched line inside a {@link SearchFileMatches} group: its 1-based line number and text. */
interface SearchLineMatch {
  /** 1-based line number of the match within its file. */
  lineNumber: number;
  /** The matched line text, as the tool surfaced it (the per-line preview budget already applied). */
  line: string;
}
/** One file's grouped content matches for a {@link SearchMatchesResultView}, in first-seen file order. */
interface SearchFileMatches {
  /** The file the matches belong to (the model-facing display path). */
  path: string;
  /** The file's matched lines, in output order. */
  matches: SearchLineMatch[];
}
/**
 * A completed content search (`grep`) rendered as a search card whose matches are
 * grouped by file, so a capable UI can list each file as an expandable group of
 * its matched lines. `shape: 'matches'` discriminates this variant from the path
 * variant ({@link SearchPathsResultView}) within {@link SearchResultView}. The
 * discriminant is `shape`, not `kind`, so it never collides with the
 * {@link ToolCallKind} `kind` an icon-picking bridge reads off a call view.
 */
interface SearchMatchesResultView {
  card: 'search';
  shape: 'matches';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** Matched lines grouped by file, in first-seen file order. */
  files: SearchFileMatches[];
  /**
   * Whether the tool capped the inline result: `files` carries only the retained
   * matches, not every match the search found. A UI shows a capped indicator so it
   * never presents a partial group as complete.
   */
  truncated: boolean;
  /** Total matches the search found before capping (equals the retained count when not `truncated`). */
  total: number;
}
/**
 * A completed path search (`glob`) rendered as a search card whose result is a flat
 * path list. `shape: 'paths'` discriminates this variant from the grouped-matches
 * variant ({@link SearchMatchesResultView}) within {@link SearchResultView}.
 */
interface SearchPathsResultView {
  card: 'search';
  shape: 'paths';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The discovered paths, in the tool's result order (the retained page when `truncated`). */
  paths: string[];
  /**
   * Whether the tool capped the inline result: `paths` carries only the retained
   * page, not every path the search found. A UI shows a capped indicator so it
   * never presents a partial list as complete.
   */
  truncated: boolean;
  /** Total paths the search found before capping (equals `paths.length` when not `truncated`). */
  total: number;
}
/**
 * A completed search rendered as a search card, the result-time view a discovery
 * tool (`grep`, `glob`) returns from `presentResult`. One `card: 'search'` view
 * with two `shape`-discriminated variants: grouped-by-file content matches
 * ({@link SearchMatchesResultView}) and a flat path list
 * ({@link SearchPathsResultView}). Both carry a `truncated`/`total` signal so a UI
 * never presents a capped result as complete. The view carries no result text: a
 * UI without a search card falls back to the raw `tool/result` content. There is
 * no call-time analogue: a search call stays a {@link GenericCallView}
 * (`kind: 'search'`) because the pending state has no matches or paths to show —
 * the structured shape exists only after `execute`.
 */
type SearchResultView = SearchMatchesResultView | SearchPathsResultView;
/**
 * A completed file read rendered as a line-numbered, optionally syntax-highlighted
 * code view by a capable UI. Set by a tool whose call reads file text (e.g.
 * `read`); the pending state stays a {@link GenericCallView} (`kind: 'read'`)
 * because a call carries no content until `execute` returns. The structured
 * `lines`/`path`/`lang`/`totalLines` fields cannot be reconstructed from the
 * model-facing result text alone, so the read tool projects them through its
 * `output.presentationMeta` (persisted with the session log) and `presentResult`
 * narrows that metadata back into this view on live and replay paths alike. A UI
 * without the read capability falls back to `content` (the model-facing text with
 * its envelope stripped), so this view degrades to the generic text card.
 */
interface ReadResultView {
  card: 'read';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The read file's path (the model-facing path; the bridge relativizes it). */
  path: string;
  /**
   * The 1-based first line the window requested, preserved even when `lines` is
   * empty (a byte cap below the first selected line yields an empty window) so a
   * UI knows where the window starts and where a continuation resumes.
   */
  offset: number;
  /** The returned window's lines, in file order, each keeping its file line number. */
  lines: ReadFileLine[];
  /** Exact total line count in the file, so a UI can show a "showing N of M" affordance. */
  totalLines: number;
  /**
   * A syntax-highlighting language hint derived from the file extension (e.g.
   * `ts`, `py`), or omitted when the extension maps to no known language so a UI
   * renders the lines as plain text.
   */
  lang?: string;
  /**
   * The model-facing result content with its envelope stripped, for a UI without
   * the read capability. Omit to let such a UI render the raw result content.
   */
  content?: ContentBlock[];
}
/**
 * One citeable source in a completed {@link WebSearchResultView}, the faithful
 * projection of one web-search source. The presentation projection of `dsh-web`'s
 * `WebSearchSource`: that Service Definition type is authoritative (core cannot depend
 * on the web Service Definition, so the two are declared separately and MUST evolve together).
 * A web tool projects this shape through `output.presentationMeta` because the
 * render text cannot losslessly carry it (see the web-result-card Agent Note); its
 * `presentResult` reads it back.
 */
interface WebSource {
  /** The source URL. */
  url: string;
  /** The source title, when the provider returned one. */
  title?: string;
  /** A short excerpt or summary, when the provider returned one. */
  snippet?: string;
  /** Publication/crawl timestamp as a provider-supplied ISO-8601 string, when present. */
  publishedAt?: string;
}
/**
 * A completed web retrieval rendered as a structured card by a capable UI. Set
 * by a web tool whose call retrieves from the web (`web_search`, `web_fetch`).
 * One `kind`-tagged union carries both shapes because both are web retrieval and
 * a UI renders them with one component family; a UI switches on `kind`. An
 * incapable UI falls back to the raw `tool/result` content (this view carries no
 * `content` copy — see the web-result-card Agent Note). This is the result-time
 * analogue of the `web_search`/`web_fetch` calls' generic call views
 * (`kind: 'search'`/`'fetch'`); those tools keep their generic pending card and
 * add only this completed card.
 *
 * The `kind` field here is this union's own discriminant, NOT a
 * {@link ToolCallKind}: the two values deliberately match the tools' pending
 * `ToolCallKind` (`'search'`/`'fetch'`) so a call and its result read as one
 * category, but a new arm is a union edit plus a consumer branch, not any
 * arbitrary `ToolCallKind` value.
 */
type WebResultView = WebSearchResultView | WebFetchResultView;
/**
 * The completed state of a `web_search` call: the structured sources the model
 * cited, an optional provider answer, and whether the source list was cut to the
 * result cap. A capable UI renders the sources as a citation list; a UI without
 * the `web` capability falls back to the raw `tool/result` content.
 */
interface WebSearchResultView {
  card: 'web';
  kind: 'search';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The faithful, structured sources — the field render text cannot losslessly carry. */
  sources: WebSource[];
  /** The provider-generated answer text, when any. */
  answer?: string;
  /** True when the web service cut the source list to honor the result cap. */
  truncated: boolean;
}
/**
 * The completed state of a `web_fetch` call: the fetched URL, its HTTP status,
 * and whether the content was cut. The body itself is already markdown in the
 * raw `tool/result` content, so this card carries only the retrieval summary and
 * a UI without the `web` capability falls back to that content.
 */
interface WebFetchResultView {
  card: 'web';
  kind: 'fetch';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The final URL after allowed redirects. */
  url: string;
  /** HTTP status code of the fetched response. */
  statusCode: number;
  /**
   * True when the provider capped the decoded body, or the output cap or a
   * pre-conversion source cut trimmed the rendered text (the effective
   * truncation the model-facing text also reflects).
   */
  truncated: boolean;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-jobs@0.1.0_12c564ff6efdb2c2a5dc8f402d25078d/node_modules/@deepseek-ai/dsh-jobs/lib/types/brand.d.ts
/**
 * Identifies a background job. The registry generates `<kind>-N`; predictable
 * ids rely on owner authorization rather than secrecy.
 */
type JobId = Branded<'JobId'>;
/**
 * Brand a string as a {@link JobId}.
 * @param id - the raw job-id string (the registry generates `<kind>-N`).
 * @returns the same string, branded; no validation is performed.
 */
declare function JobId(id: string): JobId;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-apipr_b891559dbee45460f43aaa0af9f3f980/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/jobs.d.ts
/**
 * One background job as the client sees it.
 *
 * Three registry fields are deliberately absent. `ownerSession` is redundant
 * beside the frame's own `sessionId`; `reported` is an internal notice-delivery
 * bit with no user meaning; `outputLimitBytes` is producer-owned model
 * presentation policy that never reaches a human surface.
 */
interface JobView {
  /** Registry-issued `<kind>-N` identity, stable for the task's whole life. */
  id: JobId;
  /**
   * Producer kind (`bash`, `pwsh`, `pty-send`, `subagent`, …). Kept as a bare
   * string because producer plugins extend the kind map by declaration merging,
   * so no client build can enumerate the closed set.
   */
  kind: string;
  /** Producer-supplied one-line label: the command, or the delegation description. */
  label: string;
  /** Current lifecycle state. */
  status: 'running' | 'stopping' | 'completed' | 'killed' | 'failed';
  /** Kind-specific status detail ('exit code: 3'), present once the producer supplied one. */
  detail?: string;
  /** Epoch ms when the task was registered. */
  startedAt: number;
  /** Epoch ms when the task settled; absent while live. */
  finishedAt?: number;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-apipr_b891559dbee45460f43aaa0af9f3f980/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/workspace.d.ts
/**
 * Wire-side workspace id brand. Deliberately re-declared here rather than
 * imported from dsh-workspace: api/ must stay browser-importable with zero
 * host-package dependencies, and the brand string matches, so both sides
 * agree structurally.
 */
type WorkspaceId = Branded<'WorkspaceId'>;
/** One workspace row: the record projection every workspace.* value carries. */
interface WorkspaceView {
  workspaceId: WorkspaceId;
  /** Canonical directory path (host-side realpath canon). */
  path: string;
  /** Display title (defaults to the path basename at create). */
  title: string;
  /**
   * Sessions accounted under this workspace, in manually owned order
   * (attach prepends, insertSessionBefore reorders; activity never does).
   */
  sessionIds: SessionId[];
  /** ISO-8601 creation instant. */
  createdAt: string;
  /** ISO-8601 last-mutation instant. */
  updatedAt: string;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-apipr_b891559dbee45460f43aaa0af9f3f980/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/events.d.ts
/**
 * Host-computed render intent accompanying a `tool/call` or `tool/result`
 * event. A pure derivation of args/result through the presenter registered at
 * emission time — never persisted (the session log carries only the event), so
 * the same event may carry a different view (or none) on a later delivery.
 * `for` names which vocabulary applies without re-inspecting the event type.
 * An absent view means the client's documented default (generic JSON card).
 */
type ToolEventView = {
  for: 'call';
  view: ToolCallView;
} | {
  for: 'result';
  view: ToolResultView;
};
/** One pending inbox occurrence in the authoritative `session/queue` snapshot. */
interface QueuedInboxItem {
  /** Message identity used by inbox mutations. */
  id: MessageId;
  /** Agent-resolved FIFO placement; queued and steering items render on different surfaces, context items stay invisible until claimed. */
  placement: 'queued' | 'steering' | 'context';
  /** Complete pending message; it is not durable until the Agent claims it. */
  message: Message;
}
/**
 * Mux stream frames: raw session-event passthrough + control frames +
 * approval/question frames (requested = answerable server-request, the rest are pure pushes).
 */
type MuxFrame = {
  type: 'session/event';
  sessionId: SessionId;
  event: SessionEvent;
  view?: ToolEventView;
} | {
  type: 'session/subscribed';
  sessionId: SessionId;
  lastSeq: number;
} | {
  type: 'approval/requested';
  sessionId: SessionId;
  approvalId: ApprovalRequestId;
  toolName: string;
  callId?: CallId;
  reason?: string;
} | {
  type: 'approval/resolved';
  sessionId: SessionId;
  approvalId: ApprovalRequestId;
  outcome: ApprovalOutcome;
} | {
  type: 'question/requested';
  sessionId: SessionId;
  questions: AskUserQuestionItem[];
} | {
  type: 'question/resolved';
  sessionId: SessionId;
  questionRpcId: RpcId;
  outcome: 'answered' | 'cancelled';
} |
/**
 * Complete transient inbox state after every enqueue, mutation, claim, or
 * discard. Pending work is not model-visible and therefore has no durable
 * session event; the whole snapshot makes edit, deletion, cancel, and
 * reconnect converge through one authoritative signal. `session/queue`
 * covers both resolved placements: queued items render
 * in QueueDock, while pending steering renders at the conversation tail.
 */
{
  type: 'session/queue';
  sessionId: SessionId;
  items: QueuedInboxItem[];
} |
/**
 * Complete set of background jobs this session can see, after every registry
 * commit that changes it: registration, the stopping transition, settlement,
 * and owner-disposal removal. The registry is process-local and holds no
 * durable event, so — exactly like `session/queue` — the whole snapshot is
 * what makes a start, a kill, a reconnect, and a second tab converge on one
 * authoritative value.
 *
 * Sent as a subscription baseline only for a session that currently has
 * tasks; an absent key means an empty set. A change that empties the set
 * still sends `[]`, since that transition is the only one absence cannot
 * express.
 */
{
  type: 'session/jobs';
  sessionId: SessionId;
  jobs: JobView[];
} |
/**
 * One projection unit's finished value changed (session-projection RFC).
 * Live push state, never logged — replay recomputes on the host (the
 * tool-view posture). `value` is the unit's schema-validated view output;
 * `seq` is the unit's watermark at emission. Clients keep one generic
 * per-session value store under higher-seq-wins, seeded by the history
 * tail page's projections block.
 */
{
  type: 'session/projection';
  sessionId: SessionId;
  key: string;
  value: unknown;
  seq: number;
} | {
  type: 'stream/error';
  error: RpcError;
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-apipr_b891559dbee45460f43aaa0af9f3f980/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/sessions.d.ts
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * Session-list hints persisted by the projection cache. `blank: false`
     * is monotonic and may suppress a cold-log probe; `blank: true` is only a
     * checkpoint-prefix fact and must not hide a cold Session without direct
     * verification. `lastPromptAt` is the latest human-authored prompt time.
     */
    sessionListMetadata: SessionListMetadata;
    /**
     * The deployment's image-intake limits: the attachments service's config
     * as this proxy enforces it at prompt admission, constant per host boot.
     * Clients pre-check count and bytes at intake and show the limits in
     * upload affordances. Key absence means no attachment service is
     * composed — clients skip the pre-check and let the host answer.
     */
    imageLimits: ImageAttachmentLimits;
  }
}
/** Persisted hints used to summarize a cold Session without reading a large log. */
interface SessionListMetadata {
  /** Whether the checkpoint prefix contains no turn/start event. */
  blank: boolean;
  /** Latest source.kind=user message time in the checkpoint prefix. */
  lastPromptAt: number | null;
}
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /**
     * The prompt's rpcId is passed through MessageSource into the `user/message` event
     * (the client uses it to reconcile the optimistically
     * echoed provisional message with the event stream). kind stays `'user'` — the model face
     * carries no transport vocabulary; rpcId and the optional Host-validated browser zone are
     * durable JSON fields passed back to the client with the event.
     */
    'user-rpc': {
      kind: 'user';
      rpcId: RpcId;
      clientTimeZone?: string;
    };
  }
}
/** Browser-submitted prompt content; the host promotes image bytes to durable references. */
type PromptContentPart = {
  type: 'text';
  text: string;
} | {
  type: 'image';
  mediaType: ImageMediaType;
  data: string;
  name?: string;
};
/** A client-requested mutation of one still-pending queue item. */
type QueueAction = {
  kind: 'edit';
  content: ContentBlock[];
} | {
  kind: 'remove';
} | {
  kind: 'steer';
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-apipr_b891559dbee45460f43aaa0af9f3f980/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/host.d.ts
/** One directory row of a listing: a child entry or a breadcrumb ancestor. */
interface DirectoryEntry {
  /** Base name shown in a browser row (a root crumb carries its full path). */
  name: string;
  /** Absolute host path — the client never joins path segments itself. */
  path: string;
  /** Hidden by the host platform's convention (dot-prefixed on POSIX); the client owns whether to show it. */
  hidden: boolean;
}
/** host.listDirectory response value: one directory level plus its ancestry. */
interface DirectoryListing {
  /** Absolute path of the listed directory. */
  path: string;
  /** The host account's home directory (breadcrumb "Home" rooting). */
  home: string;
  /**
   * Ancestor chain from the filesystem root to the listed directory
   * inclusive; every crumb is a jump target (crumb `hidden` is always false).
   */
  crumbs: DirectoryEntry[];
  /** Direct child directories, name-sorted; symlinks to directories included. */
  entries: DirectoryEntry[];
  /** True when the backend cut `entries` at its complete-result bound (the name-sorted tail is absent). */
  truncated: boolean;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-host-apipr_b891559dbee45460f43aaa0af9f3f980/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/subagents.d.ts
/** Complete durable direct-child catalog row. */
type SubagentListEntry = {
  kind: 'child';
  id: SessionId;
  /** Whether the child Agent driver is running at the Host sampling boundary. */
  activity: 'running' | 'inactive';
  /** Whether a direct descendant has durable `origin: 'subagent'`. */
  hasChildren: boolean;
} & ({
  mode: 'one-shot';
  label?: string;
} | {
  mode: 'continuable';
  label: string;
}) | {
  kind: 'diagnostic';
  id: SessionId;
  reason: 'corrupt' | 'unsupported' | 'unavailable';
};
/** Durable parent/child address that selects subagent transport in the client. */
type SubagentAddress = {
  parentSessionId: SessionId;
  childSessionId: SessionId;
} & ({
  mode: 'one-shot';
} | {
  mode: 'continuable';
});
/** Complete direct-child catalog plus the delivery-time parent availability hint. */
interface SubagentCatalog {
  entries: SubagentListEntry[];
  parentAvailable: boolean;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-api-gatewa_0d2edb4cc38849dcd7ccf011b7f8322f/node_modules/@deepseek-ai/dsh-api-gateway/lib/types/client/index.d.ts
/** Typed Remote service augmented by generated direct namespaces. */
type ClientRemote = TypertClientRemote;
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Generated Remote namespaces selected by the Client assembly. */
    remote: ClientRemote;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-cordis-hos_7a0ffda0d46a1fe34c66cb5287df31d2/node_modules/@deepseek-ai/dsh-cordis-host-runner/lib/typert.remote-client.d.ts
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$64796e616d6963436f7264697352756e6e6572 {
    getClientCode: (agentId: SessionId, pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId) => Promise<RemoteResult<DynamicCordisClientSource>>;
    inventory: () => Promise<RemoteResult<DynamicCordisInventoryRow[]>>;
    invoke: (pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, method: string, args: JsonValue) => Promise<RemoteResult<DynamicCordisInvokeResult>>;
    reportClientGuardFailure: (agentId: SessionId, pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, failure: CordisErrorDetails) => Promise<RemoteResult<null>>;
    reportRenderFailure: (agentId: SessionId, pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, failure: DynamicCordisRenderFailure) => Promise<RemoteResult<null>>;
    resolveInspectQuery: (agentId: SessionId, requestId: CordisInspectRequestId, resolution: CordisInspectQueryResolution) => Promise<RemoteResult<CordisInspectResolveAck>>;
    resolveRequestRun: (requestId: ApprovalRequestId$1, resolution: DynamicCordisRunResolution) => Promise<RemoteResult<DynamicCordisResolveAck>>;
    runHostHalf: (agentId: SessionId, pluginId: CordisDynamicPluginId, packageId: CordisDynamicPackageId, mode: CordisDynamicRunMode, requestId: ApprovalRequestId$1 | null, approveFutureVersions: boolean) => Promise<RemoteResult<DynamicCordisHostHalfResult>>;
    settleUserRun: (agentId: SessionId, pluginId: CordisDynamicPluginId, resolution: DynamicCordisRunResolution) => Promise<RemoteResult<DynamicCordisRunResponse>>;
    stopFromPanel: (agentId: SessionId, pluginId: CordisDynamicPluginId) => Promise<RemoteResult<DynamicCordisStopResponse>>;
    syncInspectManifest: (providers: readonly CordisInspectProviderManifest[]) => Promise<RemoteResult<null>>;
    undefineFromPanel: (agentId: SessionId, pluginId: CordisDynamicPluginId) => Promise<RemoteResult<DynamicCordisUndefineReceipt>>;
  }
  interface TypertRemoteMap {
    'dynamicCordisRunner/getClientCode': (agentId: SessionId, pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId) => Promise<RemoteResult<DynamicCordisClientSource>>;
    'dynamicCordisRunner/inventory': () => Promise<RemoteResult<DynamicCordisInventoryRow[]>>;
    'dynamicCordisRunner/invoke': (pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, method: string, args: JsonValue) => Promise<RemoteResult<DynamicCordisInvokeResult>>;
    'dynamicCordisRunner/reportClientGuardFailure': (agentId: SessionId, pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, failure: CordisErrorDetails) => Promise<RemoteResult<null>>;
    'dynamicCordisRunner/reportRenderFailure': (agentId: SessionId, pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, failure: DynamicCordisRenderFailure) => Promise<RemoteResult<null>>;
    'dynamicCordisRunner/resolveInspectQuery': (agentId: SessionId, requestId: CordisInspectRequestId, resolution: CordisInspectQueryResolution) => Promise<RemoteResult<CordisInspectResolveAck>>;
    'dynamicCordisRunner/resolveRequestRun': (requestId: ApprovalRequestId$1, resolution: DynamicCordisRunResolution) => Promise<RemoteResult<DynamicCordisResolveAck>>;
    'dynamicCordisRunner/runHostHalf': (agentId: SessionId, pluginId: CordisDynamicPluginId, packageId: CordisDynamicPackageId, mode: CordisDynamicRunMode, requestId: ApprovalRequestId$1 | null, approveFutureVersions: boolean) => Promise<RemoteResult<DynamicCordisHostHalfResult>>;
    'dynamicCordisRunner/settleUserRun': (agentId: SessionId, pluginId: CordisDynamicPluginId, resolution: DynamicCordisRunResolution) => Promise<RemoteResult<DynamicCordisRunResponse>>;
    'dynamicCordisRunner/stopFromPanel': (agentId: SessionId, pluginId: CordisDynamicPluginId) => Promise<RemoteResult<DynamicCordisStopResponse>>;
    'dynamicCordisRunner/syncInspectManifest': (providers: readonly CordisInspectProviderManifest[]) => Promise<RemoteResult<null>>;
    'dynamicCordisRunner/undefineFromPanel': (agentId: SessionId, pluginId: CordisDynamicPluginId) => Promise<RemoteResult<DynamicCordisUndefineReceipt>>;
  }
  interface TypertRemoteNamespaceMap {
    'dynamicCordisRunner': TypertRemoteNamespace$64796e616d6963436f7264697352756e6e6572;
  }
  interface TypertRemoteScopeMap {
    'agent:dynamicCordisRunner/getClientCode': (pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId) => Promise<RemoteResult<DynamicCordisClientSource>>;
    'agent:dynamicCordisRunner/reportClientGuardFailure': (pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, failure: CordisErrorDetails) => Promise<RemoteResult<null>>;
    'agent:dynamicCordisRunner/reportRenderFailure': (pluginId: CordisDynamicPluginId, pluginRunId: CordisDynamicPluginRunId, failure: DynamicCordisRenderFailure) => Promise<RemoteResult<null>>;
    'agent:dynamicCordisRunner/resolveInspectQuery': (requestId: CordisInspectRequestId, resolution: CordisInspectQueryResolution) => Promise<RemoteResult<CordisInspectResolveAck>>;
    'agent:dynamicCordisRunner/runHostHalf': (pluginId: CordisDynamicPluginId, packageId: CordisDynamicPackageId, mode: CordisDynamicRunMode, requestId: ApprovalRequestId$1 | null, approveFutureVersions: boolean) => Promise<RemoteResult<DynamicCordisHostHalfResult>>;
    'agent:dynamicCordisRunner/settleUserRun': (pluginId: CordisDynamicPluginId, resolution: DynamicCordisRunResolution) => Promise<RemoteResult<DynamicCordisRunResponse>>;
    'agent:dynamicCordisRunner/stopFromPanel': (pluginId: CordisDynamicPluginId) => Promise<RemoteResult<DynamicCordisStopResponse>>;
    'agent:dynamicCordisRunner/undefineFromPanel': (pluginId: CordisDynamicPluginId) => Promise<RemoteResult<DynamicCordisUndefineReceipt>>;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-api-remote_fef884e73d55fcfa32172daa083f28db/node_modules/@deepseek-ai/dsh-api-remotes/lib/types/client/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Generated Remote namespaces selected by this Client assembly. */
    remote: TypertClientRemote;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-ui-_c8f9ee8e788c2abebc8a1bdbe0720c92/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/renderer.d.ts
/**
 * The locale face the render machinery consumes: namespace binding plus an
 * observable revision (getSnapshot/subscribe pair — the same HostObservable
 * currency as every other standard-kit source). The revision moves on every
 * active-locale or registry change; the renderer re-derives each entry's `t`
 * from (namespace, revision), so a locale switch hands out NEW function
 * references and memoized components re-render naturally. Implemented by the
 * locale plugin, installed through the runtime SlotRegistry (installLocale).
 * Install before the first render that needs the seat: outlets bind their
 * revision subscription at mount, and a face appearing later has no channel
 * to notify already-mounted outlets (the locale plugin is immediately-tier
 * infrastructure, so normal compositions install during boot).
 */
interface LocaleFace extends HostObservable<{
  revision: number;
}> {
  /**
   * Bind a namespace to a translate function reading the active locale at
   * call time. Identity may be stable per namespace — freshness of rendered
   * text is carried by the renderer's (ns, revision) seat derivation, not by
   * this binding.
   * @param ns - dictionary namespace.
   * @returns the namespace-bound translate function.
   */
  bind(ns: string): Translate;
}
/** Minimal observable API for host-provided standard-kit data sources. */
interface HostObservable<T> {
  getSnapshot(): T;
  subscribe(fn: () => void): () => void;
}
/**
 * Type-erased store instance face at the render boundary (the typed twin is
 * {@link StoreInstance}): a bare snapshot source plus the draft-stripped
 * action callbacks. No React hook crosses this boundary — the render machinery
 * binds `useStore` from the source at its own side (cached per instance);
 * typing lands at the component boundary via {@link PropsStore}.
 */
interface StoreInstanceLike {
  getSnapshot(): unknown;
  /**
   * Subscribe to state changes (uSES subscribe side).
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe(fn: () => void): () => void;
  readonly actions: Record<string, (...params: never[]) => void>;
}
/**
 * Per-session standard props resolved per session id (identity-stable per
 * session scope; a recreated scope yields a new info). Plugins contribute
 * members through the runtime `sessions.provide` contract; the render side binds
 * every `hooks` source into a `use<Name>` selector hook (hooks never appear
 * on the host contract) and spreads `props` verbatim. The runtime itself
 * contributes the first entry (`'session'` → `useSession`).
 */
interface SessionMaybeProvideInfo {
  /** Current session id, absent while the application is in no-session mode. */
  sessionId: string | undefined;
  /**
   * Static hook roster. Each value is absent with the session; keys remain so
   * session-maybe entries always receive the same hook-shaped standard kit.
   */
  hooks: Record<string, HostObservable<unknown> | undefined>;
  /** Static plain-member roster; values are undefined with the session. */
  props: Record<string, unknown>;
  /**
   * Key-addressed projection value sources (the useProjection framework seat;
   * session-projection subsystem page: docs/subsystems/session-projection.md).
   * Unlike `hooks`, the key space is open — values
   * arrive from host-computed push frames — so the render side binds per
   * resolved key instead of per static roster member. Faces are always
   * defined per key (absence is an `undefined` snapshot); the whole member is
   * absent with the session.
   */
  projections?: {
    faceOf(key: string): HostObservable<unknown>;
  } | undefined;
}
/** Host API the runtime SlotRegistry presents to the installed renderer. */
interface SlotRendererHost {
  /**
   * Subscribe to a key's registration changes (microtask-batched).
   * @param key - slot key.
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe(key: string, fn: () => void): () => void;
  /**
   * Monotonic version for uSES pairing.
   * @param key - slot key.
   * @returns current version.
   */
  getVersion(key: string): number;
  /**
   * Snapshot the registered entries for a key (stable reference between mutations).
   * @param key - slot key.
   * @returns entries in registration (list: order) sequence.
   */
  entriesOf(key: string): readonly StoredEntry[];
  /**
   * Shadowing winners per cell for a key — the render read for single/keyed/
   * list dispatch: the first live (non-abdicated) entry of each cell in
   * priority order; chain keys pass through unchanged (election consumes
   * every entry). Fresh array per call — a render-body read, not a uSES
   * getSnapshot source.
   * @param key - slot key.
   * @returns the winning entry per occupied cell.
   */
  entriesOfSlot(key: string): readonly StoredEntry[];
  /**
   * Report an entry boundary crash. With `info.abdicate` (shadowing kinds)
   * the entry retires from its cell, one-shot, so the next survivor renders;
   * chain crashes report without abdicating. The registration stays on the
   * ledger either way.
   * @param key - slot key the entry rendered under.
   * @param entry - the crashed entry.
   * @param error - the crash cause.
   * @param info - `abdicate`: whether the crash retires the entry from its cell.
   */
  reportEntryError(key: string, entry: StoredEntry, error: unknown, info: {
    abdicate: boolean;
  }): void;
  /**
   * Declared runtime spec from the declarations ledger.
   * @param key - slot key.
   * @returns the spec, or undefined while the key is undeclared (outlets render empty).
   */
  specOf(key: string): SlotSpec<SlotEntryDef> | undefined;
  /**
   * Stale-authorization check: whether the entry is still in the ledger.
   * @param entry - a previously rendered entry.
   * @returns false once the entry's registration was disposed.
   */
  isLive(entry: StoredEntry): boolean;
  /**
   * Resolve (create or return cached) the store instance for an entry's
   * declared handle under a scope key; lifecycle rides the ledger axis.
   * @param entry - entry whose declaration carries the handle.
   * @param scopeKey - session id for session-scope slots, undefined for root scope.
   * @returns the instance, or undefined when the entry declares no store.
   */
  storeOf(entry: StoredEntry, scopeKey: string | undefined): StoreInstanceLike | undefined;
  /** Session-side standard-kit sources. */
  sessions: {
    /** Session list source backing the useSessions standard hook. */
    list: HostObservable<unknown>;
    /**
     * Atomic current-session provide projection used by SessionProvider:
     * selection changes and provider-roster changes publish through this one
     * source, so a stable current id cannot strand mounted entries on an
     * obsolete hook/prop schema. Carries the static roster with sessionId
     * undefined while no current session resolves.
     */
    provideInfo: HostObservable<SessionMaybeProvideInfo>;
  };
  /** Workspace-side standard-kit sources. */
  workspaces: {
    /** Workspace list source backing the useWorkspaces standard hook. */
    list: HostObservable<unknown>;
  };
  /**
   * Installed locale face backing the `t` standard seat (absent until the
   * locale plugin installs one; rendering an entry that declared `locale:`
   * without it is an assembly failure).
   */
  locale?: LocaleFace | undefined;
}
/** The installation contract: runtime owns install()/renderSlot(); web-react implements rendering. */
interface SlotRenderer {
  /**
   * Render the root slot tree over the host API (the only ctx-level entry).
   * @param host - the installing service's host API.
   * @param ownerProps - owner props from the shell's renderSlot('root', ...) call.
   * @returns the rendered tree.
   */
  renderRoot(host: SlotRendererHost, ownerProps: object): ReactNode;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-ui-_c8f9ee8e788c2abebc8a1bdbe0720c92/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/store.d.ts
/** Framework-neutral store contracts for slot registrations and the runtime engine. */
/**
 * Typed selector hook over a snapshot source. Canonical shape for the whole
 * slot system (web-react's engine hook is structurally identical; the
 * framework is the only party that ever constructs one).
 */
type SnapshotSelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S;
/**
 * Selector hook over a source that follows the current session. The hook is
 * always present, while its selected value is absent whenever no session is
 * current. This keeps hook call sites stable across no-session/session
 * transitions without pretending that a session snapshot exists.
 */
type MaybeSnapshotSelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S | undefined;
/**
 * Action declaration table: pure immer-draft transforms over the store state,
 * declared as the store's complete write set (the audit face — components can
 * only write through these).
 */
type ActionsDecl<T> = Record<string, (draft: T, ...params: any[]) => void>;
/**
 * Draft-stripped callback form of an actions table: what components
 * (`props.actions`) and inject factories receive — the framework bakes the
 * draft parameter away by binding each action to the resolved instance.
 */
type BakedActions<T, A extends ActionsDecl<T>> = { [K in keyof A]: A[K] extends ((draft: T, ...params: infer P) => void) ? (...params: P) => void : never; };
/**
 * Store declaration spec: initial-state factory (a lambda so every instance
 * gets a fresh state), optional persistence key (mechanical, framework-run),
 * and the actions write set.
 */
interface StoreSpec<T, A extends ActionsDecl<T>> {
  init: () => T;
  persist?: string;
  actions: A;
}
/**
 * Live engine instance: the create() product consumed by the render machinery
 * and by tests. A bare snapshot source plus the baked write set — no React
 * hook rides the engine product (the engine lives in the React-free runtime);
 * the render machinery binds the `useStore` hook from this source on its own
 * side, cached per instance. Production components and render paths never
 * call create() themselves — instance lifecycle is the framework's.
 */
interface StoreInstance<T, A extends ActionsDecl<T>> {
  readonly actions: BakedActions<T, A>;
  getSnapshot(): T;
  /**
   * Subscribe to state changes (uSES subscribe side).
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe(fn: () => void): () => void;
  /**
   * Drop this instance's persisted value (no-op for non-persist specs). The
   * framework calls it when the owning scope dies for good — a pruned session
   * must not leave orphaned storage keys behind.
   */
  clearPersisted(): void;
}
/**
 * Store handle: spec + state/actions types + shared identity + instance
 * factory in one value. Handles are constructed in apply world (shared across
 * registrations of one plugin) or by the framework from a registrant's
 * factory (exclusive). Never export a handle at module level — module-cache
 * identity is a disguised singleton across plugin reloads.
 */
interface StoreHandle<T, A extends ActionsDecl<T>> {
  readonly spec: StoreSpec<T, A>;
  /**
   * Create a live engine instance (framework machinery and tests only).
   * @param scopeKey - session id for session-scope instances; suffixes the
   * persist key so per-session instances persist independently (root-scope
   * instances omit it).
   * @returns a fresh instance seeded from `spec.init()`.
   */
  create(scopeKey?: string): StoreInstance<T, A>;
}
/**
 * Exclusive-store registration form: the registrant passes the factory itself
 * and the framework calls it per entry x scope (no shared identity exists).
 */
type StoreFactory = () => StoreHandle<any, any>;
/** The register `store` option position: a shared handle or an exclusive factory. */
type StoreDecl = StoreHandle<any, any> | StoreFactory;
/** Normalize a store declaration to its handle type (factories yield their return). */
type HandleOf<H> = H extends (() => infer R) ? R : H;
/**
 * Handle-keyed baked actions: the `actions` parameter of an inject factory
 * whose registration declared a store — the same baked callback set the
 * component receives via {@link PropsStore}.
 */
type BoundActions<H> = H extends StoreHandle<infer T, infer A> ? BakedActions<T, A> : never;
/**
 * The store props share, derived from the declared handle: a typed selector
 * hook plus the baked write set. Components never see the instance itself
 * (no update/set — reads via useStore, writes via the declared actions only).
 */
type PropsStore<H> = H extends StoreHandle<infer T, infer A> ? {
  useStore: SnapshotSelectorHook<T>;
  actions: BakedActions<T, A>;
} : object;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-ui-_c8f9ee8e788c2abebc8a1bdbe0720c92/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/index.d.ts
/** Slot contract table. Owners extend via declaration merging; entries are {@link SlotEntryDef}. */
interface SlotMap {}
/**
 * Locale namespace table. Dictionary owners extend via declaration merging
 * (exactly like {@link SlotMap}, and declared in this entry module for the
 * same lexical-merge reason): the key is the namespace string, the value is
 * the union of its dictionary keys. Register sites declare one of these
 * namespaces (`locale:`), which puts the typed `t` standard seat on the
 * component props.
 */
interface LocaleNamespaceMap {}
/**
 * Translate a dictionary key with optional `{name}` template params.
 * `K` narrows the accepted keys to the owning namespace's dictionary union
 * (plus the shared common vocabulary where composed).
 */
type Translate<K extends string = string> = (key: K, params?: Record<string, unknown>) => string;
/**
 * The shared `common` vocabulary keys as merged by the locale plugin;
 * resolves to `never` in programs without the merge (this package's tests),
 * keeping the union collapse harmless.
 */
type CommonKeyOf = LocaleNamespaceMap extends {
  common: infer C;
} ? C & string : never;
/**
 * Key domain of a namespace-bound translate: the namespace's own dictionary
 * union plus the shared common vocabulary (the lookup chain consults common
 * after the namespace misses).
 */
type LocaleKeysOf<N extends keyof LocaleNamespaceMap & string> = (LocaleNamespaceMap[N] & string) | CommonKeyOf;
/**
 * Namespace-addressed translate — the developer-facing alias over
 * {@link Translate}: `TranslateNS<'model'>` is the translate function of the
 * `model` namespace (key domain = its dictionary union plus the shared
 * common vocabulary), the exact type of the framework-injected `t` seat and
 * of the locale service's typed `bind`.
 */
type TranslateNS<N extends keyof LocaleNamespaceMap & string> = Translate<LocaleKeysOf<N>>;
/**
 * Locale share of the composed component props: the framework-injected `t`
 * seat, present exactly on entries whose registration declares `locale:`.
 */
type PropsLocale<N> = N extends keyof LocaleNamespaceMap & string ? {
  /** Translate a dictionary key of the declared namespace (or the shared common vocabulary). */
  t: TranslateNS<N>;
} : object;
/** Slot cardinality: single occupant, ordered list, key-dispatched, or selector-routed chain. */
type SlotKind = 'single' | 'list' | 'keyed' | 'chain';
/** Slot data context: global, current-session-optional, or strict session-bound. */
type SlotScope = 'root' | 'session-maybe' | 'session';
/**
 * One SlotMap entry: kind/scope axes plus the optional owner-supplied props
 * share (`owner` is what the parent passes at its renderSlot call site; the
 * framework standard kit and the registrant's injected share never enter this
 * table — full component props compose at the component as the four-share
 * intersection, see {@link ComposedProps}).
 */
interface SlotEntryDef {
  kind: SlotKind;
  scope: SlotScope;
  owner?: object;
  /**
   * Optional keyed-entry prop table. A keyed registration contributes one
   * literal key and receives the corresponding prop share; ordinary owner
   * props remain common to every key.
   */
  keyProps?: Record<string, object>;
  /**
   * Optional opaque context carried by one renderSlot occurrence. Only
   * function-valued members of the slot-level injected hooks compartment
   * receive it; the slot machinery never interprets the value.
   */
  hookContext?: unknown;
  /**
   * Optional Slot-level inject face supplied by the parent registration's
   * child declaration. Every registered entry receives its bound component
   * face; child registrants do not own or replace this common capability.
   */
  inject?: object;
}
/**
 * Runtime dispatch spec for one slot, recorded from a register call's
 * `children` value. The literal is compile-time checked against the SlotMap
 * entry (`SlotSpec<SlotMap[P]>` in {@link ChildrenDecl}), so kind, scope, and
 * any common inject face are declared at one point and validate each other.
 */
type SlotSpec<E extends SlotEntryDef> = {
  kind: E['kind'];
  scope: E['scope'];
} & ('inject' extends keyof E ? E extends {
  inject: infer Injected extends object;
} ? {
  inject: Injected;
} : {
  inject?: object;
} : {
  inject?: never;
});
/**
 * Child-slot declaration table for register(): keys are the declared (and
 * thereby render-authorized) slot names, values are their runtime dispatch
 * specs. Declaring is claiming: the registering entry becomes the only entry
 * allowed to render these keys.
 */
type ChildrenDecl = { [P in keyof SlotMap & string]?: SlotSpec<SlotMap[P]>; };
/** Owner-supplied props share for a slot key ({} for entries declaring no `owner`). */
type OwnerOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  owner: infer O extends object;
} ? O : object;
/** Registration/dispatch key domain of one keyed slot. */
type EntryKeyOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  kind: 'keyed';
  keyProps: infer P extends object;
} ? keyof P & string : string;
/** Key-dependent props supplied by the owner at one keyed dispatch site. */
type KeyPropsOf<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K>> = SlotMap[K] extends {
  kind: 'keyed';
  keyProps: infer P extends object;
} ? EntryKey extends keyof P ? P[EntryKey] extends object ? P[EntryKey] : never : never : object;
/** Opaque per-render occurrence context declared by one slot. */
type HookContextOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  hookContext: infer Context;
} ? Context : never;
/** Common render-occurrence inject face declared by one slot. */
type SlotInjectOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  inject: infer Injected extends object;
} ? Injected : object;
/** Scope axis of a slot key's SlotMap entry. */
type ScopeOf<K extends keyof SlotMap & string> = SlotMap[K]['scope'];
/**
 * Framework standard kit delivered to every session-scope slot component.
 * Declared EMPTY here (zero-dependency layer): the runtime package merges the
 * real members (`useSession` bound to the conversation snapshot and the
 * framework-supplied `sessionId`) exactly as consumers merge SlotMap keys.
 */
interface SessionStandardProps {}
/**
 * Framework standard kit delivered to current-session-optional slots. Its
 * hooks stay callable while no session is selected and return `undefined`
 * until one becomes current; concrete members merge in at runtime packages.
 */
interface SessionMaybeStandardProps {}
/**
 * Framework standard kit delivered to EVERY slot component (the global seat).
 * Declared empty here; the runtime package merges the global object-layer
 * selector hooks that shared page composition consumes.
 */
interface GlobalStandardProps {}
/**
 * The session id type as the runtime's SessionStandardProps merge declares it
 * (branded); falls back to `string` in programs without the merge (this
 * package's own tests).
 */
type SessionIdOf = SessionStandardProps extends {
  sessionId: infer S;
} ? S : string;
/**
 * Runtime props share for a slot key: owner share (parent's renderSlot call
 * site) + session standard kit (session scope only) + the global seat.
 */
type PropsRuntime<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>> = OwnerOf<K> & KeyPropsOf<K, EntryKey> & SlotInjectFace<SlotInjectOf<K>> & (ScopeOf<K> extends 'session' ? SessionStandardProps : ScopeOf<K> extends 'session-maybe' ? SessionMaybeStandardProps : object) & GlobalStandardProps;
/** renderSlot dispatch options: keyed dispatch key, list filtering, and empty fallback. */
interface RenderOpts<EntryKey extends string = string> {
  entryKey?: EntryKey;
  only?: string;
  fallback?: ReactNode;
  /** Type-erased runtime seat; PropsRenderSlots narrows or removes it per slot declaration. */
  hookContext?: unknown;
}
/** renderSlotChain dispatch options. */
interface ChainRenderOpts {
  /** The owner's fallback body, rendered when every entry's selector declines. */
  fallback?: ReactNode;
  /**
   * Keep the fallback permanently mounted: an election hides it (wrapped,
   * display:none) instead of unmounting it, and the all-decline case shows it
   * as-is — fallback-held state (composer drafts, DOM state) survives a
   * takeover. Chain kind only. Sole consumer today: the
   * 'conversation.composer' chain.
   */
  overlay?: boolean;
}
/**
 * Chain-entry selector: the routing decision of one chain contribution.
 * Runs at render time in chain order (ascending `priority`, default 0, lower
 * tries first; ties keep registration = assembly order); the first non-null
 * return elects its entry
 * and becomes the component's `matched` prop; `null` passes to the next
 * entry; all-null falls to the owner's {@link ChainRenderOpts} fallback.
 * MUST be pure — a function of the owner props only, no external mutable
 * reads, no side effects (the decline decision lives here, never in a
 * mounted component probing its own props).
 */
type ChainSelect<O extends object, M> = (owner: O) => M | null;
/** Keys of a slot-key union whose SlotMap entry is chain-kind (renderSlotChain's dispatch domain). */
type ChainKeysOf<S extends keyof SlotMap & string> = S extends unknown ? (SlotMap[S]['kind'] extends 'chain' ? S : never) : never;
/** Keys in a render share whose dispatch occurrence requires hookContext. */
type ContextualKeysOf<S extends keyof SlotMap & string> = S extends unknown ? (SlotMap[S] extends {
  hookContext: unknown;
} ? S : never) : never;
/** Keys in a render share with the ordinary optional options bag. */
type OrdinaryKeysOf<S extends keyof SlotMap & string> = Exclude<S, ContextualKeysOf<S>>;
/**
 * Plain and contextual child dispatch signatures. Keeping them as separate
 * call signatures preserves ordinary renderSlot assignability while making a
 * declared hookContext mandatory only for the Slot keys that need it.
 */
type RenderSlotFn<S extends keyof SlotMap & string> = ([ContextualKeysOf<S>] extends [never] ? object : {
  <K extends ContextualKeysOf<S>, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>>(key: K, owner: OwnerOf<K> & KeyPropsOf<K, NoInfer<EntryKey>>, opts: RenderOpts<EntryKey> & {
    hookContext: HookContextOf<K>;
  }): ReactNode;
}) & ([OrdinaryKeysOf<S>] extends [never] ? object : {
  <K extends OrdinaryKeysOf<S>, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>>(key: K, owner: OwnerOf<K> & KeyPropsOf<K, NoInfer<EntryKey>>, opts?: Omit<RenderOpts<EntryKey>, 'hookContext'>): ReactNode;
});
/**
 * Chain matched share: a chain-slot component receives its selector's
 * non-null result as the framework-injected `matched` prop; other kinds add
 * nothing to the composed constraint.
 */
type MatchedShare<E extends SlotEntryDef, M> = E['kind'] extends 'chain' ? {
  matched: M;
} : object;
/** Props of the standard-kit SessionProvider seat (render-prop form). */
interface SessionAreaProps {
  /** No-session body (also covers a current id whose session cannot be resolved). */
  empty?: (() => ReactNode) | undefined;
  /** Session body; the framework remounts it per session (key=sessionId). */
  children: (sessionId: SessionIdOf) => ReactNode;
}
/**
 * Framework-wired session area component. It subscribes to runtime-owned
 * session selection and is injected into entries that declare session-scoped
 * children; business code does not import it directly.
 */
type SessionProviderComponent = (props: SessionAreaProps) => ReactNode;
/**
 * Child-slot render share: `renderSlot` statically narrowed to the entry's
 * declared children keys. Delegation is plain props passing (hand
 * `props.renderSlot` down); the authorizing identity stays the registering
 * entry. `__renders` is a phantom variance anchor (never materialized):
 * generic method signatures compare loosely across differing key unions, so
 * this contravariant marker is what actually enforces "component key set ⊆
 * children declaration" at the register call site.
 */
type PropsRenderSlots<S extends keyof SlotMap & string> = {
  /**
   * Render a declared non-chain child slot (chain keys dispatch through
   * `renderSlotChain` — their routing lives in entry selectors).
   * @param key - declared child key.
   * @param owner - owner props share for that key (decided at the render site).
   * @param opts - kind dispatch options.
   * @returns rendered node(s).
   */
  renderSlot: RenderSlotFn<Exclude<S, ChainKeysOf<S>>>;
  readonly __renders?: ((key: S) => void) | undefined;
} & ([ChainKeysOf<S>] extends [never] ? object : {
  /**
   * Render a declared chain child slot: entry selectors run in chain order
   * over `owner`; the first non-null match renders its component with the
   * selector result injected as `matched`; all-null renders `opts.fallback`.
   * @param key - declared chain child key.
   * @param owner - owner props share (the selectors' routing input).
   * @param opts - fallback body for the all-null case.
   * @returns rendered node(s).
   */
  renderSlotChain: <K extends ChainKeysOf<S>>(key: K, owner: OwnerOf<K>, opts?: ChainRenderOpts) => ReactNode;
}) & ('session' extends ScopeOf<S> ? {
  SessionProvider: SessionProviderComponent;
} : object);
/**
 * Registration-position component shape: the bare call signature, so composed
 * constraints check through clean parameter contravariance (FC statics add
 * covariant noise rejecting legitimate narrowings).
 */
type SlotComponent<P> = (props: P) => ReactNode;
/**
 * Registrant hooks compartment: bare observable sources (getSnapshot +
 * subscribe pairs) supplied under the reserved `hooks` key of an entry's
 * inject face. These retain the original source-to-selector binding and do
 * not participate in render-occurrence context.
 */
type HooksSources = Record<string, HostObservable<unknown>>;
/** Component-side Hook produced from one slot-level inject.hooks member. */
type BoundHookOf<Definition> = Definition extends HostObservable<infer Snapshot> ? SnapshotSelectorHook<Snapshot> : Definition extends ((...args: never[]) => infer Hook) ? Hook extends ((...args: never[]) => unknown) ? Hook : never : never;
/**
 * Selector-hook share synthesized from a hooks compartment: each source
 * `name` becomes a `use<Name>` selector hook over its snapshot type.
 */
type PropsSlotHooks<HS extends object> = { [N in keyof HS & string as `use${Capitalize<N>}`]: BoundHookOf<HS[N]>; };
/** Component-side view of a slot dispatcher's common inject face. */
type SlotInjectFace<I extends object> = I extends {
  hooks: infer HS extends object;
} ? Omit<I, 'hooks'> & PropsSlotHooks<HS> : I;
/** Selector-hook share synthesized from an entry inject hooks compartment. */
type PropsHooks<HS extends HooksSources> = { [N in keyof HS & string as `use${Capitalize<N>}`]: SnapshotSelectorHook<HS[N] extends HostObservable<infer T> ? T : never>; };
/**
 * The component-side view of an inject face: the reserved `hooks`
 * compartment (when declared) arrives as bound `use<Name>` selector hooks;
 * every other member passes through verbatim.
 */
type InjectFace<I extends object> = I extends {
  hooks: infer HS extends HooksSources;
} ? Omit<I, 'hooks'> & PropsHooks<HS> : I;
/**
 * The composed component props intersection: runtime share (SlotMap) +
 * child-render share (children declaration) + store share (declared handle) +
 * the registrant's injected business face (its hooks compartment bound, see
 * {@link InjectFace}) + the locale `t` seat (declared namespace, see
 * {@link PropsLocale}). Each share derives from its single source of truth;
 * components reference this composition, never re-type it.
 */
type ComposedProps<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K>, S extends keyof SlotMap & string, H, I extends object, M = never, N = undefined> = PropsRuntime<K, EntryKey> & PropsRenderSlots<S> & PropsStore<H> & InjectFace<I> & MatchedShare<SlotMap[K], M> & PropsLocale<N>;
/**
 * Inject factory parameter list, derived from the registration's declaration:
 * strict session slots receive a definite framework-resolved `sessionId`;
 * session-maybe slots receive the current id or `undefined`; a declared store
 * appends the baked `actions` (the same callbacks the component receives).
 * Business data access happens through the apply closure's ctx — no binding
 * object parameter exists.
 */
type InjectParams<K extends keyof SlotMap & string, H> = ScopeOf<K> extends 'session' ? ([H] extends [StoreDecl] ? [sessionId: SessionIdOf, actions: BoundActions<HandleOf<H>>] : [sessionId: SessionIdOf]) : ScopeOf<K> extends 'session-maybe' ? ([H] extends [StoreDecl] ? [sessionId: SessionIdOf | undefined, actions: BoundActions<HandleOf<H>> | undefined] : [sessionId: SessionIdOf | undefined]) : ([H] extends [StoreDecl] ? [actions: BoundActions<HandleOf<H>>] : []);
/**
 * A list-entry display label: a plain string, or a thunk re-evaluated per
 * read so registration-time text (nav rows, tabs) follows the active locale
 * without re-registration. Owners resolve through {@link resolveSlotLabel}.
 */
type SlotLabel = string | (() => string);
/**
 * Kind shape fields carried in register options (keyed dispatch key; list
 * id/order/label; chain select/priority; non-chain priority = cell shadowing rank).
 */
type KindOptions<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K>, M = never> = SlotMap[K]['kind'] extends 'keyed' ? {
  key: EntryKey;
  /** Cell shadowing rank (ascending, default 0, lowest renders; same key + same priority throws — see {@link SlotCore.register}). */
  priority?: number;
} : SlotMap[K]['kind'] extends 'list' ? {
  id: string;
  order?: number;
  label?: SlotLabel;
  /** Cell shadowing rank (ascending, default 0, lowest renders; same id + same priority throws — see {@link SlotCore.register}). */
  priority?: number;
} : SlotMap[K]['kind'] extends 'chain' ? {
  /** Routing selector, mandatory on chain entries; `M` (the component's `matched` prop) infers from its return. */
  select: ChainSelect<SlotMap[K] extends {
    owner: infer O extends object;
  } ? O : object, M>;
  /** Explicit chain position (ascending, default 0, lower tries first); ties keep registration = assembly order. */
  priority?: number;
} : {
  /**
   * Cell shadowing rank (ascending, default 0, lowest renders; a
   * same-priority second registration throws — see {@link SlotCore.register}).
   */
  priority?: number;
};
/**
 * Compile-time presence check: an entry declaring children MUST consume
 * `renderSlot` (or `renderSlotChain` when its only children are chain slots)
 * — declaring is claiming; an entry that does not render its children should
 * not declare them. Evaluates to an unsatisfiable intersection member naming
 * the declared keys when violated.
 */
type RendersCheck<C, D> = [keyof D & keyof SlotMap & string] extends [never] ? unknown : C extends ((props: infer P) => ReactNode) ? ('renderSlot' extends keyof P ? unknown : 'renderSlotChain' extends keyof P ? unknown : {
  'children declared but the component consumes no renderSlot': keyof D & keyof SlotMap & string;
}) : unknown;
/** Common register options share (see {@link SlotCore.register} for semantics). */
type BaseOptions<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K>, D extends ChildrenDecl, H, M = never, N = undefined> = {
  /** Target slot key (the entry contributes INTO this slot). */
  name: K;
  /** Child-slot declaration + render authorization + runtime spec, in one table. */
  children?: D;
  /** Store seat: a shared handle (apply-constructed) or an exclusive factory (framework-called per entry x scope). */
  store?: H;
  /**
   * Dictionary namespace of this entry's copy. Declaring it puts the
   * framework-synthesized `t` seat (typed to the namespace's dictionary
   * union) on the component props; rendering requires an installed locale
   * face — fails loud otherwise.
   */
  locale?: N;
  /** Registrant identity label for diagnostics (the runtime Service wrapper stamps the caller's fiber name). */
  registrant?: string;
} & KindOptions<K, EntryKey, M>;
/**
 * One stored registration, as recorded by the core and read by the render
 * machinery (type-erased at this boundary; the registration contract already proved
 * the shares against the component).
 */
interface StoredEntry {
  component: unknown;
  options: {
    key?: string;
    id?: string;
    order?: number;
    label?: SlotLabel;
    priority?: number;
  };
  /** Chain routing selector (type-erased like `inject`; present exactly on chain-slot entries). */
  select?: ((owner: never) => unknown) | undefined;
  /** Registrant business face; positional params derive from the declaration (sessionId?, actions?). */
  inject?: ((...args: never[]) => Record<string, unknown>) | undefined;
  /** Child-slot declaration table (declaration + authorization + runtime spec in one). */
  children?: Readonly<Record<string, SlotSpec<SlotEntryDef>>> | undefined;
  /** Declared store seat (instance resolution and lifecycle live with the host machinery). */
  store?: StoreDecl | undefined;
  /** Declared dictionary namespace (the render machinery synthesizes the `t` seat from it). */
  locale?: string | undefined;
  /** Diagnostics label of who registered. */
  registrant?: string | undefined;
}
/** JSON-safe live occupant returned by slot inspection. */
interface LiveSlotOccupant {
  /** Plugin or package that registered the entry, when known. */
  registrant?: string;
  /** Keyed-slot cell. */
  key?: string;
  /** List-slot cell. */
  id?: string;
  /** List display order. */
  order?: number;
  /** Shadowing or chain priority. */
  priority: number;
  /** Whether the renderer currently selects this entry. */
  active: boolean;
}
/** JSON-safe live slot declaration tree. */
interface LiveSlotNode {
  /** Exact SlotMap key. */
  name: string;
  /** Slot cardinality. */
  kind: SlotKind;
  /** Runtime data scope. */
  scope: SlotScope;
  /** Diagnostic owner of this declaration. */
  declaredBy?: string;
  /** Current registrations in ledger order. */
  occupants: LiveSlotOccupant[];
  /** Slots declared by entries mounted in this slot. */
  children: LiveSlotNode[];
}
/**
 * Pure slot registry (no cordis; event emission and the renderer installation contract
 * live in the runtime Service wrapper).
 *
 * The 'root' slot is the one a-priori declaration, seeded at construction
 * (single/root, declared by the framework) — the render tree's root hole.
 *
 * Change propagation contract: versions bump and {@link SlotCore.onMutate}
 * fires synchronously per mutation (registry state is consistent when they
 * fire); {@link SlotCore.subscribeDeclaration} fires synchronously for each
 * declaration lifetime boundary; {@link SlotCore.subscribe} notifications
 * batch per microtask, so N same-tick mutations produce one notification per
 * touched key. Entry crash reports ({@link SlotCore.reportEntryError}) ride
 * the same mutation channel when they abdicate, then notify
 * {@link SlotCore.onEntryError} synchronously.
 */
declare class SlotCore {
  private records;
  private mutateListeners;
  /** Shared-handle scope ledger: handle → the scope it first mounted under + live mount count. */
  private handleScopes;
  private dirty;
  private flushScheduled;
  /**
   * Entries retired by an abdicating crash report
   * ({@link SlotCore.reportEntryError}): excluded from
   * {@link SlotCore.entriesOfSlot} projections for the rest of their
   * registration's life, while the registration itself stays on the ledger
   * (disposal authority remains with the registrant).
   */
  private abdicated;
  private entryErrorListeners;
  constructor();
  /**
   * Contribute a component to a declared slot and (optionally) declare child
   * slots, a store seat, and the registrant's business face.
   *
   * Load-time validation (misconfiguration fails loud; the render hot path
   * re-checks nothing): registering into an undeclared slot throws; declaring
   * an already-declared child key throws (one declarer per slot — the message
   * names the first declarer); mounting one shared store handle under slots
   * of different scopes throws. Kind constraints: keyed — missing `key`
   * throws; list — missing `id` throws; chain — missing `select` throws (the
   * selector is the entry's routing seat, see {@link ChainSelect}).
   *
   * Shadowing (single/keyed/list): entries sharing one cell (single — the
   * slot itself; keyed — same `key`; list — same `id`) coexist at distinct
   * priorities, sorted ascending with ties keeping registration order; the
   * cell's lowest live entry renders ({@link SlotCore.entriesOfSlot}). A
   * second registration at an occupied cell's exact priority (default 0)
   * throws naming the occupant, so priority-less composition keeps the
   * historical one-occupant-per-cell fail-loud.
   *
   * Lifecycle: the disposer removes the contribution AND collapses every
   * declared child slot (child entries clear recursively; their stale
   * disposers become no-ops) — one lifecycle axis, no dangling state.
   *
   * @param options - registration options: target `name`, `children`
   * declaration table, `store` seat, `inject` business-face factory, kind
   * shape fields (keyed `key`; list `id`/`order`/`label`).
   * @param component - component honoring the four-share composed props
   * contract ({@link ComposedProps}); checked at this call site.
   * @returns disposer removing the registration and its declarations
   * (idempotent; stale disposers after a cascade are no-ops).
   */
  register<K extends keyof SlotMap & string, const EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>, const D extends ChildrenDecl = Record<never, never>, H extends StoreDecl | undefined = undefined, M = never, N extends (keyof LocaleNamespaceMap & string) | undefined = undefined, C extends SlotComponent<never> = SlotComponent<never>>(options: BaseOptions<K, EntryKey, D, H, M, N> & {
    inject?: undefined;
  }, component: C & SlotComponent<ComposedProps<K, NoInfer<EntryKey>, keyof NoInfer<D> & keyof SlotMap & string, HandleOf<NoInfer<H>>, object, NoInfer<M>, NoInfer<N>>> & RendersCheck<C, D>): () => void;
  /**
   * Inject-bearing overload: identical semantics to the overload above, plus
   * the registrant's business face — `I` is inferred from the inject
   * factory's return and joins the component's composed-props constraint
   * (factory parameters derive from the declaration, {@link InjectParams}).
   * @param options - registration options plus the `inject` business-face factory.
   * @param component - component honoring the four-share composed props
   * contract including the inject share `I`.
   * @returns disposer removing the registration and its declarations.
   */
  register<K extends keyof SlotMap & string, I extends object, const EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>, const D extends ChildrenDecl = Record<never, never>, H extends StoreDecl | undefined = undefined, M = never, N extends (keyof LocaleNamespaceMap & string) | undefined = undefined, C extends SlotComponent<never> = SlotComponent<never>>(options: BaseOptions<K, EntryKey, D, H, M, N> & {
    inject: (...args: InjectParams<K, H>) => I;
  }, component: C & SlotComponent<ComposedProps<K, NoInfer<EntryKey>, keyof NoInfer<D> & keyof SlotMap & string, HandleOf<NoInfer<H>>, I, NoInfer<M>, NoInfer<N>>> & RendersCheck<C, D>): () => void;
  /**
   * Whether a previously obtained entry is still registered (the render
   * machinery's stale-authorization probe: a retained renderSlot binding
   * whose entry left the ledger must not render).
   * @param entry - a previously read entry.
   * @returns false once the entry's registration was disposed.
   */
  isLive(entry: StoredEntry): boolean;
  /**
   * Snapshot the registered entries for a key. Returns the cached array
   * reference (stable between mutations — safe as a uSES getSnapshot source);
   * empty for keys not (or no longer) declared, so renderers may probe ahead
   * of plugin load order.
   * @param key - slot key (dynamic: the render machinery holds keys as strings).
   * @returns entries in registration (list: order) sequence.
   */
  entries(key: string): readonly StoredEntry[];
  /**
   * Project a key's entries to its shadowing winners: the first live
   * (non-abdicated) entry of each cell in priority order — single: the slot
   * is one cell; keyed: one cell per `key`; list: one cell per `id` (winners
   * keep ledger sequence; list renderers still refine display by `order`).
   * Chain keys return the raw entries unchanged: election consumes every
   * entry, shadowing does not apply. The raw {@link SlotCore.entries} view
   * stays the inspection surface. Builds a fresh array per call — a render
   * body read, not a uSES getSnapshot source.
   * @param key - slot key (dynamic: the render machinery holds keys as strings).
   * @returns the winning entry per occupied cell (empty while undeclared).
   */
  entriesOfSlot(key: string): readonly StoredEntry[];
  /**
   * Look up a slot's declared spec, narrowed by the SlotMap key.
   * @param key - SlotMap key.
   * @returns the spec, or undefined while undeclared.
   */
  spec<K extends keyof SlotMap & string>(key: K): SlotSpec<SlotMap[K]> | undefined;
  /**
   * Dynamic-key escape hatch for spec lookup — renderers resolving keys they
   * only hold as strings (generic dispatch) use this wide form; statically
   * keyed callers use {@link SlotCore.spec}.
   * @param key - candidate slot key.
   * @returns the wide-typed spec, or undefined while undeclared.
   */
  specDynamic(key: string): SlotSpec<SlotEntryDef> | undefined;
  /**
   * Export the current declaration topology without components or executable hooks.
   * @param root - exact Slot key to select; omitted returns every live root.
   * @returns selected live Slot trees, or an empty array when `root` is unavailable.
   */
  snapshot(root?: string): LiveSlotNode[];
  /**
   * Read the declaration lifetime of a key. Entry additions and removals do
   * not change it; declaration creation and collapse each advance it.
   * @param key - slot key.
   * @returns monotonic epoch (0 before the first declaration).
   */
  declarationEpoch(key: string): number;
  /**
   * Subscribe to registration changes for a key (microtask-batched).
   * Subscribing ahead of declaration is allowed; the declaration notifies.
   * @param key - slot key.
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe(key: string, fn: () => void): () => void;
  /**
   * Subscribe to declaration lifetime boundaries for a key. Notifications
   * are synchronous so declaration teardown finishes before a subsequent
   * same-tick registration can observe stale resources. Ordinary entry
   * mutations do not notify this surface. A children table commits every
   * sibling declaration before its first notification.
   * @param key - slot key.
   * @param fn - declaration or collapse callback.
   * @returns unsubscribe.
   */
  subscribeDeclaration(key: string, fn: () => void): () => void;
  /**
   * Monotonic version for a key, bumped synchronously per mutation so a
   * uSES getSnapshot read is never stale when its batched notification lands.
   * @param key - slot key.
   * @returns current version (0 for untouched keys).
   */
  getVersion(key: string): number;
  /**
   * Hook every mutation (the runtime Service wrapper bridges this to ctx.emit).
   * Fires synchronously per mutation, unbatched — event semantics need one
   * emission per change.
   * @param fn - called with the mutated key.
   * @returns unsubscribe.
   */
  onMutate(fn: (key: string) => void): () => void;
  /**
   * Renderer crash report from an entry boundary. Always notifies
   * {@link SlotCore.onEntryError} listeners; with `info.abdicate` set (the
   * shadowing kinds — single/keyed/list) it first retires the entry from its
   * cell, one-shot: the record's version bumps through the ordinary mutation
   * channel so outlets re-project onto the cell's next survivor, and a
   * repeat abdicating report no-ops entirely. Chain crashes report with
   * `abdicate: false` — election alternatives resolve at select time, so the
   * entry keeps its cell and only the notification fires. The registration
   * itself stays on the ledger either way — raw {@link SlotCore.entries}
   * still lists the entry and its disposer keeps working.
   * @param key - slot key the entry rendered under.
   * @param entry - the crashed entry.
   * @param error - the crash cause, forwarded to listeners verbatim.
   * @param info - `abdicate`: whether the crash retires the entry from its cell.
   */
  reportEntryError(key: string, entry: StoredEntry, error: unknown, info: {
    abdicate: boolean;
  }): void;
  /**
   * Observe entry boundary crashes (every render-time entry failure the
   * boundaries contain, abdicating or not) — the supervision seam for hosts
   * mirroring contribution health. Fires synchronously per report, after the
   * registry mutated for abdicating crashes (same listener discipline as
   * {@link SlotCore.onMutate}).
   * @param fn - called with the slot key, the crashed entry, the crash
   * cause, and `abdicated`: whether the crash retired the entry from its cell.
   * @returns unsubscribe.
   */
  onEntryError(fn: (key: string, entry: StoredEntry, error: unknown, info: {
    abdicated: boolean;
  }) => void): () => void;
  /**
   * Cascade for a removed entry: release its store mount and collapse every
   * child slot it declared — specs clear, contributions empty (their stale
   * disposers no-op), recursively down the declaration tree. One lifecycle
   * axis: ledger rows, slots, contributions, and store mounts die together.
   */
  private releaseEntry;
  private record;
  private markDirty;
  private notifyDeclaration;
  private flush;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/contract/store.d.ts
/** Minimal observable snapshot source: Session objects and snapshot stores both satisfy it. */
interface ObservableSnapshot<T> {
  getSnapshot(): T;
  subscribe(fn: () => void): () => void;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/contract/workspaces.d.ts
/** The workspaces-service face injected as `ctx.workspaces`. */
interface IWorkspaces {
  /** The useWorkspaces standard feed (read face — writes stay inside the domain). */
  readonly list: ObservableSnapshot<WorkspaceListState>;
  /**
   * Connect a Workspace to its reusable or freshly created blank session.
   * @param workspaceId - target workspace.
   * @returns the connected session id.
   */
  connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>;
  /**
   * The New Session flow: connect the explicit, current-Session, or recent
   * Workspace and open the resulting session; failures surface on the session
   * list state.
   * @param workspaceId - explicit target; omitted inherits the current
   * Session's Workspace before falling back to the recency projection.
   */
  startSession(workspaceId?: WorkspaceId): void;
  /**
   * Register an existing path as a Workspace.
   * @param input - the Host create payload.
   * @returns the created or idempotently resolved Workspace.
   */
  create(input: {
    path: string;
  }): Promise<WorkspaceView>;
  /**
   * Open the Host's native directory picker.
   * @returns the selected path, or null when the user cancelled.
   */
  pickDirectory(): Promise<string | null>;
  /**
   * List one directory level through the Host's `browse` capability.
   * @param path - absolute directory to list; absent lists the Host home directory.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing with breadcrumb ancestry.
   */
  listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing>;
  /**
   * Create one child directory through the Host's `browse` capability.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created directory's absolute path.
   */
  createDirectory(path: string, name: string): Promise<string>;
  /**
   * Open a filesystem path with the Host operating system's default application.
   * @param path - absolute or host-resolvable path.
   */
  openPath(path: string): Promise<void>;
  /**
   * Rename a Workspace.
   * @param workspaceId - target workspace.
   * @param title - the new display title.
   * @returns the updated Workspace view.
   */
  rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView>;
  /**
   * Delete a Workspace (its sessions fall back to the unaccounted group).
   * @param workspaceId - target workspace.
   */
  delete(workspaceId: WorkspaceId): Promise<void>;
  /**
   * Move a Workspace within the registry display order.
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor workspace; omitted appends.
   */
  insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void>;
  /**
   * Move an accounted session within/into a Workspace's ordered list.
   * @param workspaceId - target workspace.
   * @param sessionId - accounted session to move.
   * @param beforeSessionId - accounted anchor to insert before; omitted appends.
   * @returns the updated Workspace view.
   */
  insertSessionBefore(workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId): Promise<WorkspaceView>;
  /**
   * Archive a session into the registry-global set (hidden from grouping
   * surfaces; session log and accounting slot remain). Archiving the current
   * session clears the selection into the New Session view state.
   * @param sessionId - session to archive.
   */
  archiveSession(sessionId: SessionId): Promise<void>;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/workspaces/manager.d.ts
/** Monotone workspace-list arrival lifecycle. */
type WorkspaceListPhase = 'pending' | 'ready';
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/workspaces/service.d.ts
/** Workspace list plus the two-baseline readiness and default-target projection. */
interface WorkspaceListState {
  items: readonly WorkspaceView[];
  /**
   * Registry-global archive set in Host order: grouping surfaces hide these
   * sessions everywhere (workspace groups and the ungrouped bucket) while
   * their session logs and workspace accounting slots remain. A plain array
   * (store-engine vocabulary; immer drafts reject Sets) — membership lookups
   * build their own transient Set.
   */
  archivedSessionIds: readonly SessionId[];
  state: 'idle' | 'loading' | 'error';
  phase: WorkspaceListPhase;
  error: RpcError | null;
  /** True only after both workspace.list and session.list have succeeded. */
  baselinesReady: boolean;
  /** Most recently active Workspace, derived without changing `items` order. */
  recentWorkspaceId: WorkspaceId | undefined;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/slots.d.ts
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The built-in render-tree root hole (seeded by SlotCore): the one slot the
     * shell itself renders, and the ancestor of every other seat. OCCUPIED by
     * ui-layout's AppFrame, which declares the sidebar, conversation, details,
     * and shell.overlay seats inside it.
     *
     * DO NOT register here. This is a single slot, so a second entry does not
     * sit beside the frame — it shadows it, and a dynamically registered entry
     * is assigned a lower priority than the shipped one, which makes it the
     * winner: the page would render your component alone, with every seat the
     * frame declares gone. For a surface of your own that floats over the whole
     * app, register into `shell.overlay` instead (a list slot: additive, and
     * click-through until your entry opts into pointer events).
     */
    'root': {
      kind: 'single';
      scope: 'root';
      owner: RootOwnerProps;
    };
  }
}
/** Root owner share: the shell supplies nothing — the frame is inject-assembled. */
interface RootOwnerProps {
  children?: never;
}
/** One synchronous effect installed while an injected slot declaration is live. */
type SlotInjectionEffect = (() => void) | Iterable<() => void, void, void>;
/** cordis Service layer of the slot system; see the module doc for the split with SlotCore. */
declare class SlotRegistry extends Service {
  private readonly _core;
  /** Store-instance axis: handle -> mounted scope, refcount, resolved instances. */
  private readonly _stores;
  private _renderer;
  private _locale;
  private _host;
  /**
   * @param ctx - owning root context.
   */
  constructor(ctx: Context);
  /**
   * The single registration API. The typed face IS the core's register
   * (both overloads reused verbatim — one authority, no structural copy;
   * see SlotCore.register for children declaration, store seat, inject
   * face, load-time validation, and the unload cascade). This layer adds:
   * disposal through the caller's ctx.effect (fiber unload = cascade),
   * exclusive-factory minting (`store: createXxxStore` becomes a per-entry
   * handle), the registrant diagnostics stamp, and store-instance lifecycle
   * on the entry axis.
   *
   * Declared here, implemented by prototype assignment below the class: it
   * MUST stay a prototype method (never an instance arrow) — the cordis
   * service proxy binds `this.ctx` to the CALLER's context at call time,
   * which is what routes the effect (and the unload cascade) into the
   * caller's fiber. An arrow property would freeze `this` to the service's
   * own root ctx and silently break per-plugin disposal.
   */
  readonly register: SlotCore['register'];
  /**
   * Install an effect for each declaration lifetime of a slot. The callback
   * runs synchronously when the declaration already exists; otherwise it runs
   * inside the declaring `register()` call after the declaration is committed.
   * Collapse disposes the effect and a later declaration runs it again.
   * Callback effects are synchronous disposers; iterable effects install
   * transactionally and dispose in reverse order. The controller belongs to
   * the caller's fiber, so plugin unload cancels a pending wait and removes any
   * active contribution.
   *
   * @param key - declared SlotMap key to depend on.
   * @param callback - creates one disposer or an iterable of disposers.
   * @returns idempotent disposer for the wait and active effect.
   * @throws callback setup failures synchronously when the slot is already declared.
   */
  inject(key: keyof SlotMap & string, callback: () => SlotInjectionEffect): () => void;
  /**
   * Install the shell's renderer (web-react's createSlotRenderer product).
   * Boot-once: a second install throws. Runs through the caller's ctx.effect,
   * so shell fiber unload uninstalls the renderer.
   * @param renderer - the outlet machinery implementing SlotRenderer.
   */
  install(renderer: SlotRenderer): void;
  /**
   * Install the locale face backing the `t` standard seat (the locale
   * plugin's product; same boot-once discipline as the renderer install).
   * Runs through the caller's ctx.effect, so the installing fiber's unload
   * uninstalls the face.
   * @param face - namespace binder + revision observable.
   */
  installLocale(face: LocaleFace): void;
  /**
   * The single ctx-level render entry: the shell renders 'root'; every other
   * key renders inside components through the props renderSlot face. All
   * three guards are fail-loud boot-order checks, no fallback.
   * @param key - must be 'root' (runtime-enforced for dynamically composed callers).
   * @param owner - owner share for the root entry (the shell supplies {}).
   * @returns the rendered root tree.
   */
  renderSlot<K extends keyof SlotMap & string>(key: K, owner: OwnerOf<K>): ReturnType<SlotRenderer['renderRoot']>;
  /**
   * Drop the per-session store instances of a dead session (the sessions
   * service calls this on scope teardown; root-scoped records are untouched).
   * Persisted state goes with the session — a never-rendered dead session can
   * still own keys from an earlier page load, so the instance is materialized
   * transiently just to clear storage (no-op for unpersisted stores).
   * @param sessionId - the torn-down session.
   */
  pruneStoreScope(sessionId: string): void;
  /**
   * Snapshot entries for a key (render-erased view; stable reference between mutations).
   * @param key - SlotMap key.
   * @returns registered entries.
   */
  entries(key: keyof SlotMap & string): readonly StoredEntry[];
  /**
   * Shadowing winners per cell for a key: the first live (non-abdicated)
   * entry of each cell in priority order — what outlets render; chain keys
   * pass through unchanged (election consumes every entry). The raw
   * {@link SlotsService.entries} view stays the inspection surface. Fresh
   * array per call, not a uSES getSnapshot source.
   * @param key - SlotMap key.
   * @returns the winning entry per occupied cell.
   */
  entriesOfSlot(key: keyof SlotMap & string): readonly StoredEntry[];
  /**
   * Export the current JSON-safe Slot declaration tree for read-only inspection.
   * @param root - exact live Slot root; omitted returns all roots.
   * @returns selected Slot trees.
   */
  snapshot(root?: string): LiveSlotNode[];
  /**
   * Observe entry boundary crashes (every render-time entry failure the
   * boundaries contain, abdicating or not) — the supervision seam for
   * plugins mirroring contribution health. Fires synchronously per report,
   * after the registry mutated for abdicating crashes. Callers own the
   * disposer (wire it through ctx.effect for fiber-lifetime cleanup, as with
   * {@link SlotsService.subscribe}).
   * @param fn - called with the slot key, the crashed entry, the crash
   * cause, and `abdicated`: whether the crash retired the entry from its cell.
   * @returns unsubscribe.
   */
  onEntryError(fn: (key: string, entry: StoredEntry, error: unknown, info: {
    abdicated: boolean;
  }) => void): () => void;
  /**
   * Look up a declared spec (register-declared or the built-in 'root').
   * @param key - SlotMap key.
   * @returns spec or undefined.
   */
  spec<K extends keyof SlotMap & string>(key: K): SlotSpec<SlotMap[K]> | undefined;
  /**
   * Subscribe to a key's registration changes (microtask-batched).
   * @param key - SlotMap key.
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe(key: keyof SlotMap & string, fn: () => void): () => void;
  /**
   * Version counter for uSES pairing.
   * @param key - SlotMap key.
   * @returns current version.
   */
  getVersion(key: keyof SlotMap & string): number;
  /** Delegating registration path: factory minting + registrant stamp + core write + instance-axis bookkeeping. */
  private _register;
  /** Build once after both object-layer services mount; per-session provide bundles still resolve lazily. */
  private hostFace;
  /** Resolve (create or reuse) the store instance for a registered handle under a scope key. */
  private resolveStore;
  /** Bind (or re-reference) a handle on the axis; cross-scope conflicts already threw in the core. */
  private _acquire;
  /** Drop one reference; the last holder's unload drops the record (instances go with it — engine stores need no explicit dispose). */
  private _release;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/contract/conversation.d.ts
/** One raw log event plus its optional envelope-level presentation view. */
interface ConversationEventInput {
  readonly event: SessionEvent;
  readonly view: ToolEventView | undefined;
}
/** Definition-local identity and lifecycle role extracted from one event. */
interface ConversationMatchResult {
  readonly id: string;
  readonly role: 'start' | 'update';
}
/** Merge-extensible business values published against one Turn. */
interface ConversationTurnDataMap {}
/** Merge-extensible business values published against one Step. */
interface ConversationStepDataMap {}
/** Stable keyed reader for independently owned Location business values. */
interface ConversationLocationDataStore<DataMap extends object> {
  /**
   * Read one business value without exposing another owner's mutable State.
   * @param key - declaration-merged business key.
   * @returns latest immutable value, when its owning Context has published one.
   */
  get<Key extends keyof DataMap & string>(key: Key): Readonly<DataMap[Key]> | undefined;
}
interface ConversationLocationDataValue {
  readonly kind: 'turn' | 'step';
  readonly turn: number;
  readonly step?: number;
  readonly key: string;
  readonly value: unknown;
}
type RegisteredTurnData = { [Key in keyof ConversationTurnDataMap & string]: {
  readonly kind: 'turn';
  readonly turn: number;
  readonly key: Key;
  readonly value: ConversationTurnDataMap[Key];
}; }[keyof ConversationTurnDataMap & string];
type RegisteredStepData = { [Key in keyof ConversationStepDataMap & string]: {
  readonly kind: 'step';
  readonly turn: number;
  readonly step: number;
  readonly key: Key;
  readonly value: ConversationStepDataMap[Key];
}; }[keyof ConversationStepDataMap & string];
/** One Definition-owned value attached to an Engine-owned Turn or Step. */
type ConversationLocationData = [keyof ConversationTurnDataMap | keyof ConversationStepDataMap] extends [never] ? ConversationLocationDataValue : RegisteredTurnData | RegisteredStepData;
/** Immutable resolved boundary for one Agent step. */
interface StepLocation {
  readonly turn: number;
  readonly step: number;
  readonly start: SessionEvent<'step/start'> | undefined;
  readonly end: SessionEvent<'step/end'> | undefined;
  readonly status: 'open' | 'closed' | 'unknown';
  /** Stable reader for Step-scoped business values. */
  readonly data: ConversationLocationDataStore<ConversationStepDataMap>;
}
/** Immutable resolved boundary for one Agent turn. */
interface TurnLocation {
  readonly turn: number;
  readonly start: SessionEvent<'turn/start'> | undefined;
  readonly end: SessionEvent<'turn/end'> | undefined;
  readonly status: 'open' | 'closed' | 'unknown';
  readonly steps: readonly StepLocation[];
  /** Stable reader for Turn-scoped business values. */
  readonly data: ConversationLocationDataStore<ConversationTurnDataMap>;
}
/** Engine-owned placement of one matched event in the Session hierarchy. */
type ConversationLocation = {
  readonly kind: 'session';
} | {
  readonly kind: 'turn';
  readonly turn: TurnLocation;
} | {
  readonly kind: 'step';
  readonly turn: TurnLocation;
  readonly step: StepLocation;
} | {
  readonly kind: 'unresolved';
};
/** One event accepted by a Definition, with its current resolved Location. */
interface ConversationMatch extends ConversationEventInput {
  readonly role: 'start' | 'update';
  readonly location: ConversationLocation;
}
/** Target-neutral identity returned by a business Definition. */
interface ConversationViewNode {
  readonly key: string;
  readonly kind: string;
  readonly id: string;
  readonly target: string;
  readonly data: unknown;
}
/** Merge-extensible immutable snapshots published by registered view targets. */
interface ConversationViewSnapshotMap {}
/** Stable reader over the latest snapshot of every registered view target. */
interface ConversationViewSnapshotStore {
  /** @param target - registered view target. @returns its current snapshot. */
  get<Target extends Extract<keyof ConversationViewSnapshotMap, string>>(target: Target): ConversationViewSnapshotMap[Target] | undefined;
}
/** Final Chat render unit produced directly by a business Definition. */
interface ChatConversationViewNode extends ConversationViewNode {
  readonly target: 'chat';
  readonly anchorSeq: number;
  readonly location: ConversationLocation;
  readonly visibility: 'visible' | 'hidden';
}
/** Immutable public view of an assembled business Context. */
interface ConversationNodeContext<State = unknown> {
  readonly key: string;
  readonly kind: string;
  readonly id: string;
  readonly matches: readonly ConversationMatch[];
  readonly start: ConversationMatch | undefined;
  readonly state: State | undefined;
  readonly current: ReadonlyMap<string, ConversationViewNode | null>;
}
/** Read-only predecessor returned to a Definition's start function. */
interface ConversationPreviousContext<State = unknown> {
  readonly key: string;
  readonly kind: string;
  readonly id: string;
  readonly startSeq: number;
  readonly state: Readonly<State>;
  readonly matches: readonly ConversationMatch[];
}
/** Strictly-backward Context lookup available while a start is evaluated. */
interface ConversationContextReader {
  /**
   * Find the active Context of `kind` with the greatest start seq below the
   * current start event.
   * @param kind - Definition kind to query.
   * @returns the nearest predecessor, or undefined when absent in the current window.
   */
  previous<State>(kind: string): ConversationPreviousContext<State> | undefined;
}
/** Requested cadence for materializing updated business State into view Nodes. */
type ConversationPublication = 'none' | 'animation-frame' | 'immediate';
/** Engine-owned Location data publication phase. */
type ConversationLocationDataScope = 'step' | 'turn';
/** One independently registered business Event-to-Node state machine. */
interface ConversationNodeDefinition<State = unknown> {
  readonly kind: string;
  /** Sole view target owned by this Definition; omitted for state-only Contexts. */
  readonly target?: string;
  /**
   * Extract this Definition's stable business identity from one event.
   * @param event - raw Session event; no Context or history access is available.
   * @returns identity and lifecycle role, or null when unrelated.
   */
  match(event: SessionEvent): ConversationMatchResult | null;
  /**
   * Create State from the unique start Match.
   * @param context - complete evidence currently collected for the Context.
   * @param match - the start Match.
   * @param reader - strictly-backward read-only Context lookup.
   * @returns the State adopted by the engine.
   */
  start(context: ConversationNodeContext<State>, match: ConversationMatch, reader: ConversationContextReader): State;
  /**
   * Apply one post-start update Match.
   * @param context - Context with its current State.
   * @param match - update Match in ascending log order.
   * @returns the State adopted by the engine.
   */
  update(context: ConversationNodeContext<State> & {
    readonly state: State;
  }, match: ConversationMatch): State;
  /**
   * Select publication cadence for one accepted Match.
   * @param match - accepted Match.
   * @returns requested cadence; omission defaults to immediate.
   */
  publication?(match: ConversationMatch): ConversationPublication;
  /**
   * Publish this Definition's read-only business value for one Location phase.
   * The Engine evaluates every Definition first for Step and then for Turn,
   * owns replacement/removal, and rejects another Context trying to publish
   * the same Location key.
   * @param context - latest complete Context.
   * @param scope - Location hierarchy level currently being materialized.
   * @returns current Location value, or null while unavailable.
   */
  buildLocationData?(context: ConversationNodeContext<State>, scope: ConversationLocationDataScope): ConversationLocationData | null;
  /**
   * Materialize one final Node for this Definition's declared view target.
   * @param context - latest complete Context.
   * @returns final Node, or null when this Context is not currently visible.
   */
  buildViewNode?(context: ConversationNodeContext<State>): ConversationViewNode | null;
}
/** Reference-stable Turn/Step facts published beside view Nodes. */
interface ConversationTimelineSnapshot {
  readonly turnOrder: readonly number[];
  readonly turns: ReadonlyMap<number, TurnLocation>;
}
/** Per-Session incremental builder for one view target. */
interface ConversationViewBuilder<Node extends ConversationViewNode = ConversationViewNode, Snapshot = unknown> {
  readonly empty: Snapshot;
  /**
   * Replace the low-frequency complete materialized Node set.
   * @param input - complete Nodes and current timeline.
   * @returns next view snapshot.
   */
  replace(input: {
    readonly nodes: readonly Node[];
    readonly timeline: ConversationTimelineSnapshot;
  }): Snapshot;
  /**
   * Apply only Nodes whose materialized values changed in this transaction.
   * @param input - changed Nodes and current timeline.
   * @returns next view snapshot.
   */
  apply(input: {
    readonly upserts: readonly Node[];
    readonly timeline: ConversationTimelineSnapshot;
  }): Snapshot;
}
/** Registry contribution that creates one isolated view builder per Session. */
interface ConversationViewDefinition<Node extends ConversationViewNode = ConversationViewNode, Snapshot = unknown> {
  readonly target: string;
  /** @returns a new Session-owned incremental builder. */
  create(): ConversationViewBuilder<Node, Snapshot>;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/conversation/definition-registry.d.ts
/** Shared lifecycle and stable-entry storage for one Conversation Definition registry. */
declare abstract class ConversationDefinitionRegistry<Definition> extends Service {
  protected readonly definitions: Map<string, Definition>;
  private listeners;
  private cached;
  /**
   * Return reference-stable Definitions in registration order.
   * @returns current Definitions.
   */
  entries(): readonly Definition[];
  /**
   * Observe low-frequency registry changes.
   * @param listener - synchronous invalidation callback.
   * @returns unsubscribe callback.
   */
  subscribe(listener: () => void): () => void;
  /**
   * Register one uniquely keyed Definition for the caller's lifetime.
   * @param key - registry-local unique key.
   * @param definition - contributed Definition.
   * @param duplicateMessage - error raised when the key is already owned.
   * @param effectName - Cordis effect diagnostic label.
   * @returns idempotent disposer.
   */
  protected registerDefinition(key: string, definition: Definition, duplicateMessage: string, effectName: string): () => void;
  /** Refresh cached entries and synchronously invalidate subscribers. */
  protected refresh(): void;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/conversation/event-registry.d.ts
/** Runtime registry of independently owned Conversation business Definitions. */
declare class ConversationEventRegistry extends ConversationDefinitionRegistry<ConversationNodeDefinition> {
  private fallback;
  /** @param ctx - owning Client Runtime context. */
  constructor(ctx: Context);
  /**
   * Register a uniquely named business Definition for the caller's lifetime.
   * @param definition - Definition contribution.
   * @returns idempotent disposer.
   */
  register(definition: ConversationNodeDefinition): () => void;
  /**
   * Register the sole fallback used only when no ordinary Definition matches.
   * @param definition - fallback Definition.
   * @returns idempotent disposer.
   */
  registerFallback(definition: ConversationNodeDefinition): () => void;
  /**
   * Return the current unmatched-event fallback.
   * @returns installed fallback, when present.
   */
  fallbackEntry(): ConversationNodeDefinition | undefined;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/conversation/view-registry.d.ts
/** Runtime registry of per-target Conversation snapshot builders. */
declare class ConversationViewRegistry extends ConversationDefinitionRegistry<ConversationViewDefinition> {
  /** @param ctx - owning Client Runtime context. */
  constructor(ctx: Context);
  /**
   * Register a uniquely named view builder factory for the caller's lifetime.
   * @param definition - target builder contribution.
   * @returns idempotent disposer.
   */
  register(definition: ConversationViewDefinition): () => void;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/agents/scope.d.ts
/** Client Cordis Context carrying one Agent identity and its scoped Remote namespaces. */
type AgentContext = Omit<Context, 'remote'> & {
  readonly remote: TypertClientRemote & TypertRemoteScopeApi<'agent'>;
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/sessions/pending.d.ts
/** Kind-keyed payload map: the requested frame's domain fields (envelope fields stripped). */
interface PendingPayloads {
  approval: Omit<Extract<MuxFrame, {
    type: 'approval/requested';
  }>, 'type' | 'sessionId'>;
  question: Omit<Extract<MuxFrame, {
    type: 'question/requested';
  }>, 'type' | 'sessionId'>;
}
/** Pending-interaction discriminant (the keys of PendingPayloads). */
type PendingKind = keyof PendingPayloads;
/** Session-list summary of the user action currently blocking progress. */
type PendingInteractionStatus = 'approval' | 'plan-review' | 'question';
/** Kind-discriminated union of concrete waits: narrowing on `kind` types `payload`. */
type PendingInteraction = { [K in PendingKind]: PendingWait<K>; }[PendingKind];
/**
 * One pending host-owned interaction wait: an immutable render face
 * (kind/key/sessionId/payload) plus the response carrier. respond() backfills
 * the requested frame's rpcId into a client-response envelope — no consumer
 * ever sees the raw rpcId. Settlement is expressed only by pending-list
 * membership (the settled flag is a fail-loud guard, not a render input).
 */
declare class PendingWait<K extends PendingKind = PendingKind> {
  #private;
  /** Interaction kind (union discriminant). */
  readonly kind: K;
  /** Opaque render identity, `<prefix>:<rpcId>` — stable across baseline replay, usable as a React key. */
  readonly key: string;
  /** Owning session. */
  readonly sessionId: SessionId;
  /** The requested frame's domain fields, verbatim. */
  readonly payload: PendingPayloads[K];
  /**
   * Minted by Session on a requested frame (public construction is the test-fixture path).
   * @param kind - interaction kind.
   * @param rpcId - the requested frame's stable envelope id (kept private; respond echoes it).
   * @param sessionId - owning session.
   * @param payload - the requested frame's domain fields.
   * @param respond - the client-response carrier (api.respond).
   */
  constructor(kind: K, rpcId: RpcId, sessionId: SessionId, payload: PendingPayloads[K], respond: (message: ClientResponse) => Promise<RpcReceipt>);
  /**
   * Send a result for this wait: wraps it into the client-response envelope
   * with the rpcId backfilled. Throws synchronously once settled.
   * @param result - the result shell (ok value / error envelope), domain-encoded by the caller.
   * @returns the carrier receipt.
   */
  respond(result: ClientResponse['result']): Promise<RpcReceipt>;
  /** Session-only settlement mark (the authoritative resolved frame arrived); respond() throws afterwards. */
  markSettled(): void;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm-retry@_e484218f3a38d6adf3a9331e336bde33/node_modules/@deepseek-ai/dsh-llm-retry/lib/types/brand.d.ts
/** Stable identity shared by every attempt in one request-step retry chain. */
type RetryId = Branded<'RetryId'>;
/**
 * Brand an implementation-minted retry-chain identity.
 * @param id - opaque retry identity.
 * @returns the same string, branded; no validation is performed.
 */
declare function RetryId(id: string): RetryId;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-llm-retry@_e484218f3a38d6adf3a9331e336bde33/node_modules/@deepseek-ai/dsh-llm-retry/lib/types/types.d.ts
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Durable, non-surface record of one provider-routed retry scheduled after a failed request attempt. */
    'llm/retry': LlmRetryEventData;
    /** Durable transition written after a retry wait succeeds and before the next request attempt starts. */
    'llm/retry-started': LlmRetryStartedEventData;
  }
}
/** Durable payload recorded before one provider-routed model-request retry wait. */
type LlmRetryEventData = {
  retryId: RetryId;
  turn: number;
  step: number;
  provider: string;
  mode: 'normal';
  policyKey: string;
  retry: number;
  maxRetries: number;
  delayMs: number;
  failure: LlmFailure;
} | {
  retryId: RetryId;
  turn: number;
  step: number;
  provider: string;
  mode: 'always';
  policyKey: string;
  retry: number;
  delayMs: number;
  failure: LlmFailure;
};
/** Durable transition recorded after one retry delay completes. */
interface LlmRetryStartedEventData {
  retryId: RetryId;
  turn: number;
  step: number;
  retry: number;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/sessions/context-provenance.d.ts
/**
 * Which model-facing role a logged non-user message plays.
 *
 * `recall` marks material lifted out of another session's log; `inject` marks
 * every other producer-supplied context. Mid-turn steering is the third role
 * the transcript distinguishes, but it has its own event and node kind
 * (`steering/message` / `SteeringMessageNode`) and never reaches here.
 */
type ContextRole = 'inject' | 'recall';
/** Role and producer name presented for one logged non-user message. */
interface ContextProvenanceView {
  /** The role this context plays in the model-facing conversation. */
  role: ContextRole;
  /**
   * Producer name for the row header, taken from the durable source: the
   * instruction paths, the referenced session titles, the plugin id, or the
   * bare source kind for a producer this UI version does not know. Null only
   * when the source carries no readable kind at all.
   */
  label: string | null;
}
/**
 * Context forms this UI version renders with a dedicated presentation. The
 * durable vocabulary (`ContextForm` in `dsh-llm`) may already be wider — an
 * unrecognized or absent value degrades to the opaque presentation rather than
 * dropping the row, so a log written by a newer or foreign producer still
 * renders.
 */
declare const KNOWN_FORMS: readonly ["instructions", "catalog", "snapshot", "notice", "relay", "recall"];
/** One durable context form this UI version knows how to present. */
type KnownContextForm = typeof KNOWN_FORMS[number];
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/sessions/conversation.d.ts
/** Request configuration recorded for one provider call. */
interface AssistantRequestConfig {
  provider: string;
  model: string;
  purpose?: string;
  thinking?: string;
  reasoningEffort?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: readonly string[];
}
/** Stable provider/model identity reported for one completed request. */
interface AssistantProvenanceView {
  provider: string;
  model: string;
}
/** Assistant content blocks sorted by what the UI cares about
 *  (text body / collapsible reasoning / tool-call card head / other fallback). */
type AssistantBlock = {
  kind: 'text';
  text: string;
} | {
  kind: 'reasoning';
  text: string;
} | {
  kind: 'image';
  attachment: ImageAttachmentRef;
} | {
  kind: 'tool-call';
  callId: string;
  name: string;
  argsRaw: string;
} | {
  kind: 'other';
  block: unknown;
};
/** A finalized user message. */
interface UserMessageNode {
  kind: 'user';
  seq: number;
  /** Unix epoch ms from the source session event. */
  time: number;
  content: readonly ContentBlock[];
  source: unknown;
}
/** Recorded boundaries used to derive assistant latency and throughput. */
interface AssistantTiming {
  /** Matching step/start timestamp, or null when it is outside the current event window. */
  stepStartTime: number | null;
  /** First non-empty text/reasoning/tool delta timestamp, or null when no token delta was recorded. */
  firstTokenTime: number | null;
  /** Final assistant/message timestamp. */
  completedTime: number;
}
/** A finalized (or interruption-frozen) assistant message. */
interface AssistantMessageNode {
  kind: 'assistant';
  seq: number;
  /**
   * Stable identity of the finalized model output, carried from the
   * `assistant/message` event. Absent on interruption-frozen partials: those
   * were never finalized, so they address no durable message.
   */
  messageId?: MessageId;
  /** Unix epoch ms from the source session event (or turn/end when frozen from a partial). */
  time: number;
  turn: number;
  step: number;
  blocks: readonly AssistantBlock[];
  usage?: unknown;
  provenance?: AssistantProvenanceView;
  requestConfig?: AssistantRequestConfig;
  /** Timing derived from the recorded step/chunk/message event sequence. */
  timing?: AssistantTiming;
  /** Frozen partial of an aborted turn (no finalize ever arrives): rendered with a 已停止 marker.
   *  Synthetic seq (fractional, derived from the turn/end seq) keeps it ordered inside the flow. */
  interrupted?: true;
}
/** A human message admitted from the next-step inbox while a turn was running. */
interface SteeringMessageNode {
  kind: 'steering';
  /** Stable message identity shared with its pre-admission inbox occurrence. */
  messageId: MessageId;
  seq: number;
  /** Unix epoch ms from the source session event. */
  time: number;
  content: readonly ContentBlock[];
  source: unknown;
}
/** A context/system injection surfaced in the flow. */
interface ContextMessageNode {
  kind: 'context';
  seq: number;
  /** Unix epoch ms from the source session event. */
  time: number;
  content: readonly ContentBlock[];
  source: unknown;
  /** Role and producer name projected from `source` ({@link contextProvenance}). */
  provenance: ContextProvenanceView;
  /** Producer-declared information form ({@link contextForm}); null presents as opaque. */
  form: KnownContextForm | null;
}
/** Durable notice that a closed failed step is waiting for a model-request retry. */
type ModelRetryNode = LlmRetryEventData & {
  kind: 'model-retry';
  seq: number;
  /** Unix epoch ms from the llm/retry session event. */
  time: number;
  /**
   * Client-derived lifecycle: scheduled until a retry turn starts, started
   * once it does, or cancelled when the failed turn aborts first.
   */
  retryState: 'scheduled' | 'started' | 'cancelled';
};
/** Durable terminal failure for a turn that has no scheduled retry. */
interface TurnErrorNode {
  kind: 'turn-error';
  /** Seq of the owning turn/end event. */
  seq: number;
  /** Unix epoch ms from the turn/end event. */
  time: number;
  turn: number;
  step: number;
  message: string;
  code?: string;
}
/** Durable notice for a turn ended by the per-request output-token cap. */
interface TurnMaxTokensNode {
  kind: 'turn-max-tokens';
  /** Seq of the owning turn/end event. */
  seq: number;
  /** Unix epoch ms from the turn/end event. */
  time: number;
  turn: number;
  step: number;
}
/** A tool result paired (when in-window) with its call head. */
interface ToolResultNode {
  kind: 'tool-result';
  seq: number;
  /** Unix epoch ms from the tool/result session event. */
  time: number;
  callId: string;
  /** Call head backfilled from the in-window tool/call; null when window truncation left the call outside (card head shows callId). */
  call: {
    name: string;
    argsRaw: string;
  } | null;
  /** Unix epoch ms of the paired tool/call when the call is still in-window; used for call-row duration. */
  callTime: number | null;
  content: readonly ContentBlock[];
  isError: boolean;
  error?: {
    name: string;
    code: string;
  };
  meta?: unknown;
  /** Host-computed render intent from the paired tool/call's wire view; null = generic JSON card (documented default). */
  callView: ToolCallView | null;
  /** Host-computed render intent from this tool/result's wire view; null = same default. */
  resultView: ToolResultView | null;
  /** Child calls owned by this call, in dispatch order. */
  subCalls: readonly ToolCallBlock[];
}
/**
 * One landed compaction, marked at the checkpoint's own log position. The
 * conversation it shadowed on the model surface stays in the transcript above
 * it: the marker reports where the model stopped seeing that history, it does
 * not replace it. The framed checkpoint payload is an instruction envelope
 * written for the model and never renders.
 */
interface CompactionSummaryNode {
  kind: 'compaction';
  /** Seq of the replacement `user/message` that landed the checkpoint. */
  seq: number;
  /** Unix epoch ms of the checkpoint event. */
  time: number;
  /** Summary text from the checkpoint's cited `compaction/summary` event; null when
   *  the window cut left that event outside (the marker is then not expandable). */
  summary: string | null;
  /** Seq of the loaded `compaction/summary` event, or null when that event is outside the window. */
  summaryEventSeq: number | null;
  /** Number of surface items replaced, or null when the summary event is unavailable or malformed. */
  shadowedItemCount: number | null;
  /** Estimated token price of the replaced items, or null when the summary event is unavailable or malformed. */
  shadowedTokenCount: number | null;
}
/**
 * Fallback for surface events this UI version does not know: the documented
 * default arm of `SessionEventMap`, which is merge-extensible, so the
 * projection's switch cannot end in `assertNever`. No event produces this node
 * today — `isAppendSurfaceEvent` admits only the three types in core's
 * `SurfaceEventType`, and each has its own arm — and it exists so widening that
 * set core-side degrades to a raw row instead of dropping the event silently.
 */
interface UnknownSurfaceNode {
  kind: 'unknown';
  seq: number;
  /** Unix epoch ms from the source session event when known. */
  time: number;
  type: string;
  data: unknown;
}
/**
 * One slash-command lifecycle folded from the log-only `command/run` /
 * `command/done` pair (paired by commandId, mirroring tool call↔result).
 * Log-only events are not surface events, so the command Definition indexes
 * them separately and the Chat builder orders the resulting node by seq. A window cut
 * between the pair soft-falls like tool pairs: a done with no in-window run
 * still builds a node (name/args null), and a run with no done renders as
 * still executing.
 */
interface CommandNode {
  kind: 'command';
  /** Seq of the command/run event; the done event's seq when only the done is in-window. */
  seq: number;
  /** Unix epoch ms of the anchoring event. */
  time: number;
  /** Pairing id minted by the host executor. */
  commandId: CommandId;
  /** Command name (run payload's structured field); null when the run fell outside the window. */
  name: string | null;
  /**
   * Verbatim rawInput after the name, including separator whitespace; null
   * when omitted by the command or when the run fell outside the window.
   */
  args: string | null;
  /** Settlement outcome (done payload); null while the command is still executing. */
  outcome: {
    kind: 'success' | 'error';
    text?: string;
    /** Earlier authoritative domain event for a richer client-computed presentation. */
    sourceEventSeq?: number;
  } | null;
}
/** Finalized conversation node union (kind discriminates; seq is the React key). */
type ConversationNode = UserMessageNode | AssistantMessageNode | SteeringMessageNode | ContextMessageNode | ModelRetryNode | TurnErrorNode | TurnMaxTokensNode | ToolResultNode | CommandNode | CompactionSummaryNode | UnknownSurfaceNode;
/** In-flight tool card material: tool/call seen, tool/result not yet. */
interface RunningToolCall {
  callId: string;
  name: string;
  argsRaw: string;
  turn: number;
  step: number;
  /** Unix epoch ms when the tool/call event was logged. */
  time: number;
  /** Host-computed render intent riding the tool/call frame; null = generic JSON card. */
  callView: ToolCallView | null;
  /** Child calls owned by this call, in dispatch order. */
  subCalls: readonly ToolCallBlock[];
}
/** One running or settled call, recursively owning its child calls. */
type ToolCallBlock = RunningToolCall | ToolResultNode;
/** One transient inbox occurrence from the authoritative `session/queue` snapshot. */
interface QueuedMessage {
  readonly id: MessageId;
  /** Stable message identity used for transient-to-durable steering handoff. */
  readonly messageId: MessageId;
  /** Agent-resolved placement; only queued rows accept queue mutations. */
  readonly placement: 'queued' | 'steering' | 'context';
  /** Complete content used to render pending steering before it becomes durable. */
  readonly content: readonly ContentBlock[];
  readonly preview: string;
  /** Complete editable text; null when the message contains non-text blocks. */
  readonly text: string | null;
}
/** In-progress assistant output (chunk accumulator product). */
interface PartialAssistant {
  turn: number;
  step: number;
  blocks: readonly AssistantBlock[];
}
/** History-open lifecycle of a Session window. */
type OpenState = 'cold' | 'loading' | 'open' | 'error';
/**
 * Input-area shape of an OPEN session, derived at snapshot assembly (the one
 * place that knows the predicate — consumers switch, never re-derive):
 *
 * - `blank`: the authoritative blank bit is still set and no prompt was
 *   attempted — the UI renders the blank-session guidance hero.
 * - `engaging`: a first prompt was attempted, but no accepted turn or other
 *   authoritative activity signal has arrived — the UI keeps the composer
 *   visible through admission and error frames.
 * - `active`: the session is non-blank beyond its pending first prompt,
 *   contains visible non-command Chat content, is running, or owns a pending
 *   interaction — the ordinary conversation view.
 *
 * A failed first prompt stays `engaging` (composer + error strip — retry
 * semantics; returning to the hero would discard the error context).
 * Sessions whose window is not open (`loading`/`error`) are outside phase
 * jurisdiction: consumers branch on {@link ConversationSnapshot.openState}
 * first.
 */
type ComposerPhase = 'blank' | 'engaging' | 'active';
/** Send/stop failure surfaced in the input error strip; op picks the user-facing copy (发送失败 vs 停止失败). */
interface PromptError {
  op: 'send' | 'stop';
  error: RpcError;
}
/**
 * Stable live per-key reader. An old ChatSnapshot observes later flushes
 * through this store.
 */
interface ChatNodeStore {
  /** @param key - stable Conversation Context key. @returns current Node, when visible or hidden. */
  get(key: string): ChatConversationViewNode | undefined;
  /** @returns all currently materialized Nodes without imposing render order. */
  values(): readonly ChatConversationViewNode[];
}
/**
 * Stable live Location index. An old ChatSnapshot observes later membership
 * changes through this index.
 */
interface ChatLocationNodeIndex {
  /** @param turn - owning turn. @returns ordered Chat Node keys in the turn. */
  getTurn(turn: number): readonly string[];
  /** @param turn - owning turn. @param step - owning step. @returns ordered Chat Node keys in the step. */
  getStep(turn: number, step: number): readonly string[];
}
/** Compatibility projection backing StatsLine and the legacy top-level snapshot fields. */
interface LegacyConversationSlice {
  readonly nodes: readonly ConversationNode[];
  readonly turnTimings: ReadonlyMap<number, {
    readonly startTime: number;
    readonly endTime?: number;
  }>;
  readonly turnEnds: ReadonlyMap<number, number>;
  readonly partial: PartialAssistant | null;
  readonly runningCalls: readonly RunningToolCall[];
}
/** Incremental Chat publication with immutable order and stable live keyed readers. */
interface ChatSnapshot {
  readonly order: readonly string[];
  readonly nodes: ChatNodeStore;
  readonly locations: ChatLocationNodeIndex;
  readonly timeline: ConversationTimelineSnapshot;
  readonly legacy: LegacyConversationSlice;
}
/** The immutable snapshot contract Session hands to uSES (see the web client architecture RFC). */
interface ConversationSnapshot {
  sessionId: SessionId;
  /** Registered target snapshots assembled from Session events. */
  views: ConversationViewSnapshotStore;
  /** Final Chat target assembled from independently registered business Definitions. */
  chat: ChatSnapshot;
  /** Legacy top-level compatibility field mirrored from the registered Chat Definitions. */
  nodes: readonly ConversationNode[];
  /** Exact in-window `turn/start` time and optional matching `turn/end` time. */
  turnTimings: ReadonlyMap<number, {
    readonly startTime: number;
    readonly endTime?: number;
  }>;
  /** In-window completed turn number -> its `turn/end` event seq. */
  turnEnds: ReadonlyMap<number, number>;
  partial: PartialAssistant | null;
  runningCalls: readonly RunningToolCall[];
  pending: readonly PendingInteraction[];
  /** Authoritative transient inbox snapshot, including queued and steering placements. */
  queue: readonly QueuedMessage[];
  running: boolean;
  /**
   * Catalog-discovered continuation address. Its parent availability controls
   * human input; null means ordinary session transport.
   */
  subagent: {
    address: SubagentAddress;
    parentAvailable: boolean;
  } | null;
  /** Input-area shape (see {@link ComposerPhase}); derived here, switched on by consumers. */
  composerPhase: ComposerPhase;
  /** Set after host/session-removed; the UI grays out and disables input. */
  removed: boolean;
  openState: OpenState;
  openError: RpcError | null;
  hasMore: boolean;
  loadingOlder: boolean;
  promptError: PromptError | null;
  /**
   * Whether this session still has an empty log (no user message yet).
   * Mirrors the host summary's derived blank bit: seeded from `session.list`
   * / the `host/session-added` frame, flipped false by the first ACCEPTED
   * prompt locally (on the RPC success response — acceptance proves the
   * user message is in the host log; a rejected first prompt keeps the
   * session blank and reusable) and by any `running: true` status remotely,
   * and re-aligned by every list re-pull (the summary stays authoritative).
   * Blank sessions are hidden from session lists and reused by New Session.
   */
  blank: boolean;
  lastAgentError: string | null;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/contract/session.d.ts
/** Key-addressed projection read face (the useProjection resolution path; see ProjectionValueStore). */
interface ProjectionsFace {
  /**
   * The identity-stable bare observable for one projection key (absence is
   * an `undefined` snapshot, never a missing face).
   * @param key - projection key.
   * @returns the key's value face.
   */
  faceOf(key: string): ObservableSnapshot<unknown>;
}
/** Identity plus the behavior verbs features may invoke on a session. */
interface ISession {
  /** The session's host identity (agent id — same axis). */
  readonly sessionId: SessionId;
  /** Host-computed projection values by key (the useProjection seat). */
  readonly projections: ProjectionsFace;
  /**
   * Send a prompt into the session.
   * @param content - text plus browser-owned temporary image uploads.
   * @param mode - 'queue' appends a turn; 'steer' interrupts the running one.
   * @returns acceptance, or the business error (also mirrored into snapshot.promptError).
   */
  prompt(content: PromptContentPart[], mode: 'queue' | 'steer'): Promise<RpcResult<{
    accepted: true;
  }>>;
  /**
   * Resolve one durable image referenced by this session.
   * @param attachmentId - opaque id found in the folded session log.
   * @returns the authenticated reference and decoded bytes.
   */
  readAttachment(attachmentId: AttachmentId): Promise<RpcResult<{
    attachment: ImageAttachmentRef;
    data: Uint8Array;
  }>>;
  /**
   * Apply one edit, remove, or strict steer action to a still-pending queue occurrence.
   * @param itemId - agent-owned inbox occurrence identity.
   * @param action - requested queue operation.
   * @returns acceptance, or a business/transport error.
   */
  updateQueue(itemId: MessageId, action: QueueAction): Promise<RpcResult<{
    accepted: true;
  }>>;
  /**
   * Cancel the running turn. Pending queued work remains and resumes in FIFO
   * order after the Host reaches cancellation quiescence.
   * @returns acceptance, or the business error.
   */
  cancel(): Promise<RpcResult<{
    accepted: true;
  }>>;
  /**
   * Rename this session (explicit user title; pins it against automatic
   * regeneration).
   * @param title - raw title text (the host normalizes acceptance).
   * @returns the normalized accepted title and its event seq, or the business error.
   */
  rename(title: string): Promise<RpcResult<{
    title: string;
    seq: number;
  }>>;
  /**
   * Extend the history window backwards (older messages pagination).
   * @returns completion; failures land in snapshot.openState/loadingOlder.
   */
  loadOlder(): Promise<void>;
  /**
   * Execute one slash-command line against this session's agent — pure
   * admission semantics (the host executor durably logs the lifecycle).
   * @param line - the full command line, leading slash included.
   * @returns the admission result, or the Remote face's error branch.
   */
  command(line: string): Promise<RemoteResult<{
    matched: boolean;
  }>>;
}
/**
 * The full outward face: behavior verbs plus the conversation read side
 * (the `useSession` hook source). This is the type carried by
 * `SessionBinding.session` and the provide channel.
 */
type SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/sessions/projection-store.d.ts
/**
 * The fifth framework hook seat (see the session-projection subsystem page,
 * docs/subsystems/session-projection.md): key-addressed
 * projection reader delivered through the standard kit. `undefined` uniformly
 * means capability absent — host unit unmounted, or no baseline/frame has
 * carried the key yet. The selector overload mirrors useSession (per-key uSES
 * binding; reference stability holds because a key's value reference changes
 * only when a frame or baseline lands).
 */
type UseProjection = {
  <K extends Extract<keyof SessionProjectionMap, string>>(key: K): SessionProjectionMap[K] | undefined;
  <K extends Extract<keyof SessionProjectionMap, string>, S>(key: K, selector: (value: SessionProjectionMap[K] | undefined) => S, eq?: (a: S, b: S) => boolean): S;
};
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/sessions/manager.d.ts
/**
 * List arrival lifecycle, orthogonal to the pull-activity `state` axis:
 * `pending` (no successful pull yet — an empty items array means "nothing
 * arrived", not "nothing exists") → `ready` (at least one pull landed).
 * Monotone: `ready` never steps back — later pull failures and reconnect
 * re-pulls ride the `state`/`error` axis, which is where failure is modeled
 * (no `error` phase here; that would duplicate `state`).
 */
type SessionListPhase = 'pending' | 'ready';
/** Request-local content hit returned to sidebar search consumers. */
interface SessionSearchResultItem {
  sessionId: SessionId;
  snippet: string;
}
/** One parent-addressed durable catalog projected through the sessions snapshot. */
interface SubagentCatalogSnapshot extends SubagentCatalog {
  state: 'loading' | 'ready' | 'error';
  error: RpcError | null;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/sessions/service.d.ts
/** Session list row projected from the host list RPC plus live stream increments. */
interface SessionSummary {
  id: SessionId;
  /** Latest durable log-backed title, absent until the host projects one. */
  title?: string;
  /** Human-facing label: durable title, project basename, then session id. */
  displayTitle: string;
  cwd?: string;
  /**
   * Agent preset this session's agent was composed from; absent when the
   * deployment composes no presets. The session header labels what the
   * session actually runs rather than the deployment's current default.
   */
  agentPreset?: string;
  parentId?: SessionId;
  /** Coarse durable origin for navigation filtering; not a continuation capability. */
  origin?: 'subagent';
  running: boolean;
  /** User interaction currently blocking this session (sidebar amber-dot state). */
  pendingInteraction?: PendingInteractionStatus;
  /** Finished while not selected and not yet opened — the sidebar's green "done" reminder. Absent = false. */
  completed?: boolean;
  /**
   * Empty-log bit (host summary derivation mirror). New Session reuses a blank
   * one targeting the same workspace. Filtering stays with the consumer: the
   * store carries every row, while the Workspace browser shows only the
   * selected blank entry.
   */
  blank: boolean;
  updatedAt: number;
  /** Current host-computed projection values retained by the object layer. */
  projectionValues?: Readonly<Partial<SessionProjectionMap>>;
}
/**
 * Session list store shape. `current` rides the same snapshot (arbitrated:
 * the single useSessions standard hook reads list and selection together —
 * sidebar highlighting and SessionProvider share one fact source).
 */
interface SessionListState {
  /** Host-list order; addressed breadcrumb-only rows are excluded. */
  ids: SessionId[];
  /** Host rows plus the current addressed subagent route used by navigation. */
  byId: Record<SessionId, SessionSummary>;
  current: SessionId | undefined;
  /** Arrival lifecycle projected 1:1 from the manager snapshot (see SessionListPhase): empty-with-ready means "truly no sessions". */
  phase: SessionListPhase;
  /** Direct durable catalogs keyed by their selected parent address. */
  subagentsByParent: Readonly<Record<SessionId, SubagentCatalogSnapshot>>;
  /**
   * Background jobs each session can see, mirrored last-wins from
   * `session/jobs`. A missing key is an empty set — the Host sends no baseline
   * for a session without tasks — so consumers read absence, never a sentinel.
   */
  jobsBySession: Readonly<Record<SessionId, readonly JobView[]>>;
  /** Current session's catalog-derived address, absent on ordinary navigation. */
  currentAddress: SubagentAddress | undefined;
}
/** Session assembly handle for SessionProvider/inject factories (identity-stable per session). */
interface SessionBinding {
  readonly sessionId: SessionId;
  /** The outward session face only — feature code never sees the concrete class. */
  readonly session: SessionFace;
  readonly ctx: AgentContext;
}
/** One plugin's per-session standard-props contribution (see {@link SessionRuntime.provide}). */
interface SessionProvideContribution {
  /** Bare observable sources, keyed by hook base name ('input' → useInput). */
  hooks?: Record<string, HostObservable<unknown>>;
  /** Stable plain members (action callbacks etc.), spread into standard props verbatim. */
  props?: Record<string, unknown>;
}
/**
 * Static declaration plus per-session resolver for one standard-kit
 * contribution. The declared names let the renderer construct the same hook
 * and prop surface while no session is current.
 */
interface SessionProvideDescriptor {
  /** Hook base names (`input` becomes `useInput`). */
  hooks?: readonly string[];
  /** Plain standard-prop names. */
  props?: readonly string[];
  /** Resolve every declared member for one definite session. */
  resolve(binding: SessionBinding): SessionProvideContribution;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/contract/sessions.d.ts
/** The sessions-service face injected as `ctx.sessions`. */
interface ISessions {
  /** The useSessions standard feed (list rows + current selection; read face — writes stay inside the domain). */
  readonly list: ObservableSnapshot<SessionListState>;
  /** Atomic current-session provide projection (the renderer host's `sessions.provideInfo` feed). */
  readonly currentProvideInfo: HostObservable<SessionMaybeProvideInfo>;
  /**
   * The `session.search` result bound the wire schema fixes, exposed to
   * presentation as injected data. Not per-connection state: every transport
   * (fixture included) reports the same number.
   */
  readonly searchResultLimit: number;
  /**
   * Select a session as current.
   * @param id - session id (must exist in the list; unknown ids fail loud).
   */
  open(id: SessionId): void;
  /**
   * Open a healthy catalog child through its exact direct-parent address.
   * @param address - catalog-derived parent and child ids.
   */
  openSubagent(address: SubagentAddress): void;
  /**
   * Resolve an already discovered direct-parent address without opening it.
   * @param id - possible addressed child id.
   * @returns the retained address, when present.
   */
  subagentAddress(id: SessionId): SubagentAddress | undefined;
  /**
   * Mark whether a catalog menu is consuming live membership updates.
   * @param parentSessionId - catalog owner.
   * @param open - current menu state.
   */
  setSubagentCatalogOpen(parentSessionId: SessionId, open: boolean): void;
  /**
   * Refresh one direct-child catalog.
   * @param parentSessionId - catalog owner.
   * @returns completion of the current or newly started refresh.
   */
  refreshSubagents(parentSessionId: SessionId): Promise<void>;
  /**
   * Record the composition one session now runs. The agent-preset seat calls
   * this after a successful blank-session switch, so the header label moves
   * with the composition instead of waiting for the next full list refresh.
   * @param sessionId - the switched session.
   * @param agentPreset - the preset id the host confirmed.
   */
  noteAgentPreset(sessionId: SessionId, agentPreset: string): void;
  /** Clear the current selection into the no-session view state. */
  clear(): void;
  /**
   * Search the Host's visible message-content index. Results stay
   * request-local; the list snapshot remains the metadata authority.
   * @param query - non-blank literal phrase.
   * @param signal - cancellation for a superseded search.
   * @returns bounded results, or a business/transport error.
   */
  search(query: string, signal: AbortSignal): Promise<RpcResult<{
    items: SessionSearchResultItem[];
    hasMore: boolean;
  }>>;
  /**
   * Fork a session from a completed-turn prefix of the source; on resolution
   * the child is in the list store and `open()` can target it.
   * @param opts - source session id, the optional event seq anchoring the
   *   cut (the boundary is the first turn/end at or after it; an in-log
   *   anchor in an open turn is unavailable rather than clipped backward),
   *   and whether to increment an inherited durable title before resolving.
   * @returns the child session id.
   * @throws when the fork fails, or when a requested child-title rename fails after creation.
   */
  fork(opts: {
    sessionId: SessionId;
    atSeq?: number;
    increaseTitle?: boolean;
  }): Promise<SessionId>;
  /**
   * Register a per-session standard-props provider (hooks become `use<Name>`
   * selector hooks on the render side; props spread verbatim).
   * @param descriptor - static member roster plus per-session resolver.
   * @returns disposer removing the provider.
   */
  provide(descriptor: SessionProvideDescriptor): () => void;
  /**
   * Resolve an Agent-scoped context view (use-and-discard).
   * @param id - session id.
   * @returns scoped ctx, or undefined for a session neither listed nor already scoped.
   */
  scope(id: SessionId): AgentContext | undefined;
  /**
   * Read the Agent scope tag off a context (service-method boundary: fetch
   * bundles must reach scope resolution through ctx.sessions).
   * @param ctx - any client context.
   * @returns the session id, or undefined on root contexts.
   */
  scopeOf(ctx: Context): SessionId | undefined;
  /**
   * Resolve the session face behind an Agent-scoped context.
   * @param ctx - an Agent-scoped context.
   * @returns the session face, or undefined when the ctx is untagged or its scope was pruned.
   */
  sessionOf(ctx: Context): SessionFace | undefined;
  /**
   * Resolve the stable session binding (scope-addressed assembly feed).
   * @param id - session id.
   * @returns binding, or undefined for a session neither listed nor already scoped.
   */
  binding(id: SessionId): SessionBinding | undefined;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-client-run_992988c3038b0adbe511e9d3faa7a240/node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/index.d.ts
/** Client-side Cordis context after declaration merging. */
type ClientContext = Context;
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertContextMap {
    /** Client Agent scope identity; the agent and session share one wire id. */
    agent: TypertContext<SessionId>;
  }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  /**
   * Session standard kit, real members (ui-slots declares the empty seat;
   * the runtime — where the subjects live — merges the concrete types):
   * every session-scope slot component receives these from the framework.
   */
  interface SessionStandardProps {
    useSession: SnapshotSelectorHook<ConversationSnapshot>;
    /** The framework-resolved session id (owners never pass it). */
    sessionId: SessionId;
    /** The fifth framework hook seat: key-addressed projection reader (undefined = capability absent). */
    useProjection: UseProjection;
  }
  /** Standard kit for slots that remain mounted while current session changes. */
  interface SessionMaybeStandardProps {
    useSession: MaybeSnapshotSelectorHook<ConversationSnapshot>;
    /** Current session id; absent in the no-session state. */
    sessionId: SessionId | undefined;
    /** Key-addressed projection reader; every key reads absent while no session is current. */
    useProjection: UseProjection;
  }
  /** Props injected into every global slot component. */
  interface GlobalStandardProps {
    useSessions: SnapshotSelectorHook<SessionListState>;
    /** Selector hook over real Workspaces and their independent baseline lifecycle. */
    useWorkspaces: SnapshotSelectorHook<WorkspaceListState>;
  }
}
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * A slot's definition or registration set changed.
     * @mode emit
     * @param key - the mutated SlotMap key.
     */
    'slots/changed'(key: string): void;
    /**
     * A connection generation was (re-)established. Wire-derived caches must
     * treat their state as stale and repull (commands directory; the queue
     * mirrors reset themselves through the session resync path).
     * @mode emit
     */
    'connection/reset'(): void;
  }
  interface Context {
    slots: SlotRegistry;
    /** Event-to-business-Context Definition registry. */
    conversationEvents: ConversationEventRegistry;
    /** Per-target Conversation snapshot builder registry. */
    conversationViews: ConversationViewRegistry;
    /** The outward face only; the concrete service stays inside the runtime. */
    sessions: ISessions;
    /** The outward face only; the concrete service stays inside the runtime. */
    workspaces: IWorkspaces;
  }
}
//#endregion
//#region src/client/index.d.ts
declare const name = "@PeterBon/dsh-hooks-ui";
declare function apply(ctx: ClientContext): void;
//#endregion
//#region src/client/panel.d.ts
interface HooksPanelProps {
  onClose: () => void;
}
//#endregion
//#region src/client/api.d.ts
/**
 * /dsh-hooks/* API client for the browser half. Framework-free — every
 * function takes the fetch implementation as an optional last parameter so
 * tests can inject mocks. Envelope errors surface as null + console.warn,
 * never throws: the panel must degrade, not crash.
 */
interface StatusInfo {
  name: string;
  version: string;
  hookCount: number;
  historyCount: number;
}
type HistoryKind = 'run' | 'notify';
interface HistoryRecord {
  ts: number;
  kind: HistoryKind;
  event: string;
  command: string;
  sessionId?: string;
  sessionName?: string;
  outcome: string;
  exitCode?: number;
  durationMs?: number;
  error?: string;
}
interface TestLine {
  index: number;
  matched: boolean;
  why: string;
  summary: string;
}
interface TestResult {
  event: string;
  executed: boolean;
  total: number;
  matched: number;
  lines: TestLine[];
}
interface TestRequest {
  event: string;
  reason?: string;
  tool?: string;
  execute?: boolean;
}
//#endregion
export { type HistoryRecord, type HooksPanelProps, type StatusInfo, type TestLine, type TestRequest, type TestResult, apply, name };