import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { useSimulatorStore } from '../simulation/store';
import { executeCommand } from '../commands/executor';

export function Terminal() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isMultiLine, setIsMultiLine] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const terminalOutput = useSimulatorStore((s) => s.terminalOutput);
  const appendOutput = useSimulatorStore((s) => s.appendOutput);
  const tick = useSimulatorStore((s) => s.tick);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-resize textarea rows
  useEffect(() => {
    if (inputRef.current) {
      const lines = input.split('\n').length;
      inputRef.current.rows = Math.min(Math.max(lines, 1), 15);
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Show command in output (truncate display for multi-line)
    const displayCmd = trimmed.includes('\n')
      ? `${trimmed.split('\n')[0]} ... (${trimmed.split('\n').length} lines)`
      : trimmed;
    appendOutput(`$ ${displayCmd}`);
    setHistory((prev) => [trimmed, ...prev]);
    setHistoryIndex(-1);

    const output = executeCommand(trimmed);
    for (const line of output) {
      appendOutput(line);
    }
    appendOutput('');

    setInput('');
    setIsMultiLine(false);

    // Check goals after command
    setTimeout(() => useSimulatorStore.getState().checkGoal(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey) {
        if (isMultiLine) {
          // Ctrl+Enter in multi-line mode = submit
          e.preventDefault();
          handleSubmit();
        } else {
          // Ctrl+Enter in single-line mode = reconcile tick
          e.preventDefault();
          tick();
        }
        return;
      }
      if (e.shiftKey) {
        // Shift+Enter = insert newline, enter multi-line mode
        setIsMultiLine(true);
        return; // let default textarea behavior insert newline
      }
      if (isMultiLine) {
        // In multi-line mode, Enter inserts newline
        return;
      }
      // Single-line mode, Enter = submit
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp' && !isMultiLine) {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !isMultiLine) {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Escape' && isMultiLine) {
      e.preventDefault();
      setIsMultiLine(false);
      setInput('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    // Auto-detect multi-line
    if (val.includes('\n')) {
      setIsMultiLine(true);
    } else if (!val.includes('\n') && isMultiLine) {
      setIsMultiLine(false);
    }
  };

  return (
    <div className="terminal" onClick={() => inputRef.current?.focus()}>
      <div className="terminal-output" ref={outputRef}>
        {terminalOutput.map((line, i) => (
          <div
            key={i}
            className={`terminal-line ${
              line.startsWith('$') ? 'terminal-command' :
              line.startsWith('Error') ? 'terminal-error' :
              line.startsWith('[Tick') ? 'terminal-tick' :
              line.startsWith('---') ? 'terminal-lesson-header' :
              line.startsWith('Goal:') ? 'terminal-goal' :
              line.startsWith('Hint:') ? 'terminal-hint' :
              line.includes('\u2705') ? 'terminal-success' :
              ''
            }`}
          >
            {line || '\u00A0'}
          </div>
        ))}
      </div>
      <div className={`terminal-input-row ${isMultiLine ? 'terminal-input-multiline' : ''}`}>
        <span className="terminal-prompt">{isMultiLine ? 'yaml' : '$'}</span>
        <textarea
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isMultiLine ? 'Paste YAML... (Ctrl+Enter to submit, Esc to cancel)' : 'kubectl create deployment my-app --image=nginx --replicas=3'}
          spellCheck={false}
          autoComplete="off"
          rows={1}
        />
        {isMultiLine && (
          <span className="terminal-multiline-hint">Ctrl+Enter to submit</span>
        )}
      </div>
    </div>
  );
}
