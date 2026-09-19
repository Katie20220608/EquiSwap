export type ParticipantDetail = {
  name: string;
  id?: number;
  itemId?: number;
  itemName?: string;
};

export type CycleVisualisationProps = {
  participants: (string | ParticipantDetail)[];
};

const NODE_COLORS = [
  { bg: "#3b82f6", text: "#0f172a" }, // Blue (Mia in Image 2)
  { bg: "#22c55e", text: "#0f172a" }, // Green (Jack in Image 2)
  { bg: "#ffffff", text: "#0f172a" }, // White (Cici in Image 2)
  { bg: "#f59e0b", text: "#0f172a" }, // Ochre / Amber
  { bg: "#a855f7", text: "#ffffff" }, // Purple
  { bg: "#ec4899", text: "#ffffff" }, // Pink
];

function wrapLabel(label: string, maxCharacters = 22): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && candidate.length > maxCharacters) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : ["Swap item"];
}

export function CycleVisualisation({ participants }: CycleVisualisationProps) {
  const normalized = participants.map((p, idx) => {
    if (typeof p === "string") {
      return {
        name: p,
        id: idx + 1,
        itemName: undefined,
        initial: p.trim()[0]?.toUpperCase() ?? "?",
      };
    }
    return {
      name: p.name,
      id: p.id ?? idx + 1,
      itemId: p.itemId,
      itemName: p.itemName,
      initial: p.name.trim()[0]?.toUpperCase() ?? "?",
    };
  });

  const participantNamesList = normalized.map((p) => p.name).join(", ");
  const count = normalized.length;

  const width = 640;
  const height = 320;
  const cx = width / 2;
  const cy = height / 2;
  const radius = count <= 2 ? 100 : 108;
  const nodeR = 32;

  const nodes = normalized.map((p, idx) => {
    const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    const labelOnRight = x >= cx;

    const color = NODE_COLORS[idx % NODE_COLORS.length];
    const firstName = p.name.split(" ")[0];
    const itemLabel =
      p.itemName ?? (p.itemId ? `Item #${p.itemId}` : "Swap item");

    return {
      ...p,
      x,
      y,
      labelX: x + (labelOnRight ? nodeR + 14 : -(nodeR + 14)),
      labelAnchor: (labelOnRight ? "start" : "end") as "start" | "end",
      color,
      firstName,
      itemLabelLines: wrapLabel(itemLabel),
    };
  });

  return (
    <div
      className="cycle-graph-card"
      role="img"
      aria-label={`Swap cycle between ${participantNamesList}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="cycle-graph-svg"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="graph-arrowhead"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f8fafc" />
          </marker>
          <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="5"
              floodColor="#000000"
              floodOpacity="0.4"
            />
          </filter>
        </defs>

        {/* Directed Edge Lines / Curves */}
        {nodes.map((fromNode, i) => {
          const toNode = nodes[(i + 1) % count];

          if (count === 2) {
            const isFirst = i === 0;
            const curveOffset = isFirst ? 50 : -50;
            const mx = (fromNode.x + toNode.x) / 2 + curveOffset;
            const my = (fromNode.y + toNode.y) / 2;

            const pathD = `M ${fromNode.x} ${fromNode.y} Q ${mx} ${my} ${toNode.x} ${toNode.y}`;

            return (
              <path
                key={`edge-${i}`}
                d={pathD}
                fill="none"
                stroke="#f8fafc"
                strokeWidth="2.5"
                markerEnd="url(#graph-arrowhead)"
              />
            );
          }

          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;

          const startX = fromNode.x + ux * (nodeR + 4);
          const startY = fromNode.y + uy * (nodeR + 4);
          const endX = toNode.x - ux * (nodeR + 10);
          const endY = toNode.y - uy * (nodeR + 10);

          return (
            <line
              key={`edge-${i}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#f8fafc"
              strokeWidth="2.5"
              markerEnd="url(#graph-arrowhead)"
            />
          );
        })}

        {/* Nodes and Badges */}
        {nodes.map((node) => (
          <g key={`node-${node.name}-${node.id}`}>
            {/* Identify the item represented by this participant's swap edge. */}
            <text
              x={node.labelX}
              y={node.y + 4}
              textAnchor={node.labelAnchor}
              className="node-item-label"
            >
              {node.itemLabelLines.map((line, lineIndex) => (
                <tspan
                  key={`${line}-${lineIndex}`}
                  x={node.labelX}
                  dy={lineIndex === 0 ? 0 : 14}
                >
                  {line}
                </tspan>
              ))}
            </text>

            {/* Circular Node */}
            <circle
              cx={node.x}
              cy={node.y}
              r={nodeR}
              fill={node.color.bg}
              filter="url(#node-glow)"
              className="node-circle"
            />

            {/* Display Name inside Node */}
            <text
              x={node.x}
              y={node.y + 6}
              textAnchor="middle"
              fill={node.color.text}
              className="node-name-text"
            >
              {node.firstName}
            </text>

            {/* Hidden initial element for testing/accessibility queries */}
            <text x={node.x} y={node.y} className="visually-hidden-text">
              {node.initial}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
