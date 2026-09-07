import axios from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const backendUrl = process.env.API_URL || "";
    const response = await axios.post(`${backendUrl}/api/event-feed-token/`, req.body, {
      headers: {
        "Content-Type": "application/json",
        ...(req.headers["accept-language"] && {
          "Accept-Language": req.headers["accept-language"],
        }),
      },
    });
    return res.status(response.status).json(response.data);
  } catch (err: any) {
    const status = err.response?.status || 502;
    const data = err.response?.data || { error: "Backend request failed" };
    return res.status(status).json(data);
  }
}
