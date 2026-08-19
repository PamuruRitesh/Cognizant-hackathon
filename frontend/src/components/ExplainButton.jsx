import { Sparkles } from 'lucide-react';

// A tiny "explain this" icon. Drop it next to any chart or table. On click it
// fires a window event that App listens for, opens the AI Assistant tab, and
// auto-asks Grok to explain this specific element with its data as context.
//
//   <ExplainButton title="Risk Heatmap" data={rows}
//     question="Explain this risk heatmap and what I should act on first." />
const ExplainButton = ({ title, data, question, label = 'Explain' }) => {
  const onClick = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('sp-explain', {
      detail: {
        title,
        question: question || `Explain the "${title}" and what it means in simple terms.`,
        data,
      },
    }));
  };
  return (
    <button
      onClick={onClick}
      title={`Ask AI to explain ${title}`}
      className="btn btn-ghost btn-sm"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px' }}
    >
      <Sparkles size={12} color="var(--blue-400)" /> {label}
    </button>
  );
};

export default ExplainButton;
