import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const G = 8;
const NUM_COLORS = 6;
let UID = 1;

const CANDY = [
  { base: "#ff3b5c", light: "#ff8fa3", dark: "#8b0020", glow: "rgba(255,59,92,0.8)",  name: "Cherry" },
  { base: "#ff8c00", light: "#ffcf7a", dark: "#8b4800", glow: "rgba(255,140,0,0.8)",  name: "Orange" },
  { base: "#ffd700", light: "#fff9a0", dark: "#8b7500", glow: "rgba(255,215,0,0.8)",  name: "Lemon"  },
  { base: "#00c96a", light: "#7fffc4", dark: "#006035", glow: "rgba(0,201,106,0.8)",  name: "Lime"   },
  { base: "#00bfff", light: "#80dfff", dark: "#004a7f", glow: "rgba(0,191,255,0.8)",  name: "Ice"    },
  { base: "#bf5af2", light: "#e0a8ff", dark: "#600090", glow: "rgba(191,90,242,0.8)", name: "Grape"  },
];

const SP = { NONE: 0, SH: 1, SV: 2, BOMB: 3 };

const LEVELS = [
  { goal: 1000,  moves: 20, label: "Sweet Start"  },
  { goal: 2500,  moves: 22, label: "Sugar Rush"   },
  { goal: 5000,  moves: 25, label: "Candy Storm"  },
  { goal: 10000, moves: 28, label: "Sugar Frenzy" },
  { goal: 20000, moves: 30, label: "Candy King"   },
];

// ─── Pure helpers (no React) ──────────────────────────────────────────────────
const mkCell = (color, special = SP.NONE) => ({ color, special, id: UID++ });

function createBoard() {
  const b = Array.from({ length: G }, () => Array(G).fill(null));
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      let color, tries = 0;
      do {
        color = Math.floor(Math.random() * NUM_COLORS);
        tries++;
      } while (tries < 80 && (
        (c >= 2 && b[r][c-1]?.color === color && b[r][c-2]?.color === color) ||
        (r >= 2 && b[r-1][c]?.color === color && b[r-2][c]?.color === color)
      ));
      b[r][c] = mkCell(color);
    }
  }
  return b;
}

function findGroups(board) {
  const groups = [];
  // horizontal runs
  for (let r = 0; r < G; r++) {
    let c = 0;
    while (c < G) {
      if (!board[r][c]) { c++; continue; }
      const col = board[r][c].color;
      let len = 1;
      while (c + len < G && board[r][c + len]?.color === col) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => [r, c + i]), dir: "h", len, color: col });
      c += len;
    }
  }
  // vertical runs
  for (let c = 0; c < G; c++) {
    let r = 0;
    while (r < G) {
      if (!board[r][c]) { r++; continue; }
      const col = board[r][c].color;
      let len = 1;
      while (r + len < G && board[r + len]?.[c]?.color === col) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => [r + i, c]), dir: "v", len, color: col });
      r += len;
    }
  }
  return groups;
}

function applyGravity(board) {
  const b = board.map(row => [...row]);
  for (let c = 0; c < G; c++) {
    // collect non-null cells bottom-to-top
    const stack = [];
    for (let r = G - 1; r >= 0; r--) { if (b[r][c]) stack.push(b[r][c]); }
    // fill column bottom-to-top: existing cells first, then new randoms on top
    for (let r = G - 1; r >= 0; r--) {
      b[r][c] = stack.length ? stack.shift() : mkCell(Math.floor(Math.random() * NUM_COLORS));
    }
  }
  return b;
}

function isAdj(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function findHint(board) {
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      if (c < G - 1) {
        const nb = board.map(row => [...row]);
        [nb[r][c], nb[r][c+1]] = [nb[r][c+1], nb[r][c]];
        if (findGroups(nb).length) return [[r,c],[r,c+1]];
      }
      if (r < G - 1) {
        const nb = board.map(row => [...row]);
        [nb[r][c], nb[r+1][c]] = [nb[r+1][c], nb[r][c]];
        if (findGroups(nb).length) return [[r,c],[r+1,c]];
      }
    }
  }
  return null;
}

