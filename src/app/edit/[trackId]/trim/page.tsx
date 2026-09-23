import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TrimPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trimmer</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Waveform, region selection, and trim/download controls land here in Phase 6.
      </CardContent>
    </Card>
  );
}
