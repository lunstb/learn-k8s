import { useEffect, useRef } from 'react';
import { useSimulatorStore } from '../simulation/store';

export function Controls() {
  const tick = useSimulatorStore((s) => s.tick);
  const reset = useSimulatorStore((s) => s.reset);
  const tickCount = useSimulatorStore((s) => s.cluster.tick);
  const isAutoRunning = useSimulatorStore((s) => s.isAutoRunning);
  const toggleAutoRun = useSimulatorStore((s) => s.toggleAutoRun);
  const autoRunInterval = useSimulatorStore((s) => s.autoRunInterval);
  const predictionPending = useSimulatorStore((s) => s.predictionPending);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAutoRunning && !predictionPending) {
      intervalRef.current = window.setInterval(() => {
        tick();
      }, autoRunInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoRunning, autoRunInterval, tick, predictionPending]);

  return (
    <div className="controls">
      <button
        className={`btn btn-primary ${predictionPending ? 'btn-disabled' : ''}`}
        onClick={tick}
        disabled={predictionPending}
        title={predictionPending ? 'Answer the prediction question first' : 'Run one reconciliation cycle (Ctrl+Enter)'}
      >
        Reconcile
      </button>
      <button
        className={`btn ${isAutoRunning ? 'btn-warning' : 'btn-secondary'}`}
        onClick={toggleAutoRun}
        title={isAutoRunning ? 'Pause auto-reconciliation' : 'Auto-reconcile every 1.5s'}
      >
        {isAutoRunning ? 'Pause' : 'Auto-Run'}
      </button>
      <button className="btn btn-danger" onClick={reset} title="Reset cluster to initial state">
        Reset
      </button>
      {predictionPending && (
        <span className="prediction-indicator">Prediction required</span>
      )}
      <span className="tick-counter">Tick: {tickCount}</span>
    </div>
  );
}
