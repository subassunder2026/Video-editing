import React, { useState } from 'react';
import { Copy, Plus, Power, RotateCcw, Trash2 } from 'lucide-react';
import type { GradeNode } from '../types/grading';
import { PrecisionSlider } from './PrecisionSlider';

interface NodePipelineProps {
  nodes: GradeNode[];
  activeNodeId: string;
  onSelectNode: (id: string) => void;
  onAddNode: () => void;
  onDuplicateNode: (id: string) => void;
  onToggleNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onResetNode: (id: string) => void;
  onRenameNode: (id: string, name: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onCommit?: () => void;
}

export const NodePipeline: React.FC<NodePipelineProps> = ({
  nodes,
  activeNodeId,
  onSelectNode,
  onAddNode,
  onDuplicateNode,
  onToggleNode,
  onDeleteNode,
  onResetNode,
  onRenameNode,
  onChangeOpacity,
  onCommit,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const activeNode = nodes.find((n) => n.id === activeNodeId) ?? nodes[0];

  const startRename = (node: GradeNode) => {
    setEditingId(node.id);
    setDraftName(node.name);
  };

  const finishRename = (id: string) => {
    if (draftName.trim()) {
      onRenameNode(id, draftName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.07] pb-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-tight text-[#D4D4DC]">
          Serial Nodes
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddNode}
            title="Add Serial Node (Alt+S)"
            className="flex items-center gap-1 rounded border border-white/10 bg-[#1B1B20] px-2 py-0.5 text-[10px] font-medium text-[#ECECEF] transition-colors hover:border-[#E5892E]/60 whitespace-nowrap"
          >
            <Plus className="h-3 w-3 text-[#E5892E]" />
            Add Node
          </button>
        </div>
      </div>

      {/* Horizontal scrollable serial node chain */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {nodes.map((node, index) => {
          const isSelected = node.id === activeNodeId;
          return (
            <React.Fragment key={node.id}>
              <div
                onClick={() => onSelectNode(node.id)}
                onDoubleClick={() => startRename(node)}
                className={`group relative flex min-w-[104px] shrink-0 cursor-pointer flex-col gap-1 rounded border px-2 py-1.5 transition-colors ${
                  isSelected
                    ? 'border-[#E5892E] bg-[#1F1C18]'
                    : 'border-white/[0.08] bg-[#151519] hover:border-white/20'
                } ${!node.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-mono-num text-[10px] font-semibold text-[#8E8E98]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleNode(node.id);
                      }}
                      title={node.enabled ? 'Bypass Node (D)' : 'Enable Node (D)'}
                      className={`rounded p-0.5 transition-colors ${
                        node.enabled
                          ? 'text-[#E5892E] hover:bg-white/10'
                          : 'text-[#5A5A64] hover:text-white'
                      }`}
                    >
                      <Power className="h-2.5 w-2.5" />
                    </button>
                    {nodes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        title="Delete Node"
                        className="rounded p-0.5 text-[#5A5A64] transition-colors hover:bg-white/10 hover:text-red-400"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                {editingId === node.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => finishRename(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishRename(node.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full rounded bg-black/50 px-1 py-0.5 text-[11px] text-white outline-none ring-1 ring-[#E5892E]"
                  />
                ) : (
                  <div
                    className="truncate text-[11px] font-medium text-[#ECECEF]"
                    title="Double-click to rename node"
                  >
                    {node.name}
                  </div>
                )}
              </div>

              {index < nodes.length - 1 && (
                <div className="h-[1px] w-3 shrink-0 bg-white/20" aria-hidden="true" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Selected Node Controls: Key Output Opacity + Duplicate + Reset */}
      {activeNode && (
        <div className="flex items-center gap-3 pt-0.5">
          <div className="flex-1">
            <PrecisionSlider
              label="Node Key Output"
              value={activeNode.opacity}
              min={0}
              max={1}
              step={0.01}
              defaultValue={1}
              compact
              onChange={(v) => onChangeOpacity(activeNode.id, v)}
              onCommit={onCommit}
            />
          </div>
          <div className="flex items-center gap-1 pt-2">
            <button
              type="button"
              onClick={() => onDuplicateNode(activeNode.id)}
              title="Duplicate Active Node"
              className="flex h-6 w-6 items-center justify-center rounded border border-white/[0.08] text-[#8E8E98] transition-colors hover:border-white/20 hover:text-white"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onResetNode(activeNode.id)}
              title="Reset Active Node"
              className="flex h-6 w-6 items-center justify-center rounded border border-white/[0.08] text-[#8E8E98] transition-colors hover:border-white/20 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
