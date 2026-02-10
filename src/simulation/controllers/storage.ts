import type { ClusterState, PersistentVolume, ControllerAction, SimEvent } from '../types';
import { generateUID } from '../utils';

export function reconcileStorage(state: ClusterState): {
  persistentVolumes: PersistentVolume[];
  persistentVolumeClaims: ClusterState['persistentVolumeClaims'];
  actions: ControllerAction[];
  events: SimEvent[];
} {
  const pvs = state.persistentVolumes.map((pv) => ({ ...pv, spec: { ...pv.spec }, status: { ...pv.status } }));
  const pvcs = state.persistentVolumeClaims.map((pvc) => ({ ...pvc, spec: { ...pvc.spec }, status: { ...pvc.status } }));
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];

  // 1. Bind Pending PVCs
  for (const pvc of pvcs) {
    if (pvc.status.phase !== 'Pending') continue;

    const scName = pvc.spec.storageClassName || '';

    // Try to find an Available PV with matching storageClassName
    const matchingPV = pvs.find(
      (pv) =>
        pv.status.phase === 'Available' &&
        pv.spec.storageClassName === scName &&
        !pv.spec.claimRef
    );

    if (matchingPV) {
      // Bind
      matchingPV.spec.claimRef = { name: pvc.metadata.name, uid: pvc.metadata.uid };
      matchingPV.status.phase = 'Bound';
      pvc.status.phase = 'Bound';
      pvc.status.volumeName = matchingPV.metadata.name;
      actions.push({
        controller: 'PVController',
        action: 'bind',
        details: `Bound PV ${matchingPV.metadata.name} to PVC ${pvc.metadata.name}`,
      });
      events.push({
        timestamp: Date.now(),
        tick: state.tick,
        type: 'Normal',
        reason: 'Bound',
        objectKind: 'PersistentVolumeClaim',
        objectName: pvc.metadata.name,
        message: `PVC bound to PV ${matchingPV.metadata.name}`,
      });
    } else if (scName) {
      // Dynamic provisioning: check if StorageClass exists
      const sc = state.storageClasses.find((s) => s.metadata.name === scName);
      if (sc) {
        // Auto-create a PV and bind it
        const pvName = `pv-${pvc.metadata.name}-${generateUID().slice(0, 5)}`;
        const newPV: PersistentVolume = {
          kind: 'PersistentVolume',
          metadata: {
            name: pvName,
            uid: generateUID(),
            labels: {},
            creationTimestamp: Date.now(),
          },
          spec: {
            capacity: { storage: pvc.spec.resources.requests.storage },
            accessModes: [...pvc.spec.accessModes],
            storageClassName: scName,
            claimRef: { name: pvc.metadata.name, uid: pvc.metadata.uid },
          },
          status: { phase: 'Bound' },
        };
        pvs.push(newPV);
        pvc.status.phase = 'Bound';
        pvc.status.volumeName = pvName;
        actions.push({
          controller: 'PVController',
          action: 'provision',
          details: `Dynamically provisioned PV ${pvName} for PVC ${pvc.metadata.name} via StorageClass ${scName}`,
        });
        events.push({
          timestamp: Date.now(),
          tick: state.tick,
          type: 'Normal',
          reason: 'Provisioned',
          objectKind: 'PersistentVolumeClaim',
          objectName: pvc.metadata.name,
          message: `Dynamically provisioned PV ${pvName} via StorageClass ${scName}`,
        });
      }
      // else: no SC found, PVC stays Pending
    }
  }

  // 2. Reclaim Released PVs
  for (let i = pvs.length - 1; i >= 0; i--) {
    const pv = pvs[i];
    if (pv.status.phase !== 'Released') continue;

    const scName = pv.spec.storageClassName;
    const sc = state.storageClasses.find((s) => s.metadata.name === scName);
    const policy = sc?.reclaimPolicy || 'Delete';

    if (policy === 'Delete') {
      actions.push({
        controller: 'PVController',
        action: 'reclaim',
        details: `Deleted released PV ${pv.metadata.name} (reclaimPolicy=Delete)`,
      });
      pvs.splice(i, 1);
    }
    // Retain: PV stays as Released
  }

  return { persistentVolumes: pvs, persistentVolumeClaims: pvcs, actions, events };
}
