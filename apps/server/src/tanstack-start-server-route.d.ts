/**
 * The Start package augments a nested Router Core version, while Solid Router
 * resolves a newer compatible version. Reapply the server-route option to the
 * Router Core instance used by this application.
 */
type ServerRouteMethod =
	| "ANY"
	| "DELETE"
	| "GET"
	| "HEAD"
	| "OPTIONS"
	| "PATCH"
	| "POST"
	| "PUT";

interface ServerRouteHandlerContext<TParams> {
	context: Record<string, never>;
	next: <TContext = undefined>(options?: {
		context?: TContext;
	}) => { context: TContext; isNext: true };
	params: TParams;
	pathname: string;
	request: Request;
}

type ServerRouteHandler<TParams> = (
	context: ServerRouteHandlerContext<TParams>,
) => Response | undefined | Promise<Response | undefined>;

declare module "@tanstack/router-core" {
	interface FilebaseRouteOptionsInterface<
		TRegister,
		TParentRoute,
		TId extends string,
		TPath extends string,
		TSearchValidator,
		TParams,
		TLoaderDeps,
		TLoaderFn,
		TRouterContext,
		TRouteContextFn,
		TBeforeLoadFn,
		TRemountDepsFn,
		TSSR,
		TServerMiddlewares,
		THandlers,
	> {
		server?: {
			handlers?: THandlers extends undefined
				? Partial<Record<ServerRouteMethod, ServerRouteHandler<TParams>>>
				: THandlers &
						Partial<Record<ServerRouteMethod, ServerRouteHandler<TParams>>>;
		};
	}
}
