/**
 * livekitService.ts — Fetches a LiveKit participant token from the backend.
 */

import api from "./api";

export type LiveKitTokenResponse = {
  token: string;
  wsUrl: string;
  roomId: string;
};

/**
 * Request a participant token for the given interview room.
 * The backend validates the JWT and issues a scoped LiveKit token.
 */
export const fetchLiveKitToken = async (
  roomId: string,
  role: "interviewer" | "candidate" | "observer" = "candidate"
): Promise<LiveKitTokenResponse> => {
  const { data } = await api.post<LiveKitTokenResponse>("/api/livekit/token", {
    roomId,
    role,
  });
  return data;
};
