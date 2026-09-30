type ConnectedInboxSendResult = {
  allowed: boolean;
  daily_limit: number;
  daily_sent_count: number;
  remaining: number;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return { url, anonKey };
}

async function callRpc(
  accessToken: string,
  functionName: string,
  body: Record<string, unknown>,
) {
  const { url, anonKey } = getSupabaseConfig();

  const response = await fetch(
    `${url}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      message || `Unable to call ${functionName}.`,
    );
  }

  return response.json();
}

export async function reserveConnectedInboxSend(
  accessToken: string,
  inboxId: string,
): Promise<ConnectedInboxSendResult> {
  const data = await callRpc(
    accessToken,
    "reserve_connected_inbox_send",
    {
      target_inbox_id: inboxId,
    },
  );

  return data as ConnectedInboxSendResult;
}

export async function releaseConnectedInboxSend(
  accessToken: string,
  inboxId: string,
): Promise<boolean> {
  const data = await callRpc(
    accessToken,
    "release_connected_inbox_send",
    {
      target_inbox_id: inboxId,
    },
  );

  return Boolean(data);
}