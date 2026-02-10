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
  const viewMode = useSimulatorStore((s) => s.viewMode);
  const setViewMode = useSimulatorStore((s) => s.setViewMode);
  const showNetworkOverlay = useSimulatorStore((s) => s.showNetworkOverlay);
  const toggleNetworkOverlay = useSimulatorStore((s) => s.toggleNetworkOverlay);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAutoRunning && !predictionPending) {
      intervalRef.current = window.setInterval(() => {
        tick(true);
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
        onClick={() => tick()}
        disabled={predictionPending}
        title={predictionPending ? 'Answer the prediction question first' : 'Run one reconciliation cycle (Ctrl+Enter)'}
      >
        Reconcile
      </button>
      <button
        className={`btn ${isAutoRunning ? 'btn-auto-on' : 'btn-warning'}`}
        onClick={toggleAutoRun}
        title={isAutoRunning ? 'Pause auto-reconciliation' : 'Resume auto-reconciliation'}
      >
        {isAutoRunning ? 'Auto' : 'Paused'}
      </button>
      <button className="btn btn-danger" onClick={reset} title="Reset cluster to initial state">
        Reset
      </button>
      {predictionPending && (
        <span className="prediction-indicator">Prediction required</span>
      )}

      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'infrastructure' ? 'active' : ''}`}
          onClick={() => setViewMode('infrastructure')}
          title="Infrastructure view: pods nested inside nodes"
        >
          Infrastructure
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'logical' ? 'active' : ''}`}
          onClick={() => setViewMode('logical')}
          title="Logical view: hierarchical resource graph"
        >
          Logical
        </button>
      </div>
      <button
        className={`btn btn-network ${showNetworkOverlay ? 'active' : ''}`}
        onClick={toggleNetworkOverlay}
        title={showNetworkOverlay ? 'Hide network routing' : 'Highlight network routing'}
      >
        Network
      </button>

      <span className="tick-counter">Tick: {tickCount}</span>
    </div>
  );
}
