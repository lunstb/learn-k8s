import { useState, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ClusterVisualization } from './components/ClusterVisualization';
import { Terminal } from './components/Terminal';
import { Controls } from './components/Controls';
import { LessonPanel } from './components/LessonPanel';
import { EventLog } from './components/EventLog';
import { ResourceDetailPanel } from './components/ResourceDetailPanel';
import { YamlEditor } from './components/YamlEditor';

import { LessonContent } from './components/LessonContent';
import { useSimulatorStore } from './simulation/store';
import './App.css';

function App() {
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const lessonPhase = useSimulatorStore((s) => s.lessonPhase);
  const activeBottomTab = useSimulatorStore((s) => s.activeBottomTab);
  const setActiveBottomTab = useSimulatorStore((s) => s.setActiveBottomTab);
  const [bottomHeight, setBottomHeight] = useState(350);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const yamlEditorContent = useSimulatorStore((s) => s.yamlEditorContent);
  const showLessonContent = currentLesson && lessonPhase !== 'practice';
  const showYamlTab = lessonPhase === 'practice' && !!(currentLesson?.yamlTemplate || yamlEditorContent);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = bottomHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY;
      const newHeight = Math.min(Math.max(startHeight.current + delta, 150), window.innerHeight - 200);
      setBottomHeight(newHeight);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [bottomHeight]);

  return (
    <ReactFlowProvider>
      <div className="app">
        <header className="app-header">
          <h1>K8s Simulator</h1>
          <span className="subtitle">Learn Kubernetes by Doing</span>
        </header>
        <div className="app-body">
          <aside className="sidebar">
            <LessonPanel />
          </aside>
          <main className="main-content">
            {showLessonContent ? (
              <LessonContent />
            ) : (
              <>
                <div className="visualization-panel">
                  <ClusterVisualization />
                  <ResourceDetailPanel />
                </div>
                <div className="resize-handle" onMouseDown={onMouseDown} />
                <div className="bottom-panel" style={{ height: bottomHeight }}>
                  <Controls />
                  {showYamlTab && (
                    <div className="bottom-tab-bar">
                      <button
                        className={`bottom-tab${activeBottomTab === 'terminal' ? ' active' : ''}`}
                        onClick={() => setActiveBottomTab('terminal')}
                      >
                        Terminal
                      </button>
                      <button
                        className={`bottom-tab${activeBottomTab === 'yaml' ? ' active' : ''}`}
                        onClick={() => setActiveBottomTab('yaml')}
                      >
                        YAML Editor
                      </button>
                    </div>
                  )}
                  <div className="terminal-events-row">
                    {showYamlTab && activeBottomTab === 'yaml' ? (
                      <YamlEditor />
                    ) : (
                      <Terminal />
                    )}
                    <EventLog />
                  </div>
                </div>
              </>
            )}
          </main>
        </div>

      </div>
    </ReactFlowProvider>
  );
}

export default App;
