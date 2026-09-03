"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderInline = renderInline;
exports.parseBlocks = parseBlocks;
exports.Markdown = Markdown;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const INLINE_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]*\]\([^)\s]+\))/g;
const LINK_PATTERN = /^\[([^\]]*)\]\(([^)\s]+)\)$/;
const SAFE_HREF = /^(https?:\/\/|\/|mailto:)/i;
function renderInline(text, keyPrefix) {
    const nodes = [];
    let lastIndex = 0;
    let match;
    INLINE_PATTERN.lastIndex = 0;
    while ((match = INLINE_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex)
            nodes.push(text.slice(lastIndex, match.index));
        const token = match[0];
        const key = `${keyPrefix}-${match.index}`;
        if (token.startsWith('`')) {
            nodes.push((0, jsx_runtime_1.jsx)("code", { children: token.slice(1, -1) }, key));
        }
        else if (token.startsWith('**')) {
            nodes.push((0, jsx_runtime_1.jsx)("strong", { children: token.slice(2, -2) }, key));
        }
        else if (token.startsWith('*')) {
            nodes.push((0, jsx_runtime_1.jsx)("em", { children: token.slice(1, -1) }, key));
        }
        else {
            const link = LINK_PATTERN.exec(token);
            if (link && SAFE_HREF.test(link[2] ?? '')) {
                nodes.push((0, jsx_runtime_1.jsx)("a", { href: link[2], target: '_blank', rel: 'noreferrer noopener', children: link[1] === '' ? link[2] : link[1] }, key));
            }
            else {
                nodes.push(token);
            }
        }
        lastIndex = match.index + token.length;
    }
    if (lastIndex < text.length)
        nodes.push(text.slice(lastIndex));
    return nodes;
}
// Split a possibly-incomplete document into blocks.
function parseBlocks(markdown) {
    const lines = markdown.split('\n');
    const blocks = [];
    let index = 0;
    let counter = 0;
    const nextKey = () => `b${(counter += 1)}`;
    while (index < lines.length) {
        const line = lines[index] ?? '';
        const fence = /^```(.*)$/.exec(line.trim());
        if (fence) {
            const language = (fence[1] ?? '').trim();
            const body = [];
            index += 1;
            let closed = false;
            while (index < lines.length) {
                const current = lines[index] ?? '';
                if (current.trim() === '```') {
                    closed = true;
                    index += 1;
                    break;
                }
                body.push(current);
                index += 1;
            }
            blocks.push({
                kind: 'code',
                key: nextKey(),
                lines: body,
                closed,
                ...(language === '' ? {} : { language }),
            });
            continue;
        }
        if (line.trim() === '') {
            index += 1;
            continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            blocks.push({ kind: 'rule', key: nextKey() });
            index += 1;
            continue;
        }
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        if (heading) {
            blocks.push({
                kind: 'heading',
                key: nextKey(),
                level: (heading[1] ?? '#').length,
                text: heading[2] ?? '',
            });
            index += 1;
            continue;
        }
        if (/^>\s?/.test(line)) {
            const quoted = [];
            while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
                quoted.push((lines[index] ?? '').replace(/^>\s?/, ''));
                index += 1;
            }
            blocks.push({ kind: 'quote', key: nextKey(), lines: quoted });
            continue;
        }
        const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
        const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
        if (bullet || ordered) {
            const isOrdered = ordered !== null && bullet === null;
            const items = [];
            while (index < lines.length) {
                const current = lines[index] ?? '';
                const nextBullet = /^\s*[-*+]\s+(.*)$/.exec(current);
                const nextOrdered = /^\s*\d+[.)]\s+(.*)$/.exec(current);
                const item = isOrdered ? nextOrdered : nextBullet;
                if (!item)
                    break;
                items.push(item[1] ?? '');
                index += 1;
            }
            blocks.push({ kind: 'list', key: nextKey(), ordered: isOrdered, items });
            continue;
        }
        const paragraph = [];
        while (index < lines.length) {
            const current = lines[index] ?? '';
            if (current.trim() === '' ||
                /^```/.test(current.trim()) ||
                /^#{1,3}\s/.test(current) ||
                /^>\s?/.test(current) ||
                /^\s*[-*+]\s+/.test(current) ||
                /^\s*\d+[.)]\s+/.test(current)) {
                break;
            }
            paragraph.push(current);
            index += 1;
        }
        blocks.push({ kind: 'paragraph', key: nextKey(), lines: paragraph });
    }
    return blocks;
}
function renderLines(lines, keyPrefix) {
    return lines.flatMap((line, position) => {
        const rendered = renderInline(line, `${keyPrefix}-${position}`);
        return position === lines.length - 1
            ? rendered
            : [...rendered, (0, jsx_runtime_1.jsx)("br", {}, `${keyPrefix}-br-${position}`)];
    });
}
function Markdown({ text, streaming = false }) {
    const blocks = parseBlocks(text);
    const caret = streaming ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-caret', "aria-hidden": 'true' }) : null;
    if (blocks.length === 0)
        return caret;
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: blocks.map((block, index) => {
            const tail = index === blocks.length - 1 ? caret : null;
            switch (block.kind) {
                case 'heading': {
                    const Tag = ['h1', 'h2', 'h3'][block.level - 1] ?? 'h3';
                    return ((0, jsx_runtime_1.jsxs)(Tag, { children: [renderInline(block.text, block.key), tail] }, block.key));
                }
                case 'code':
                    return ((0, jsx_runtime_1.jsxs)("pre", { "data-closed": block.closed ? 'true' : 'false', children: [(0, jsx_runtime_1.jsx)("code", { ...(block.language ? { 'data-language': block.language } : {}), children: block.lines.join('\n') }), tail] }, block.key));
                case 'list': {
                    const items = block.items.map((item, position) => ((0, jsx_runtime_1.jsxs)("li", { children: [renderInline(item, `${block.key}-${position}`), position === block.items.length - 1 ? tail : null] }, `${block.key}-${position}`)));
                    return block.ordered ? ((0, jsx_runtime_1.jsx)("ol", { children: items }, block.key)) : ((0, jsx_runtime_1.jsx)("ul", { children: items }, block.key));
                }
                case 'quote':
                    return ((0, jsx_runtime_1.jsxs)("blockquote", { children: [renderLines(block.lines, block.key), tail] }, block.key));
                case 'rule':
                    return ((0, jsx_runtime_1.jsxs)(react_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("hr", {}), tail] }, block.key));
                default:
                    return ((0, jsx_runtime_1.jsxs)("p", { children: [renderLines(block.lines, block.key), tail] }, block.key));
            }
        }) }));
}
