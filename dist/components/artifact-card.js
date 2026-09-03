"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactCard = ArtifactCard;
const jsx_runtime_1 = require("react/jsx-runtime");
// The one shell every artifact an answer carries sits in: a chart from the host renderer, the
// result table, later a note or a checklist. Hosts style the shell once through the tokens and
// every artifact follows.
function ArtifactCard({ title, sub, children }) {
    return ((0, jsx_runtime_1.jsxs)("section", { className: 'nxcp-artifact', "aria-label": title, children: [(0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-artifact-head', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-artifact-title', children: title }), sub ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-artifact-sub', children: sub }) : null] }), children] }));
}
