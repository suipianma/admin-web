import { useEffect, useState } from "react";
import {
  observabilityStore,
  type ObservabilitySnapshot,
} from "@/lib/observability/observability-store";

/** 订阅 Observability 快照（Debug Panel） */
export function useObservability(): ObservabilitySnapshot {
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot>(() =>
    observabilityStore.getSnapshot()
  );

  useEffect(() => {
    return observabilityStore.subscribe(() => {
      setSnapshot(observabilityStore.getSnapshot());
    });
  }, []);

  return snapshot;
}
