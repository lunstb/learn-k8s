import { useRef, useCallback, useState } from 'react';
import { useSimulatorStore } from '../simulation/store';
import { executeCommand } from '../commands/executor';

export function YamlEditor() {
  const yamlContent = useSimulatorStore((s) => s.yamlEditorContent);
  const setYamlContent = useSimulatorStore((s) => s.setYamlEditorContent);
  const appendOutput = useSimulatorStore((s) => s.appendOutput);
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [applyStatus, setApplyStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const lines = yamlContent.split('\n');
  const lineCount = lines.length;

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = yamlContent.substring(0, start) + '  ' + yamlContent.substring(end);
        setYamlContent(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
    },
    [yamlContent],
  );

  const handleApply = useCallback(() => {
    const content = useSimulatorStore.getState().yamlEditorContent;
    if (!content.trim()) return;
    appendOutput(`$ kubectl apply -f editor.yaml`);
    const result = executeCommand(content);
    for (const line of result) {
      appendOutput(line);
    }
    appendOutput('');
    const hasError = result.some((line) => line.toLowerCase().startsWith('error'));
    setApplyStatus(
      hasError
        ? { type: 'error', message: result.find((l) => l.toLowerCase().startsWith('error')) || 'Apply failed' }
        : { type: 'success', message: result[0] || 'Applied successfully' }
    );
    setTimeout(() => setApplyStatus(null), 3000);
    setTimeout(() => useSimulatorStore.getState().checkGoal(), 0);
  }, [appendOutput]);

  const handleReset = useCallback(() => {
    if (currentLesson?.yamlTemplate) {
      setYamlContent(currentLesson.yamlTemplate);
    } else {
      setYamlContent('');
    }
  }, [currentLesson, setYamlContent]);

  return (
    <div className="yaml-editor">
      <div className="yaml-editor-header">
        <span className="yaml-editor-title">
          YAML Editor
          {applyStatus && (
            <span className={`yaml-apply-status ${applyStatus.type}`}>
              {applyStatus.type === 'success' ? '\u2713' : '\u2717'} {applyStatus.message}
            </span>
          )}
        </span>
        <div className="yaml-editor-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            Reset
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleApply}>
            Apply
          </button>
          <span className="yaml-editor-shortcut">Ctrl+Enter</span>
        </div>
      </div>
      <div className="yaml-editor-body">
        <div className="yaml-line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="yaml-line-number">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="yaml-textarea"
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
