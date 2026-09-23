import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MetronomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metronome Generator</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Tempo override, time-signature, tap-tempo, and click-track downloads land here in Phase 7.
      </CardContent>
    </Card>
  );
}
