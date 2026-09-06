import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BP064 canon -- do not alter these values
const HOT_PCT = 94.8;
const COLD_PCT = 8.7;
const KAPPA = 0.883;
const LABEL_X = 0;
const BAR_X = 52;
const BAR_MAX_W = 240;
const ROW_H = 28;
const PCT_X = BAR_X + BAR_MAX_W + 8;
const SVG_W = PCT_X + 52;
const SVG_H = ROW_H * 2 + 4;
export function BenchmarkProofChart() {
    const hotW = (HOT_PCT / 100) * BAR_MAX_W;
    const coldW = (COLD_PCT / 100) * BAR_MAX_W;
    return (_jsxs("div", { style: { margin: '0 0 20px', maxWidth: 400, width: '100%' }, children: [_jsxs("svg", { viewBox: `0 0 ${SVG_W} ${SVG_H}`, style: { width: '100%', display: 'block', overflow: 'visible' }, "aria-label": "Benchmark chart: HOT 94.8%, COLD 8.7%", role: "img", children: [_jsx("text", { x: LABEL_X, y: ROW_H / 2 + 2, fontSize: "11", fill: "#94a3b8", fontFamily: "system-ui, -apple-system, sans-serif", dominantBaseline: "middle", textAnchor: "start", children: "HOT" }), _jsx("rect", { x: BAR_X, y: 2, width: hotW, height: ROW_H - 8, rx: 3, fill: "#3b82f6" }), _jsx("text", { x: PCT_X, y: ROW_H / 2 + 2, fontSize: "11", fill: "#60a5fa", fontFamily: "system-ui, -apple-system, sans-serif", dominantBaseline: "middle", fontWeight: "700", children: "94.8%" }), _jsx("text", { x: LABEL_X, y: ROW_H + ROW_H / 2 + 2, fontSize: "11", fill: "#94a3b8", fontFamily: "system-ui, -apple-system, sans-serif", dominantBaseline: "middle", textAnchor: "start", children: "COLD" }), _jsx("rect", { x: BAR_X, y: ROW_H + 2, width: coldW, height: ROW_H - 8, rx: 3, fill: "#64748b" }), _jsx("text", { x: PCT_X, y: ROW_H + ROW_H / 2 + 2, fontSize: "11", fill: "#94a3b8", fontFamily: "system-ui, -apple-system, sans-serif", dominantBaseline: "middle", children: "8.7%" })] }), _jsx("p", { style: { margin: '8px 0 2px', fontSize: 11, color: '#475569', lineHeight: 1.5 }, children: "Empirical proof from the Eyewitness Benchmark. Same model, with and without MnemosyneC." }), _jsxs("p", { style: { margin: 0, fontSize: 11, color: '#475569' }, children: ["Agreement score: ", KAPPA] })] }));
}
export default BenchmarkProofChart;
