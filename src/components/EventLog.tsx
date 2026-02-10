import { useState } from 'react';
import { useSimulatorStore } from '../simulation/store';

export function EventLog() {
  const events = useSimulatorStore((s) => s.cluster.events);
  const [collapsed, setCollapsed] = useState(false);

  const recentEvents = events.slice(-15);

  return (
    <div className={`event-log ${collapsed ? 'collapsed' : ''}`}>
      <button className="event-log-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Events ({events.length})</span>
        <span className="event-log-toggle">{collapsed ? '+' : '-'}</span>
      </button>
      {!collapsed && (
        <div className="event-log-body">
          {recentEvents.length === 0 ? (
            <div className="event-log-empty">No events yet</div>
          ) : (
            recentEvents.map((event, i) => (
              <div
                key={i}
                className={`event-log-entry ${event.type === 'Warning' ? 'event-warning' : 'event-normal'}`}
              >
                <span className="event-tick">T{event.tick}</span>
                <span className={`event-type ${event.type === 'Warning' ? 'warning' : 'normal'}`}>
                  {event.type === 'Warning' ? 'W' : 'N'}
                </span>
                <span className="event-reason">{event.reason}</span>
                <span className="event-object">{event.objectKind}/{event.objectName}</span>
                <span className="event-message">{event.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
