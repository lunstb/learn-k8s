import { ReactFlowProvider } from '@xyflow/react';
import { ClusterVisualization } from './components/ClusterVisualization';
import { Terminal } from './components/Terminal';
import { Controls } from './components/Controls';
import { LessonPanel } from './components/LessonPanel';
import { EventLog } from './components/EventLog';
import { ResourceDetailPanel } from './components/ResourceDetailPanel';

import { LessonContent } from './components/LessonContent';
import { useSimulatorStore } from './simulation/store';
import './App.css';

function App() {
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const lessonPhase = useSimulatorStore((s) => s.lessonPhase);

  const showLessonContent = currentLesson && lessonPhase !== 'practice';

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
                <div className="bottom-panel">
                  <Controls />
                  <div className="terminal-events-row">
                    <Terminal />
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
