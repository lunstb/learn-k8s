import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { useSimulatorStore } from '../simulation/store';
import { executeCommand } from '../commands/executor';

export function Terminal() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    appendOutput(`$ ${trimmed}`);
    setHistory((prev) => [trimmed, ...prev]);
    setHistoryIndex(-1);

    const output = executeCommand(trimmed);
    for (const line of output) {
      appendOutput(line);
    }
    appendOutput('');

    setInput('');

    // Check goals after command
    setTimeout(() => useSimulatorStore.getState().checkGoal(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey) {
        // Ctrl+Enter = reconcile
        tick();
        return;
      }
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
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
              line.includes('✅') ? 'terminal-success' :
              ''
            }`}
          >
            {line || '\u00A0'}
          </div>
        ))}
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          type="text"
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="kubectl create deployment my-app --image=nginx --replicas=3"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
