"use strict";
// The host adapter contract.
//
// Nothing in this package reaches into an application. Every capability that differs between
// viz-ui and cafm-v2-ui is injected here instead: data fetching stays inside the SDK, but page
// context, chart rendering, permissions, translation and theme all come from the host.
//
// The deliberate omissions matter as much as the inclusions. There is no data-layer adapter
// because the SDK owns its own fetch, so neither SWR nor react-query is a dependency. There is
// no chart library adapter beyond a render callback, so ECharts is never bundled: each app keeps
// its own themed wrapper and the SDK just hands it option JSON.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildScope = buildScope;
// Turn the host page context into the opaque scope object sent with each turn.
function buildScope(pageContext) {
    const scope = {
        app: pageContext.app,
        route: pageContext.route,
        organization_id: pageContext.user.organizationId,
        user_id: pageContext.user.id,
    };
    if (pageContext.routeParams && Object.keys(pageContext.routeParams).length > 0) {
        scope.route_params = pageContext.routeParams;
    }
    if (pageContext.searchParams && Object.keys(pageContext.searchParams).length > 0) {
        scope.search_params = pageContext.searchParams;
    }
    if (pageContext.entity) {
        scope.entity = {
            type: pageContext.entity.type,
            id: String(pageContext.entity.id),
            ...(pageContext.entity.label === undefined ? {} : { label: pageContext.entity.label }),
        };
    }
    if (pageContext.state)
        scope.state = pageContext.state;
    return scope;
}