// ─── Static star data ─────────────────────────────────────────────────────────
const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  left: `${Math.random()*100}%`, top: `${Math.random()*100}%`,
  size: `${Math.random()*2+0.5}px`,
  dur:  `${(Math.random()*3+2).toFixed(1)}s`,
  delay:`${(Math.random()*4).toFixed(1)}s`,
  op:   (Math.random()*0.6+0.1).toFixed(2),
}));

// ─── CSS (injected once) ──────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body,#root{min-height:100vh;background:linear-gradient(150deg,#1a0a2e 0%,#0d1b4b 55%,#0a1a2e 100%);font-family:'Nunito',sans-serif;overflow-x:hidden}
.g-wrap{display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:12px 8px;gap:8px;position:relative;z-index:1}
.g-title{font-family:'Fredoka One',cursive;font-size:clamp(1.8rem,6vw,3rem);background:linear-gradient(90deg,#ff3b5c,#ff8c00,#ffd700,#00c96a,#00bfff,#bf5af2,#ff3b5c);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:rainbow 4s linear infinite;letter-spacing:3px}
@keyframes rainbow{0%{background-position:0%}100%{background-position:200%}}
.g-topbar{display:flex;gap:8px;width:100%;max-width:500px}
.g-card{flex:1;background:rgba(255,255,255,.09);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:9px 6px;text-align:center;color:#fff}
.g-card-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.5);margin-bottom:2px}
.g-card-val{font-size:1.5rem;font-weight:900;color:#ffd700;line-height:1}
.g-card-sub{font-size:10px;color:rgba(255,255,255,.38);margin-top:1px}
.g-prog-wrap{width:100%;max-width:500px}
.g-prog-top{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:rgba(255,255,255,.55);margin-bottom:5px}
.g-prog-track{height:11px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;border:1px solid rgba(255,255,255,.1)}
.g-prog-fill{height:100%;background:linear-gradient(90deg,#ff3b5c,#ff8c00,#ffd700,#00c96a);border-radius:99px;transition:width .55s cubic-bezier(.4,0,.2,1);box-shadow:0 0 10px rgba(255,215,0,.5)}
.g-shell{background:rgba(0,0,0,.4);border:2px solid rgba(255,255,255,.1);border-radius:20px;padding:8px;box-shadow:0 0 50px rgba(191,90,242,.2),0 20px 60px rgba(0,0,0,.6)}
.g-board{display:grid;grid-template-columns:repeat(8,1fr);gap:3px}
.g-cell{border-radius:11px;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;user-select:none;transition:transform .12s ease;width:clamp(33px,calc((min(94vw,68vh) - 34px)/8),60px);height:clamp(33px,calc((min(94vw,68vh) - 34px)/8),60px)}
.g-cell:hover:not(.swapping):not(.swap-reject){transform:scale(1.08)}
.g-cell.sel{animation:selPulse .65s ease-in-out infinite;z-index:10;transform:scale(1.1)}
.g-cell.pop{animation:popOut .35s ease-in forwards;pointer-events:none}
.g-cell.hint{animation:hintBounce .45s ease-in-out 3}
.g-cell.swapping{z-index:20;transition:transform 0.3s cubic-bezier(0.34,1.45,0.64,1) !important}
@keyframes swapReject{0%{transform:translate(0,0)}40%{transform:translate(var(--rx),var(--ry))}70%{transform:translate(calc(var(--rx)*-.3),calc(var(--ry)*-.3))}100%{transform:translate(0,0)}}
.g-cell.swap-reject{animation:swapReject 0.38s cubic-bezier(.36,.07,.19,.97) forwards;z-index:20}
@keyframes selPulse{0%,100%{box-shadow:0 0 0 3px #ffd700,0 0 12px rgba(255,215,0,.65)}50%{box-shadow:0 0 0 4px #ffd700,0 0 22px rgba(255,215,0,.95)}}
@keyframes popOut{0%{transform:scale(1);opacity:1}45%{transform:scale(1.5);opacity:.7}100%{transform:scale(0);opacity:0}}
@keyframes hintBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.14) rotate(-4deg)}}
.g-candy{width:87%;height:87%;border-radius:9px;position:relative;overflow:hidden}
.g-shine{position:absolute;top:7%;left:9%;width:33%;height:27%;background:rgba(255,255,255,.55);border-radius:50%;filter:blur(1.5px);pointer-events:none}
.g-shine2{position:absolute;bottom:10%;right:7%;width:17%;height:14%;background:rgba(255,255,255,.18);border-radius:50%;filter:blur(1px);pointer-events:none}
.stripe-h::after,.stripe-v::after{content:'';position:absolute;background:rgba(255,255,255,.6);border-radius:3px;pointer-events:none}
.stripe-h::after{top:50%;left:4%;right:4%;height:4px;transform:translateY(-50%)}
.stripe-v::after{left:50%;top:4%;bottom:4%;width:4px;transform:translateX(-50%)}
.g-bomb{width:87%;height:87%;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fffde0,#aaa 55%,#222);position:relative;display:flex;align-items:center;justify-content:center}
.g-bomb::after{content:'✦';font-size:1.15em;color:#ffd700;animation:bspin 2s linear infinite;text-shadow:0 0 8px #ffd700,0 0 20px #ff8c00;position:absolute;pointer-events:none}
@keyframes bspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.g-spec-tag{position:absolute;bottom:1px;right:2px;font-size:.65em;font-weight:900;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);pointer-events:none;z-index:5;line-height:1}
.g-btns{display:flex;gap:10px}
.g-btn{padding:10px 26px;border:none;border-radius:50px;font-size:.9rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;transition:transform .1s,box-shadow .1s}
.g-btn:hover{transform:scale(1.05)}
.g-btn:active{transform:scale(.96)}
.g-btn-primary{background:linear-gradient(135deg,#ff3b5c,#ff8c00);color:#fff;box-shadow:0 4px 16px rgba(255,59,92,.4)}
.g-btn-ghost{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2)}
.g-legend{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;max-width:500px}
.g-legend-item{display:flex;align-items:center;gap:4px;font-size:10px;color:rgba(255,255,255,.5);font-weight:700}
.g-specguide{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:500px;font-size:10px;color:rgba(255,255,255,.4);font-weight:700}
.g-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:300;animation:fadeIn .3s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.g-modal{background:rgba(15,8,35,.9);border:1px solid rgba(255,255,255,.18);border-radius:26px;padding:34px 40px;text-align:center;max-width:360px;width:92%;box-shadow:0 0 60px rgba(191,90,242,.3)}
.g-modal-title{font-family:'Fredoka One',cursive;font-size:2.6rem;margin-bottom:8px}
.g-modal-stars{font-size:1.9rem;letter-spacing:4px;margin-bottom:10px}
.g-modal-sub{font-size:.95rem;color:rgba(255,255,255,.55);margin-bottom:4px}
.g-modal-score{font-size:1.35rem;font-weight:900;color:#ffd700;margin-bottom:18px}
.g-modal-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.g-combo{position:fixed;top:32%;left:50%;transform:translateX(-50%);font-family:'Fredoka One',cursive;font-size:2rem;color:#ffd700;text-shadow:0 0 20px rgba(255,215,0,.9),0 0 40px rgba(255,140,0,.6);pointer-events:none;z-index:400;animation:comboUp 1s ease-out forwards;white-space:nowrap}
@keyframes comboUp{0%{opacity:1;transform:translateX(-50%) scale(.4)}50%{opacity:1;transform:translateX(-50%) scale(1.3) translateY(-16px)}100%{opacity:0;transform:translateX(-50%) scale(1) translateY(-48px)}}
.g-stars-bg{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.g-star{position:absolute;border-radius:50%;background:#fff;animation:twinkle var(--d,3s) ease-in-out infinite alternate}
@keyframes twinkle{from{opacity:.05}to{opacity:var(--o,.6)}}
`;

// ─── CandyCell component ──────────────────────────────────────────────────────
function CandyCell({ cell, isSelected, isPopping, isHinted, onClick, swapStyle, rejectStyle }) {
  if (!cell) return <div className="g-cell" style={{ cursor: "default" }} />;
  const cd = CANDY[cell.color];
  let cls = "g-cell";
  if (isSelected)  cls += " sel";
  if (isPopping)   cls += " pop";
  if (isHinted)    cls += " hint";
  if (swapStyle)   cls += " swapping";
  if (rejectStyle) cls += " swap-reject";

  const grad = `radial-gradient(circle at 30% 28%, ${cd.light}, ${cd.base} 55%, ${cd.dark})`;
  const baseStyle = { background: cd.glow.replace("0.8", "0.13") };

  return (
    <div
      className={cls}
      style={{ ...baseStyle, ...(swapStyle || {}), ...(rejectStyle || {}) }}
      onClick={onClick}
    >
      {cell.special === SP.BOMB ? (
        <div className="g-bomb" />
      ) : (
        <div
          className={`g-candy ${cell.special === SP.SH ? "stripe-h" : cell.special === SP.SV ? "stripe-v" : ""}`}
          style={{ background: grad }}
        >
          <div className="g-shine" />
          <div className="g-shine2" />
          {cell.special === SP.SH && <span className="g-spec-tag">↔</span>}
          {cell.special === SP.SV && <span className="g-spec-tag">↕</span>}
        </div>
      )}
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function CandyCrush() {
  const [board,     setBoard]     = useState(() => createBoard());
  const [selected,  setSelected]  = useState(null);   // {r,c} | null
  const [score,     setScore]     = useState(0);
  const [level,     setLevel]     = useState(0);
  const [movesLeft, setMovesLeft] = useState(LEVELS[0].moves);
  const [phase,     setPhase]     = useState("idle");  // idle | busy | gameover | levelwin | win
  const [popKeys,   setPopKeys]   = useState(new Set());
  const [combo,     setCombo]     = useState(null);    // {text,k}
  const [hintKeys,  setHintKeys]  = useState(new Set());
  const [highScore, setHighScore] = useState(0);
  // swapAnim: { fromKey, toKey, dx, dy } – the two cells sliding toward each other
  const [swapAnim,  setSwapAnim]  = useState(null);
  // rejectAnim: { fromKey, toKey, dx, dy } – invalid swap bounce-back
  const [rejectAnim, setRejectAnim] = useState(null);

  const boardRef = useRef(null); // ref to the .g-board div for measuring cell size

  // ── refs to escape stale-closure hell ────────────────────────────────────
  // phaseRef: lets handleClick lock immediately, before React re-render
  const phaseRef = useRef("idle");
  const setPhaseSync = (p) => { phaseRef.current = p; setPhase(p); };

  // pm is the "process matches" function; stored in a ref so the recursive
  // setTimeout calls inside always get the *latest* version of the function.
  const pm = useRef(null);

  // CSS injection
  const cssInjected = useRef(false);
  useEffect(() => {
    if (cssInjected.current) return;
    cssInjected.current = true;
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  // Hint: flash a valid swap after 5 s of idle
  const hintTimer = useRef(null);
  useEffect(() => {
    clearTimeout(hintTimer.current);
    if (phase !== "idle") { setHintKeys(new Set()); return; }
    hintTimer.current = setTimeout(() => {
      const pair = findHint(board);
      if (!pair) return;
      setHintKeys(new Set(pair.map(([r,c]) => `${r},${c}`)));
      setTimeout(() => setHintKeys(new Set()), 2200);
    }, 5000);
    return () => clearTimeout(hintTimer.current);
  }, [phase, board]);

  // ── processMatches (stored in ref so recursion is always fresh) ───────────
  pm.current = function processMatches(brd, sc, mv, lv, cmb) {
    const groups = findGroups(brd);
    if (!groups.length) {
      setPhaseSync("idle");
      return;
    }

    // 1. Build the base set of matched positions
    const baseSet = new Set();
    const newSpecials = [];
    groups.forEach(g => {
      g.cells.forEach(([r, c]) => baseSet.add(`${r},${c}`));
      if (g.len === 4) {
        const [mr, mc] = g.cells[1];
        newSpecials.push({ r: mr, c: mc, special: g.dir === "h" ? SP.SH : SP.SV, color: g.color });
      } else if (g.len >= 5) {
        const [mr, mc] = g.cells[Math.floor(g.len / 2)];
        newSpecials.push({ r: mr, c: mc, special: SP.BOMB, color: g.color });
      }
    });

    // 2. Expand for any special candies hit by the match
    const fullSet = new Set(baseSet);
    baseSet.forEach(key => {
      const [r, c] = key.split(",").map(Number);
      const cell = brd[r]?.[c];
      if (!cell) return;
      if (cell.special === SP.SH) {
        for (let cc = 0; cc < G; cc++) fullSet.add(`${r},${cc}`);
      } else if (cell.special === SP.SV) {
        for (let rr = 0; rr < G; rr++) fullSet.add(`${rr},${c}`);
      } else if (cell.special === SP.BOMB) {
        const tc = cell.color;
        for (let rr = 0; rr < G; rr++)
          for (let cc = 0; cc < G; cc++)
            if (brd[rr]?.[cc]?.color === tc) fullSet.add(`${rr},${cc}`);
      }
    });

    // 3. Score
    let pts = Math.round(
      groups.reduce((s, g) => s + g.len * 40 + (g.len > 3 ? (g.len - 3) * 120 : 0), 0)
      * (1 + cmb * 0.6)
    );

    // 4. Show combo banner
    if (cmb > 0) {
      setCombo({ text: `${cmb + 1}× COMBO! 🔥`, k: Date.now() });
      setTimeout(() => setCombo(null), 1100);
    }

    // 5. Show pop animation
    setPopKeys(new Set(fullSet));

    // 6. After pop animation: remove cells, apply gravity, check level/gameover/cascade
    setTimeout(() => {
      let nb = brd.map(row => row.map(c => c ? { ...c } : null));
      fullSet.forEach(key => { const [r,c]=key.split(",").map(Number); nb[r][c]=null; });
      // Place newly earned specials
      newSpecials.forEach(({ r, c, special, color }) => { nb[r][c] = mkCell(color, special); });
      nb = applyGravity(nb);

      const ns = sc + pts;
      const ld = LEVELS[Math.min(lv, LEVELS.length - 1)];

      setBoard(nb);
      setScore(ns);
      setPopKeys(new Set());
      setHighScore(prev => Math.max(prev, ns));

      if (ns >= ld.goal) {
        setPhaseSync(lv >= LEVELS.length - 1 ? "win" : "levelwin");
        return;
      }
      if (mv <= 0) { setPhaseSync("gameover"); return; }

      // 7. Check for cascades (after brief settle)
      setTimeout(() => {
        if (findGroups(nb).length > 0) {
          pm.current(nb, ns, mv, lv, cmb + 1);   // ← always calls the latest pm
        } else {
          setPhaseSync("idle");
        }
      }, 160);
    }, 400);
  };

  // ── Click handler ─────────────────────────────────────────────────────────
  function handleClick(r, c) {
    if (phaseRef.current !== "idle") return;
    const targetCell = board[r]?.[c];
    if (!targetCell) return;

    setHintKeys(new Set());

    if (!selected) { setSelected({ r, c }); return; }
    if (selected.r === r && selected.c === c) { setSelected(null); return; }
    if (!isAdj(selected.r, selected.c, r, c)) { setSelected({ r, c }); return; }

    // ── Attempt swap ──────────────────────────────────────────────────────
    const sel = selected;
    setSelected(null);

    const nb = board.map(row => [...row]);
    [nb[sel.r][sel.c], nb[r][c]] = [nb[r][c], nb[sel.r][sel.c]];

    // Measure pixel step from the live DOM so animation distance is exact
    const firstCell = boardRef.current?.querySelector(".g-cell");
    const step = firstCell ? firstCell.offsetWidth + 3 : 52; // +3 = gap
    const dx = (c - sel.c) * step;
    const dy = (r - sel.r) * step;
    const fromKey = `${sel.r},${sel.c}`;
    const toKey   = `${r},${c}`;

    if (!findGroups(nb).length) {
      // ── INVALID swap: bounce-and-return animation ─────────────────────
      setRejectAnim({ fromKey, toKey, dx: dx * 0.45, dy: dy * 0.45 });
      setTimeout(() => setRejectAnim(null), 420);
      return;
    }

    // ── VALID swap: slide candies into each other's positions ─────────────
    // Step 1 – lock input and kick off the sliding animation
    setPhaseSync("busy");
    setSwapAnim({ fromKey, toKey, dx, dy });

    // Step 2 – after the slide finishes, commit board and process matches
    setTimeout(() => {
      setSwapAnim(null);      // clear transforms (cells now in correct grid slots)
      setBoard(nb);
      const nm = movesLeft - 1;
      setMovesLeft(nm);
      // One extra tick so React paints the committed board before we pop cells
      setTimeout(() => pm.current(nb, score, nm, level, 0), 16);
    }, 310);
  }

  // ── Game control helpers ──────────────────────────────────────────────────
  function restart() {
    setPhaseSync("idle");
    setBoard(createBoard());
    setScore(0);
    setMovesLeft(LEVELS[level].moves);
    setSelected(null);
    setPopKeys(new Set());
    setCombo(null);
    setHintKeys(new Set());
    setSwapAnim(null);
    setRejectAnim(null);
  }

  function nextLevel() {
    const nl = level + 1;
    setLevel(nl);
    setPhaseSync("idle");
    setBoard(createBoard());
    setScore(0);
    setMovesLeft(LEVELS[nl].moves);
    setSelected(null);
    setPopKeys(new Set());
    setSwapAnim(null);
    setRejectAnim(null);
  }

  function goToMenu() {
    setLevel(0);
    setHighScore(0);
    setPhaseSync("idle");
    setBoard(createBoard());
    setScore(0);
    setMovesLeft(LEVELS[0].moves);
    setSelected(null);
    setPopKeys(new Set());
    setSwapAnim(null);
    setRejectAnim(null);
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const ld    = LEVELS[Math.min(level, LEVELS.length - 1)];
  const pct   = Math.min(score / ld.goal, 1);
  const stars = pct >= 1 ? 3 : pct >= 0.6 ? 2 : pct >= 0.3 ? 1 : 0;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="g-wrap">

      {/* Starfield */}
      <div className="g-stars-bg">
        {STARS.map(s => (
          <div key={s.id} className="g-star" style={{
            left: s.left, top: s.top, width: s.size, height: s.size,
            "--d": s.dur, "--o": s.op, animationDelay: s.delay,
          }} />
        ))}
      </div>

      {/* Combo banner */}
      {combo && <div key={combo.k} className="g-combo">{combo.text}</div>}

      {/* Title */}
      <h1 className="g-title"> COLOUR CRUSH</h1>

      {/* Stat cards */}
      <div className="g-topbar">
        <div className="g-card">
          <div className="g-card-label">Score</div>
          <div className="g-card-val">{score.toLocaleString()}</div>
          <div className="g-card-sub">Best {highScore.toLocaleString()}</div>
        </div>
        <div className="g-card">
          <div className="g-card-label">Level</div>
          <div className="g-card-val">{level + 1}</div>
          <div className="g-card-sub">{ld.label}</div>
        </div>
        <div className="g-card">
          <div className="g-card-label">Moves</div>
          <div className="g-card-val" style={{ color: movesLeft <= 5 ? "#ff3b5c" : "#ffd700" }}>
            {movesLeft}
          </div>
          <div className="g-card-sub">remaining</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="g-prog-wrap">
        <div className="g-prog-top">
          <span>{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</span>
          <span>{score.toLocaleString()} / {ld.goal.toLocaleString()}</span>
        </div>
        <div className="g-prog-track">
          <div className="g-prog-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      {/* Board */}
      <div className="g-shell">
        <div className="g-board" ref={boardRef}>
          {board.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`;

              // Sliding swap styles (valid swap in progress)
              let swapStyle = null;
              if (swapAnim) {
                if (key === swapAnim.fromKey)
                  swapStyle = { transform: `translate(${swapAnim.dx}px, ${swapAnim.dy}px)` };
                else if (key === swapAnim.toKey)
                  swapStyle = { transform: `translate(${-swapAnim.dx}px, ${-swapAnim.dy}px)` };
              }

              // Bounce-back styles (invalid swap)
              let rejectStyle = null;
              if (rejectAnim) {
                if (key === rejectAnim.fromKey)
                  rejectStyle = { "--rx": `${rejectAnim.dx}px`, "--ry": `${rejectAnim.dy}px` };
                else if (key === rejectAnim.toKey)
                  rejectStyle = { "--rx": `${-rejectAnim.dx}px`, "--ry": `${-rejectAnim.dy}px` };
              }

              return (
                <CandyCell
                  key={cell?.id ?? key}
                  cell={cell}
                  isSelected={selected?.r === r && selected?.c === c}
                  isPopping={popKeys.has(key)}
                  isHinted={hintKeys.has(key)}
                  swapStyle={swapStyle}
                  rejectStyle={rejectStyle}
                  onClick={() => handleClick(r, c)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="g-legend">
        {CANDY.map((cd, i) => (
          <div key={i} className="g-legend-item">
            <div style={{ width:13, height:13, borderRadius:4,
              background:`radial-gradient(circle at 30% 28%, ${cd.light}, ${cd.base})` }} />
            {cd.name}
          </div>
        ))}
      </div>

      {/* Specials guide */}
      <div className="g-specguide">
        <span>↔ Match 4 in a row → Stripe (clears row)</span>
        <span>↕ Match 4 in col → Stripe (clears col)</span>
        <span>✦ Match 5 → Bomb (clears color)</span>
      </div>

      {/* Buttons */}
      <div className="g-btns">
        <button className="g-btn g-btn-primary" onClick={restart}>🔄 Restart</button>
        <button className="g-btn g-btn-ghost"   onClick={goToMenu}>🏠 Menu</button>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}

      {phase === "gameover" && (
        <div className="g-overlay">
          <div className="g-modal">
            <div className="g-modal-title" style={{ color: "#ff3b5c" }}>😢 Game Over</div>
            <div className="g-modal-stars">{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</div>
            <div className="g-modal-sub">Level {level + 1} — {ld.label}</div>
            <div className="g-modal-score">Score: {score.toLocaleString()}</div>
            <div className="g-modal-btns">
              <button className="g-btn g-btn-primary" onClick={restart}>Try Again</button>
              <button className="g-btn g-btn-ghost"   onClick={goToMenu}>Menu</button>
            </div>
          </div>
        </div>
      )}

      {phase === "levelwin" && (
        <div className="g-overlay">
          <div className="g-modal">
            <div className="g-modal-title" style={{ color: "#ffd700" }}>🎉 Level Complete!</div>
            <div className="g-modal-stars">{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</div>
            <div className="g-modal-sub">Level {level + 1} — {ld.label}</div>
            <div className="g-modal-score">{score.toLocaleString()} pts</div>
            <div className="g-modal-btns">
              <button className="g-btn g-btn-primary" onClick={nextLevel}>Next Level →</button>
              <button className="g-btn g-btn-ghost"   onClick={restart}>Replay</button>
            </div>
          </div>
        </div>
      )}

      {phase === "win" && (
        <div className="g-overlay">
          <div className="g-modal">
            <div className="g-modal-title" style={{
              background: "linear-gradient(90deg,#ffd700,#ff8c00)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>🏆 You Won!</div>
            <div className="g-modal-stars">⭐⭐⭐</div>
            <div className="g-modal-sub">All 5 levels cleared!</div>
            <div className="g-modal-score">Final Score: {score.toLocaleString()}</div>
            <div className="g-modal-btns">
              <button className="g-btn g-btn-primary" onClick={goToMenu}>Play Again</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
