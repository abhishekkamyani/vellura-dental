"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export const OPEN_CHAT_EVENT = "vellura:open-chat";

/** Opens the floating concierge chat from anywhere on the page. */
export function OpenChatButton(props: ComponentProps<typeof Button>) {
  return <Button {...props} onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))} />;
}
