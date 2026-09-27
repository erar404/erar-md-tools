import { defineRailway, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const mdToolsProcessorVolume = volume("md-tools-processor-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "asia-southeast1-eqsg3a", sizeMB: 500 });
  const mdToolsProcessor = service("md-tools-processor", {
    replicas: { "asia-southeast1-eqsg3a": 1 },
    volumeMounts: { "/data": mdToolsProcessorVolume },
    env: { PROCESSOR_SERVICE_TOKEN: preserve(), SUPABASE_SERVICE_ROLE_KEY: preserve(), SUPABASE_URL: preserve(), TORCH_HOME: preserve() },
  });

  return project("md-tools-processor", {
    resources: [mdToolsProcessor, mdToolsProcessorVolume],
  });
});
