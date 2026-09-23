import "server-only";

/** Forwards a job request to the Python processor microservice (Phase 3). */
export async function callProcessor<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = process.env.PROCESSOR_BASE_URL;
  const token = process.env.PROCESSOR_SERVICE_TOKEN;

  if (!baseUrl || !token) {
    throw new Error(
      "PROCESSOR_BASE_URL / PROCESSOR_SERVICE_TOKEN are not configured yet (see Phase 3)."
    );
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Processor request to ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}
